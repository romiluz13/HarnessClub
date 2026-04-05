/**
 * Audit Logging Service.
 *
 * Lightweight, append-only audit trail for asset CRUD operations.
 * Per mongodb-schema-design: TTL index auto-purges after 90 days.
 * Per api-security-best-practices: track who did what to which asset.
 *
 * Design decisions:
 * - One document per event (not bucketed) — enables TTL and individual queries
 * - Fire-and-forget via after() when possible — audit must never block user operations
 * - Separate collection from activity (analytics) — different retention, different queries
 */

import { ObjectId, type Db } from "mongodb";
import type { AssetType } from "@/types/asset";

/** Supported audit actions (Phase 13: expanded) */
export type AuditAction =
  // Asset lifecycle
  | "asset:create"
  | "asset:update"
  | "asset:delete"
  | "asset:publish"
  | "asset:unpublish"
  | "asset:import"
  | "asset:export"
  | "asset:install"
  | "asset:scan"
  | "asset:fork"
  // Team management
  | "team:create"
  | "team:update"
  | "team:member_add"
  | "team:member_remove"
  | "team:member_role_change"
  // Organization management
  | "org:create"
  | "org:update"
  | "org:member_add"
  | "org:member_remove"
  | "dept:create"
  | "dept:update"
  // Security & auth
  | "auth:login"
  | "auth:logout"
  | "auth:sso_login"
  | "auth:token_create"
  | "auth:token_revoke"
  // Approvals
  | "approval:request"
  | "approval:approve"
  | "approval:reject"
  // Sharing
  | "share:cross_dept"
  | "share:marketplace_publish"
  // SSO/SCIM
  | "sso:config_update"
  | "sso:jit_provision"
  | "scim:user_provisioned"
  | "scim:user_deprovisioned";

/** Audit log entry stored in MongoDB */
export interface AuditLogEntry {
  _id: ObjectId;
  /** Who performed the action (user ID) */
  actorId: ObjectId;
  /** What action was performed */
  action: AuditAction;
  /** Target resource ID (asset, team, or user) */
  targetId: ObjectId;
  /** Type of the target (asset type, or "user", "api_token", "organization", etc.) */
  targetType?: AssetType | "user" | "api_token" | "organization" | "team";
  /** Team context */
  teamId: ObjectId;
  /** Optional diff or details (e.g., which fields changed) */
  details?: Record<string, unknown>;
  /** Client IP address (Phase 13) */
  ip?: string;
  /** User-Agent string (Phase 13) */
  userAgent?: string;
  /** Organization context (Phase 13) */
  orgId?: ObjectId;
  /** When the action occurred — also used by TTL index */
  timestamp: Date;
}

/**
 * Log an audit event.
 *
 * Fire-and-forget: catches errors to never block the caller.
 * Use `after()` from Next.js for non-blocking writes when available.
 */
export async function logAuditEvent(
  db: Db,
  event: Omit<AuditLogEntry, "_id" | "timestamp">
): Promise<void> {
  try {
    await db.collection("audit_logs").insertOne({
      _id: new ObjectId(),
      ...event,
      timestamp: new Date(),
    });
  } catch (err) {
    // Never throw from audit logging — it's supplementary, not critical
    console.warn("[audit] Failed to log event:", (err as Error).message);
  }
}

/**
 * Query audit logs for a team.
 * Supports pagination and optional action filter.
 */
export async function getAuditLogs(
  db: Db,
  options: {
    teamId: ObjectId;
    action?: AuditAction;
    actorId?: ObjectId;
    targetId?: ObjectId;
    limit?: number;
    page?: number;
  }
): Promise<AuditLogEntry[]> {
  const { teamId, action, actorId, targetId, limit = 50, page = 1 } = options;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = { teamId };
  if (action) filter.action = action;
  if (actorId) filter.actorId = actorId;
  if (targetId) filter.targetId = targetId;

  return db
    .collection<AuditLogEntry>("audit_logs")
    .find(filter)
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();
}

/** SIEM export format — compatible with Splunk/Datadog/Elastic */
export interface SiemEvent {
  timestamp: string;
  source: "agentconfig";
  action: string;
  actor: string;
  target: string;
  targetType?: string;
  team?: string;
  org?: string;
  ip?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
  severity: "info" | "warning" | "critical";
}

/** Map audit action to SIEM severity */
function actionSeverity(action: AuditAction): SiemEvent["severity"] {
  if (action.startsWith("auth:") || action.includes("delete") || action.includes("revoke")) return "warning";
  if (action.includes("deprovisioned")) return "critical";
  return "info";
}

/**
 * Export audit logs in SIEM-compatible format.
 * Returns JSON lines (NDJSON) for Splunk/Datadog ingestion.
 */
export async function exportToSiem(
  db: Db,
  options: {
    orgId?: ObjectId;
    teamId?: ObjectId;
    since?: Date;
    limit?: number;
  }
): Promise<SiemEvent[]> {
  const filter: Record<string, unknown> = {};
  if (options.orgId) filter.orgId = options.orgId;
  if (options.teamId) filter.teamId = options.teamId;
  if (options.since) filter.timestamp = { $gte: options.since };

  const entries = await db
    .collection<AuditLogEntry>("audit_logs")
    .find(filter)
    .sort({ timestamp: -1 })
    .limit(options.limit ?? 1000)
    .toArray();

  return entries.map((entry) => ({
    timestamp: entry.timestamp.toISOString(),
    source: "agentconfig" as const,
    action: entry.action,
    actor: entry.actorId.toHexString(),
    target: entry.targetId.toHexString(),
    targetType: entry.targetType,
    team: entry.teamId.toHexString(),
    org: entry.orgId?.toHexString(),
    ip: entry.ip,
    userAgent: entry.userAgent,
    details: entry.details,
    severity: actionSeverity(entry.action),
  }));
}
