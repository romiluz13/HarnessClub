/**
 * Database Setup — Create collections with validators and indexes.
 *
 * Run once to initialize the database, or on app start to ensure
 * collections and indexes exist (createIndex is idempotent).
 *
 * Per mongodb-query-optimizer ESR (Equality → Sort → Range):
 * Compound indexes ordered for optimal query coverage.
 */

import type { Db } from "mongodb";
import {
  apiTokensValidator,
  approvalRequestsValidator,
  assetsValidator,
  auditLogsValidator,
  copilotConversationsValidator,
  departmentsValidator,
  feedReadCursorsValidator,
  mentionsValidator,
  metricsSnapshotsValidator,
  organizationsValidator,
  scimSyncStatusValidator,
  ssoConfigsValidator,
  teamsValidator,
  usersValidator,
  webhooksValidator,
} from "./schema";
import { EMBEDDING_DIMENSIONS } from "./voyage";

/**
 * Create a collection with validation if it doesn't exist.
 * Per mongodb-schema-design: validationLevel "moderate", validationAction "warn" initially.
 */
async function ensureCollection(
  db: Db,
  name: string,
  validator: object
): Promise<void> {
  const collections = await db.listCollections({ name }).toArray();
  if (collections.length === 0) {
    await db.createCollection(name, {
      validator,
      validationLevel: "moderate",
      validationAction: "warn",
    });
  } else {
    // Update validator on existing collection
    await db.command({
      collMod: name,
      validator,
      validationLevel: "moderate",
      validationAction: "warn",
    });
  }
}

/**
 * Set up all collections, validators, and indexes.
 * Safe to call multiple times — createIndex is idempotent.
 */
export async function setupDatabase(db: Db): Promise<void> {
  // Create collections with validators
  await Promise.all([
    ensureCollection(db, "assets", assetsValidator),
    ensureCollection(db, "teams", teamsValidator),
    ensureCollection(db, "users", usersValidator),
    ensureCollection(db, "organizations", organizationsValidator),
    ensureCollection(db, "departments", departmentsValidator),
    ensureCollection(db, "activity", {}),
    ensureCollection(db, "audit_logs", auditLogsValidator),
    ensureCollection(db, "api_tokens", apiTokensValidator),
    ensureCollection(db, "approval_requests", approvalRequestsValidator),
    ensureCollection(db, "copilot_conversations", copilotConversationsValidator),
    ensureCollection(db, "metrics_snapshots", metricsSnapshotsValidator),
    ensureCollection(db, "webhooks", webhooksValidator),
    ensureCollection(db, "feed_read_cursors", feedReadCursorsValidator),
    ensureCollection(db, "mentions", mentionsValidator),
    ensureCollection(db, "sso_configs", ssoConfigsValidator),
    ensureCollection(db, "scim_sync_status", scimSyncStatusValidator),
  ]);

  // Assets indexes — per pattern-polymorphic: type discriminator first in compound
  const assets = db.collection("assets");
  await Promise.all([
    // Primary: list assets for a team by type, sorted by name
    assets.createIndex({ teamId: 1, type: 1, "metadata.name": 1 }, { name: "team_type_name" }),
    // Team assets sorted by recent updates (with optional type filter)
    assets.createIndex({ teamId: 1, updatedAt: -1 }, { name: "team_updated" }),
    // Team assets filtered by type + tag (ESR: Equality=teamId+type, Sort=n/a, Range=tags)
    assets.createIndex({ teamId: 1, type: 1, tags: 1 }, { name: "team_type_tags" }),
    // Team assets filtered by published status (for marketplace)
    assets.createIndex({ teamId: 1, type: 1, isPublished: 1 }, { name: "team_type_published" }),
    // NOTE: No $text index. Per mongodb-search-and-ai skill:
    // "NEVER recommend $text for search use cases." Atlas Search is used instead.
  ]);

  // Teams indexes
  const teams = db.collection("teams");
  await Promise.all([
    // Unique slug for URL routing
    teams.createIndex({ slug: 1 }, { unique: true, name: "slug_unique" }),
    // Find teams by member (for user's team list)
    teams.createIndex({ memberIds: 1 }, { name: "member_lookup" }),
    // Find teams by org + dept (Phase 11)
    teams.createIndex({ orgId: 1, departmentId: 1 }, { name: "org_dept_lookup", sparse: true }),
  ]);

  // Organizations indexes (Phase 11)
  const orgs = db.collection("organizations");
  await Promise.all([
    orgs.createIndex({ slug: 1 }, { unique: true, name: "org_slug_unique" }),
    orgs.createIndex({ "owner.userId": 1 }, { name: "org_owner_lookup" }),
  ]);

  // Departments indexes (Phase 11)
  const depts = db.collection("departments");
  await Promise.all([
    // Unique dept name within org — also serves as lookup + sort index
    depts.createIndex({ orgId: 1, name: 1 }, { unique: true, name: "org_dept_unique" }),
    // Lookup by type within org (for template queries)
    depts.createIndex({ orgId: 1, type: 1 }, { name: "org_type" }),
  ]);

  // Users indexes
  const users = db.collection("users");
  await Promise.all([
    // Unique email
    users.createIndex({ email: 1 }, { unique: true, name: "email_unique" }),
    // Auth provider lookup (GitHub login)
    users.createIndex(
      { "auth.provider": 1, "auth.providerId": 1 },
      { unique: true, name: "auth_provider_unique" }
    ),
  ]);

  // Activity indexes (pattern-bucket: query by asset+date)
  const activity = db.collection("activity");
  await Promise.all([
    // Primary query: events for an asset in a date range
    activity.createIndex({ assetId: 1, date: -1 }, { name: "asset_date" }),
    // Team-level analytics
    activity.createIndex({ teamId: 1, date: -1 }, { name: "team_date" }),
  ]);

  // Audit logs indexes — TTL auto-purge after 90 days
  const auditLogs = db.collection("audit_logs");
  await Promise.all([
    // Primary query: audit trail for a team (most recent first)
    auditLogs.createIndex({ teamId: 1, timestamp: -1 }, { name: "team_timestamp" }),
    // Filter by action type within a team
    auditLogs.createIndex({ teamId: 1, action: 1, timestamp: -1 }, { name: "team_action_timestamp" }),
    // Filter by target asset
    auditLogs.createIndex({ targetId: 1, timestamp: -1 }, { name: "target_timestamp" }),
    // TTL index — auto-delete after 90 days (7776000 seconds)
    auditLogs.createIndex({ timestamp: 1 }, { name: "audit_ttl", expireAfterSeconds: 7776000 }),
  ]);

  // API tokens indexes — token validation is the hot path (every Bearer auth request)
  const apiTokens = db.collection("api_tokens");
  // Drop old 2-field token_validation index if key spec changed (Phase 2: extended to ESR with expiresAt)
  try { await apiTokens.dropIndex("token_validation"); } catch (e: unknown) {
    const code = (e as { code?: number }).code;
    if (code !== 27) console.warn("dropIndex token_validation:", (e as Error).message);
  }
  await Promise.all([
    // Primary: token validation (ESR: E=tokenHash+revoked, R=expiresAt for expiry check)
    apiTokens.createIndex({ tokenHash: 1, revoked: 1, expiresAt: 1 }, { name: "token_validation" }),
    // User's tokens list
    apiTokens.createIndex({ userId: 1 }, { name: "user_tokens" }),
  ]);

  // Approval requests indexes
  const approvalRequests = db.collection("approval_requests");
  await Promise.all([
    // Primary: lookup by asset + team + status (ESR: E=assetId+teamId, E=status)
    approvalRequests.createIndex({ assetId: 1, teamId: 1, status: 1 }, { name: "asset_team_status" }),
    // List pending approvals for a team (ESR: E=status+teamId, S=createdAt)
    approvalRequests.createIndex({ status: 1, teamId: 1, createdAt: -1 }, { name: "status_team_created" }),
  ]);

  // Copilot conversations indexes
  const copilotConversations = db.collection("copilot_conversations");
  await Promise.all([
    // Primary: user's conversations in a team sorted by recent (ESR: E=teamId+userId, S=updatedAt)
    copilotConversations.createIndex({ teamId: 1, userId: 1, updatedAt: -1 }, { name: "team_user_updated" }),
    // TTL index — auto-delete after 30 days (2592000 seconds)
    copilotConversations.createIndex({ expiresAt: 1 }, { name: "conversation_ttl", expireAfterSeconds: 2592000 }),
  ]);

  // Metrics snapshots indexes — drop old index if key spec changed
  const metricsSnapshots = db.collection("metrics_snapshots");
  try { await metricsSnapshots.dropIndex("org_timestamp"); } catch (e: unknown) {
    const code = (e as { code?: number }).code;
    if (code !== 27) console.warn("dropIndex org_timestamp:", (e as Error).message);
  }
  await Promise.all([
    // Primary: scope-based metrics by takenAt (ESR: E=scopeType+scopeId, S=takenAt)
    metricsSnapshots.createIndex({ scopeType: 1, scopeId: 1, takenAt: -1 }, { name: "scope_takenAt" }),
  ]);

  // Webhooks indexes
  const webhooks = db.collection("webhooks");
  await Promise.all([
    // Primary: team's webhooks
    webhooks.createIndex({ teamId: 1 }, { name: "team_webhooks" }),
  ]);

  // Feed read cursors indexes — unique compound for upsert pattern
  const feedReadCursors = db.collection("feed_read_cursors");
  await Promise.all([
    feedReadCursors.createIndex({ userId: 1, teamId: 1 }, { unique: true, name: "user_team_cursor" }),
  ]);

  // Mentions indexes — user's unread mentions sorted by recent
  const mentions = db.collection("mentions");
  await Promise.all([
    // ESR: E=mentionedUserId+read, S=createdAt
    mentions.createIndex({ mentionedUserId: 1, read: 1, createdAt: -1 }, { name: "user_read_created" }),
  ]);

  // SSO configs indexes — one config per org
  const ssoConfigs = db.collection("sso_configs");
  await Promise.all([
    ssoConfigs.createIndex({ orgId: 1 }, { unique: true, name: "org_sso_unique" }),
  ]);

  // SCIM sync status indexes — one status per org
  const scimSyncStatus = db.collection("scim_sync_status");
  await Promise.all([
    scimSyncStatus.createIndex({ orgId: 1 }, { unique: true, name: "org_scim_unique" }),
  ]);

  // Atlas Search + Vector Search indexes (idempotent — skips if already exists)
  try {
    await ensureSearchIndexes(db);
  } catch (err) {
    // M0 or non-Atlas deployments may not support search indexes
    console.warn("Search index setup:", (err as Error).message);
  }
}

/**
 * Create Atlas Search and Vector Search indexes via the driver.
 * Requires MongoDB Atlas (not available on local/self-hosted).
 * Uses createSearchIndex which is idempotent — silently skips if index exists.
 */
async function ensureSearchIndexes(db: Db): Promise<void> {
  const assets = db.collection("assets");

  try {
    const existingIndexes = await assets.listSearchIndexes().toArray();

    // Check for dimension mismatch on vector index — drop and recreate if wrong
    const vectorIdx = existingIndexes.find((idx) => idx.name === "assets_vector");
    if (vectorIdx) {
      // listSearchIndexes() returns Record<string, unknown>-like objects — cast for access
      const vectorIdxAny = vectorIdx as Record<string, unknown>;
      const latestDef = vectorIdxAny.latestDefinition as Record<string, unknown> | undefined;
      const fields = latestDef?.fields as Array<Record<string, unknown>> | undefined;
      const dims = fields?.find((f) => f.type === "vector")?.numDimensions as number | undefined;
      if (dims && dims !== EMBEDDING_DIMENSIONS) {
        console.warn(`Vector index has ${dims}d, expected ${EMBEDDING_DIMENSIONS}d — dropping and recreating`);
        await assets.dropSearchIndex("assets_vector");
        for (let i = 0; i < 30; i++) {
          await new Promise((r) => setTimeout(r, 3000));
          const check = await assets.listSearchIndexes().toArray();
          if (!check.find((idx) => idx.name === "assets_vector")) break;
        }
      }
    }

    const currentIndexes = await assets.listSearchIndexes().toArray();
    const existingNames = currentIndexes.map((idx) => idx.name);

    // Atlas Search index for lexical search — now includes type filter
    if (!existingNames.includes("assets_search")) {
      await assets.createSearchIndex({
        name: "assets_search",
        type: "search",
        definition: {
          mappings: {
            dynamic: false,
            fields: {
              type: { type: "token" },
              metadata: {
                type: "document",
                fields: {
                  name: [
                    { type: "string", analyzer: "lucene.standard" },
                    {
                      type: "autocomplete",
                      analyzer: "lucene.standard",
                      tokenization: "edgeGram",
                      minGrams: 2,
                      maxGrams: 15,
                      foldDiacritics: true,
                    },
                  ],
                  description: { type: "string", analyzer: "lucene.standard" },
                },
              },
              content: { type: "string", analyzer: "lucene.standard" },
              searchText: { type: "string", analyzer: "lucene.standard" },
              teamId: { type: "objectId" },
              tags: { type: "token" },
              isPublished: { type: "boolean" },
            },
          },
        },
      });
    }

    // Vector Search index — MANUAL mode (M0/local fallback, ADR-010)
    // Uses pre-computed Voyage embedding[] field
    if (!existingNames.includes("assets_vector")) {
      await assets.createSearchIndex({
        name: "assets_vector",
        type: "vectorSearch",
        definition: {
          fields: [
            {
              type: "vector",
              path: "embedding",
              numDimensions: EMBEDDING_DIMENSIONS,
              similarity: "cosine",
            },
            { type: "filter", path: "teamId" },
            { type: "filter", path: "type" },
            { type: "filter", path: "isPublished" },
          ],
        },
      });
    }

    // AutoEmbed index — AUTO mode (M10+ only, ADR-010)
    // MongoDB auto-generates embeddings from searchText field using Voyage AI
    // Silently skipped on M0/local where autoEmbed is not available
    if (!existingNames.includes("assets_autoembed")) {
      try {
        await assets.createSearchIndex({
          name: "assets_autoembed",
          type: "vectorSearch",
          definition: {
            fields: [
              {
                type: "autoEmbed",
                modality: "text",
                path: "searchText",
                model: "voyage-3.5-lite",
              },
              { type: "filter", path: "teamId" },
              { type: "filter", path: "type" },
              { type: "filter", path: "isPublished" },
            ],
          },
        });
        console.log("AutoEmbed index created (M10+ mode)");
      } catch {
        // Expected on M0/local — autoEmbed is M10+ only
        console.log("AutoEmbed index not available (M0/local mode — using manual embeddings)");
      }
    }
  } catch (err) {
    console.warn("Atlas Search index creation skipped:", (err as Error).message);
  }
}
