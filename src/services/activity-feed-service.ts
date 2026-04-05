/**
 * Activity Feed Service — Slack-like team activity feed.
 *
 * Builds human-readable feed entries from audit_logs.
 * Supports: feed queries, read cursors, @mentions, unread counts.
 *
 * Per mongodb-schema-design: separate collections for read cursors and mentions.
 * Per api-security-best-practices: team-scoped queries only.
 */

import { ObjectId, type Db } from "mongodb";
import type { AuditAction, AuditLogEntry } from "./audit-service";

// ─── Types ─────────────────────────────────────────────────

/** Activity feed event category for filtering */
export type FeedCategory = "asset" | "team" | "approval" | "security" | "org";

/** Human-readable feed entry */
export interface FeedEntry {
  id: string;
  action: AuditAction;
  category: FeedCategory;
  actorId: string;
  actorName: string;
  actorInitial: string;
  targetId: string;
  targetName?: string;
  targetType?: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

/** User read cursor — tracks what they've seen */
export interface ReadCursor {
  _id: ObjectId;
  userId: ObjectId;
  teamId: ObjectId;
  lastReadAt: Date;
  updatedAt: Date;
}

/** @mention notification */
export interface Mention {
  _id: ObjectId;
  mentionedUserId: ObjectId;
  mentionedBy: ObjectId;
  mentionedByName: string;
  teamId: ObjectId;
  assetId?: ObjectId;
  assetName?: string;
  comment: string;
  read: boolean;
  createdAt: Date;
}

// ─── Action → Human-readable message ──────────────────────

const ACTION_LABELS: Record<string, string> = {
  "asset:create": "created an asset",
  "asset:update": "updated an asset",
  "asset:delete": "deleted an asset",
  "asset:publish": "published an asset",
  "asset:unpublish": "unpublished an asset",
  "asset:import": "imported an asset",
  "asset:export": "exported an asset",
  "asset:install": "installed an asset",
  "asset:scan": "scanned an asset",
  "asset:fork": "forked an asset",
  "team:create": "created a team",
  "team:update": "updated team settings",
  "team:member_add": "added a team member",
  "team:member_remove": "removed a team member",
  "team:member_role_change": "changed a member's role",
  "org:create": "created an organization",
  "org:update": "updated organization settings",
  "org:member_add": "added an org member",
  "org:member_remove": "removed an org member",
  "dept:create": "created a department",
  "dept:update": "updated a department",
  "auth:login": "logged in",
  "auth:logout": "logged out",
  "auth:sso_login": "logged in via SSO",
  "auth:token_create": "created an API token",
  "auth:token_revoke": "revoked an API token",
  "approval:request": "requested approval",
  "approval:approve": "approved a request",
  "approval:reject": "rejected a request",
  "share:cross_dept": "shared across departments",
  "share:marketplace_publish": "published to marketplace",
  "sso:config_update": "updated SSO configuration",
  "sso:jit_provision": "provisioned user via JIT",
  "scim:user_provisioned": "provisioned user via SCIM",
  "scim:user_deprovisioned": "deprovisioned user via SCIM",
};

/** Map audit action to feed category */
function actionToCategory(action: AuditAction): FeedCategory {
  if (action.startsWith("asset:") || action.startsWith("share:")) return "asset";
  if (action.startsWith("team:")) return "team";
  if (action.startsWith("approval:")) return "approval";
  if (action.startsWith("auth:") || action.startsWith("sso:") || action.startsWith("scim:")) return "security";
  if (action.startsWith("org:") || action.startsWith("dept:")) return "org";
  return "asset";
}

// ─── Feed Queries ─────────────────────────────────────────

/**
 * Get the activity feed for a team.
 * Builds human-readable entries from audit_logs with actor/target name resolution.
 */
export async function getFeed(
  db: Db,
  teamId: ObjectId,
  options: {
    limit?: number;
    page?: number;
    category?: FeedCategory;
    actorId?: ObjectId;
  } = {}
): Promise<{ entries: FeedEntry[]; total: number }> {
  const { limit = 30, page = 1, category, actorId } = options;
  const skip = (page - 1) * limit;

  // Build filter
  const filter: Record<string, unknown> = { teamId };
  if (category) {
    const prefixes = categoryPrefixes(category);
    filter.action = { $in: prefixes };
  }
  if (actorId) filter.actorId = actorId;

  // Parallel: count + fetch
  const [total, entries] = await Promise.all([
    db.collection("audit_logs").countDocuments(filter),
    db.collection<AuditLogEntry>("audit_logs")
      .find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
  ]);

  if (entries.length === 0) return { entries: [], total };

  // Resolve actor names
  const actorIds = [...new Set(entries.map((e) => e.actorId.toHexString()))];
  const actors = actorIds.length > 0
    ? await db.collection("users")
        .find({ _id: { $in: actorIds.map((id) => new ObjectId(id)) } })
        .project({ name: 1, email: 1 })
        .toArray()
    : [];
  const actorMap = new Map(actors.map((a) => [a._id.toHexString(), a.name ?? a.email ?? "Unknown"]));

  // Resolve target names (assets)
  const assetTargetIds = [...new Set(
    entries
      .filter((e) => e.action.startsWith("asset:"))
      .map((e) => e.targetId.toHexString())
  )];
  const assets = assetTargetIds.length > 0
    ? await db.collection("assets")
        .find({ _id: { $in: assetTargetIds.map((id) => new ObjectId(id)) } })
        .project({ "metadata.name": 1 })
        .toArray()
    : [];
  const assetMap = new Map(assets.map((a) => [a._id.toHexString(), a.metadata?.name ?? "Unknown"]));

  // Build feed entries
  const feedEntries: FeedEntry[] = entries.map((entry) => {
    const actorName = actorMap.get(entry.actorId.toHexString()) ?? "Unknown";
    const targetName = entry.action.startsWith("asset:")
      ? assetMap.get(entry.targetId.toHexString())
      : undefined;
    return {
      id: entry._id.toHexString(),
      action: entry.action,
      category: actionToCategory(entry.action),
      actorId: entry.actorId.toHexString(),
      actorName,
      actorInitial: actorName[0]?.toUpperCase() ?? "?",
      targetId: entry.targetId.toHexString(),
      targetName,
      targetType: entry.targetType,
      message: buildMessage(actorName, entry.action, targetName),
      details: entry.details,
      timestamp: entry.timestamp.toISOString(),
    };
  });

  return { entries: feedEntries, total };
}

/** Get actions that match a category */
function categoryPrefixes(category: FeedCategory): AuditAction[] {
  const all = Object.keys(ACTION_LABELS) as AuditAction[];
  return all.filter((a) => actionToCategory(a) === category);
}

// ─── Read Cursors ─────────────────────────────────────────

/**
 * Mark feed as read for a user on a team.
 */
export async function markFeedAsRead(
  db: Db,
  userId: ObjectId,
  teamId: ObjectId
): Promise<void> {
  await db.collection("feed_read_cursors").updateOne(
    { userId, teamId },
    { $set: { lastReadAt: new Date(), updatedAt: new Date() } },
    { upsert: true }
  );
}

/**
 * Get the number of unread feed entries for a user on a team.
 */
export async function getUnreadCount(
  db: Db,
  userId: ObjectId,
  teamId: ObjectId
): Promise<number> {
  const cursor = await db.collection<ReadCursor>("feed_read_cursors").findOne({ userId, teamId });
  const since = cursor?.lastReadAt ?? new Date(0);

  return db.collection("audit_logs").countDocuments({
    teamId,
    timestamp: { $gt: since },
    actorId: { $ne: userId }, // Don't count own actions as unread
  });
}

// ─── @Mentions ────────────────────────────────────────────

/**
 * Create an @mention notification for a user.
 */
export async function createMention(
  db: Db,
  input: {
    mentionedUserId: ObjectId;
    mentionedBy: ObjectId;
    teamId: ObjectId;
    assetId?: ObjectId;
    comment: string;
  }
): Promise<ObjectId> {
  // Resolve names
  const [mentioner, asset] = await Promise.all([
    db.collection("users").findOne({ _id: input.mentionedBy }, { projection: { name: 1, email: 1 } }),
    input.assetId
      ? db.collection("assets").findOne({ _id: input.assetId }, { projection: { "metadata.name": 1 } })
      : null,
  ]);

  const doc: Omit<Mention, "_id"> = {
    mentionedUserId: input.mentionedUserId,
    mentionedBy: input.mentionedBy,
    mentionedByName: mentioner?.name ?? mentioner?.email ?? "Unknown",
    teamId: input.teamId,
    assetId: input.assetId,
    assetName: asset?.metadata?.name ?? undefined,
    comment: input.comment,
    read: false,
    createdAt: new Date(),
  };

  const result = await db.collection("mentions").insertOne(doc);
  return result.insertedId;
}

/**
 * Get mentions for a user.
 */
export async function getMentions(
  db: Db,
  userId: ObjectId,
  options: { unreadOnly?: boolean; limit?: number } = {}
): Promise<Mention[]> {
  const { unreadOnly = false, limit = 20 } = options;
  const filter: Record<string, unknown> = { mentionedUserId: userId };
  if (unreadOnly) filter.read = false;

  return db.collection<Mention>("mentions")
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

/**
 * Mark a mention as read.
 */
export async function markMentionRead(
  db: Db,
  mentionId: ObjectId,
  userId: ObjectId
): Promise<boolean> {
  const result = await db.collection("mentions").updateOne(
    { _id: mentionId, mentionedUserId: userId },
    { $set: { read: true } }
  );
  return result.modifiedCount > 0;
}

/**
 * Get unread mention count for a user.
 */
export async function getUnreadMentionCount(
  db: Db,
  userId: ObjectId
): Promise<number> {
  return db.collection("mentions").countDocuments({
    mentionedUserId: userId,
    read: false,
  });
}
function buildMessage(actorName: string, action: AuditAction, targetName?: string): string {
  const label = ACTION_LABELS[action] ?? action.replace(":", " ");
  if (targetName) return `${actorName} ${label}: ${targetName}`;
  return `${actorName} ${label}`;
}
