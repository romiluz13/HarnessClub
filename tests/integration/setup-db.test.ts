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

  it("is idempotent — running twice does not throw", async () => {
    const db = await getTestDb();
    await setupDatabase(db);
    // If we reach here, no error was thrown on second run
    expect(true).toBe(true);
  });
});
