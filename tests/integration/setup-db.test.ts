/**
 * Integration test: setupDatabase() against real Atlas cluster.
 * Verifies collections, $jsonSchema validators, and indexes are created correctly.
 */

import { describe, it, expect, afterAll } from "vitest";
import { getTestDb, closeTestDb } from "../helpers/db-setup";
import { setupDatabase } from "../../src/lib/setup-db";

describe("setupDatabase — real Atlas", () => {
  afterAll(async () => {
    await closeTestDb();
  });

  it("runs setupDatabase without error", async () => {
    const db = await getTestDb();
    await setupDatabase(db);
    // If we reach here, no error was thrown
    expect(true).toBe(true);
  });

  it("creates assets, teams, users, activity collections", async () => {
    const db = await getTestDb();
    const names = (await db.listCollections().toArray()).map((c) => c.name);
    expect(names).toContain("assets");
    expect(names).toContain("teams");
    expect(names).toContain("users");
    expect(names).toContain("activity");
  });

  it("assets collection has expected indexes", async () => {
    const db = await getTestDb();
    const indexes = await db.collection("assets").indexes();
    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain("team_type_name");
    expect(indexNames).toContain("team_updated");
    expect(indexNames).toContain("team_type_tags");
    expect(indexNames).toContain("team_type_published");
  });

  it("teams collection has slug_unique and member_lookup indexes", async () => {
    const db = await getTestDb();
    const indexes = await db.collection("teams").indexes();
    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain("slug_unique");
    expect(indexNames).toContain("member_lookup");
  });

  it("users collection has email_unique and auth_provider_unique indexes", async () => {
    const db = await getTestDb();
    const indexes = await db.collection("users").indexes();
    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain("email_unique");
    expect(indexNames).toContain("auth_provider_unique");
  });

  it("activity collection has asset_date and team_date indexes", async () => {
    const db = await getTestDb();
    const indexes = await db.collection("activity").indexes();
    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain("asset_date");
    expect(indexNames).toContain("team_date");
  });

  it("$jsonSchema validator on assets collection has required fields", async () => {
    const db = await getTestDb();
    const assetsCollection = await db.listCollections(
      { name: "assets" },
      { nameOnly: false }
    ).toArray();
    expect(assetsCollection[0]).toBeDefined();
    const options = (assetsCollection[0] as { options?: { validator?: { $jsonSchema?: { required?: string[] } }; validationLevel?: string; validationAction?: string } }).options;
    expect(options?.validator?.$jsonSchema).toBeDefined();
    expect(options?.validator?.$jsonSchema?.required).toContain("type");
    expect(options?.validator?.$jsonSchema?.required).toContain("teamId");
    expect(options?.validator?.$jsonSchema?.required).toContain("metadata");
    expect(options?.validator?.$jsonSchema?.required).toContain("searchText");
    expect(options?.validator?.$jsonSchema?.required).toContain("releaseStatus");
    expect(options?.validationLevel).toBe("moderate");
    expect(options?.validationAction).toBe("warn");
  });

  it("teams $jsonSchema validator has correct settings schema", async () => {
    const db = await getTestDb();
    const teamsCollection = await db.listCollections(
      { name: "teams" },
      { nameOnly: false }
    ).toArray();
    const schema = (teamsCollection[0] as { options?: { validator?: { $jsonSchema?: { properties?: { settings?: { required?: string[] } } } } } }).options?.validator?.$jsonSchema;
    expect(schema).toBeDefined();
    expect(schema?.properties?.settings?.required).toContain("marketplaceEnabled");
    expect(schema?.properties?.settings?.required).toContain("defaultRole");
    expect(schema?.properties?.settings?.required).toContain("autoPublish");
  });

  it("api_tokens collection has token_validation (ESR with expiresAt) and user_tokens indexes", async () => {
    const db = await getTestDb();
    const indexes = await db.collection("api_tokens").indexes();
    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain("token_validation");
    expect(indexNames).toContain("user_tokens");
    // Verify extended ESR index includes expiresAt
    const tokenIdx = indexes.find((i) => i.name === "token_validation");
    expect(tokenIdx).toBeDefined();
    const key = (tokenIdx as { key?: Record<string, number> }).key;
    expect(key).toHaveProperty("tokenHash");
    expect(key).toHaveProperty("revoked");
    expect(key).toHaveProperty("expiresAt");
  });

  it("api_tokens $jsonSchema validator requires tokenHash but not userId (service_account tokens have no user)", async () => {
    const db = await getTestDb();
    const col = await db.listCollections({ name: "api_tokens" }, { nameOnly: false }).toArray();
    expect(col[0]).toBeDefined();
    const schema = (col[0] as { options?: { validator?: { $jsonSchema?: { required?: string[] } } } }).options?.validator?.$jsonSchema;
    expect(schema).toBeDefined();
    expect(schema?.required).toContain("tokenHash");
    expect(schema?.required).not.toContain("userId");
  });

  it("approval_requests collection has correct indexes", async () => {
    const db = await getTestDb();
    const indexes = await db.collection("approval_requests").indexes();
    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain("asset_team_status");
    expect(indexNames).toContain("status_team_created");
  });

  it("copilot_conversations collection has correct indexes including TTL", async () => {
    const db = await getTestDb();
    const indexes = await db.collection("copilot_conversations").indexes();
    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain("team_user_updated");
    const ttlIdx = indexes.find((i) => i.name === "conversation_ttl");
    expect(ttlIdx).toBeDefined();
    expect((ttlIdx as { expireAfterSeconds?: number }).expireAfterSeconds).toBe(2592000);
  });

  it("metrics_snapshots collection has scope-based index (scopeType + scopeId + takenAt)", async () => {
    const db = await getTestDb();
    const indexes = await db.collection("metrics_snapshots").indexes();
    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain("scope_takenAt");
    // Verify key shape
    const idx = indexes.find((i) => i.name === "scope_takenAt");
    expect(idx).toBeDefined();
    const key = (idx as { key?: Record<string, number> }).key;
    expect(key).toHaveProperty("scopeType");
    expect(key).toHaveProperty("scopeId");
    expect(key).toHaveProperty("takenAt");
  });

  it("metrics_snapshots validator requires scopeType, scopeId, metrics, takenAt", async () => {
    const db = await getTestDb();
    const col = await db.listCollections({ name: "metrics_snapshots" }, { nameOnly: false }).toArray();
    expect(col[0]).toBeDefined();
    const schema = (col[0] as { options?: { validator?: { $jsonSchema?: { required?: string[]; properties?: Record<string, unknown> } } } }).options?.validator?.$jsonSchema;
    expect(schema).toBeDefined();
    expect(schema?.required).toContain("scopeType");
    expect(schema?.required).toContain("scopeId");
    expect(schema?.required).toContain("metrics");
    expect(schema?.required).toContain("takenAt");
    // Must NOT have old field names
    expect(schema?.required).not.toContain("orgId");
    expect(schema?.required).not.toContain("timestamp");
  });

  it("approval_requests validator includes 'withdrawn' in status enum", async () => {
    const db = await getTestDb();
    const col = await db.listCollections({ name: "approval_requests" }, { nameOnly: false }).toArray();
    expect(col[0]).toBeDefined();
    const schema = (col[0] as { options?: { validator?: { $jsonSchema?: { properties?: { status?: { enum?: string[] } } } } } }).options?.validator?.$jsonSchema;
    expect(schema).toBeDefined();
    expect(schema?.properties?.status?.enum).toContain("withdrawn");
  });

  it("webhooks validator has orgId required and stats property", async () => {
    const db = await getTestDb();
    const col = await db.listCollections({ name: "webhooks" }, { nameOnly: false }).toArray();
    expect(col[0]).toBeDefined();
    const schema = (col[0] as { options?: { validator?: { $jsonSchema?: { required?: string[]; properties?: Record<string, unknown> } } } }).options?.validator?.$jsonSchema;
    expect(schema).toBeDefined();
    expect(schema?.required).toContain("orgId");
    expect(schema?.required).not.toContain("teamId");
    expect(schema?.properties).toHaveProperty("orgId");
    expect(schema?.properties).toHaveProperty("stats");
  });

  it("feed_read_cursors collection has unique compound index on userId+teamId", async () => {
    const db = await getTestDb();
    const indexes = await db.collection("feed_read_cursors").indexes();
    const idx = indexes.find((i) => i.name === "user_team_cursor");
    expect(idx).toBeDefined();
    expect((idx as { unique?: boolean }).unique).toBe(true);
  });

  it("mentions collection has correct index", async () => {
    const db = await getTestDb();
    const indexes = await db.collection("mentions").indexes();
    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain("user_read_created");
  });

  it("sso_configs collection has unique org index", async () => {
    const db = await getTestDb();
    const indexes = await db.collection("sso_configs").indexes();
    const idx = indexes.find((i) => i.name === "org_sso_unique");
    expect(idx).toBeDefined();
    expect((idx as { unique?: boolean }).unique).toBe(true);
  });

  it("scim_sync_status collection has unique org index", async () => {
    const db = await getTestDb();
    const indexes = await db.collection("scim_sync_status").indexes();
    const idx = indexes.find((i) => i.name === "org_scim_unique");
    expect(idx).toBeDefined();
    expect((idx as { unique?: boolean }).unique).toBe(true);
  });

  it("webhooks collection has correct indexes", async () => {
    const db = await getTestDb();
    const indexes = await db.collection("webhooks").indexes();
    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain("team_webhooks");
  });

  it("is idempotent — running twice does not throw", async () => {
    const db = await getTestDb();
    await setupDatabase(db);
    // If we reach here, no error was thrown on second run
    expect(true).toBe(true);
  });
});
