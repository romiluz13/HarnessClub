/**
 * Vitest global setup — runs ONCE before the entire test suite.
 *
 * 1. Runs setupDatabase() to create collections, validators, regular + search indexes
 * 2. Waits for Atlas Search indexes to reach READY status
 * 3. Inserts search fixture document with real Voyage AI embedding
 * 4. Verifies fixture is searchable via $search
 *
 * Works with both Atlas M0 and atlas-local:preview Docker.
 */

import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import { setupDatabase } from "../../src/lib/setup-db";

dotenv.config({ path: ".env.test" });

/**
 * Stable IDs — same across all test runs.
 * Must match the IDs used in tests/integration/search.test.ts.
 */
export const SEARCH_FIXTURE_SKILL_ID = new ObjectId("aaa111bbb222ccc333ddd444");
export const SEARCH_FIXTURE_TEAM_ID = new ObjectId("fff666eee555ddd444ccc333");

export async function setup(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || "skillshub_test";
  if (!uri) throw new Error("MONGODB_URI not set in .env.test");

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  // Step 1: Ensure all collections, validators, regular indexes exist
  console.log("[global-setup] Running setupDatabase()...");
  await setupDatabase(db);
  console.log("[global-setup] Database setup complete.");

  // Step 2: Wait for search indexes to become READY
  console.log("[global-setup] Waiting for search indexes to reach READY...");
  await waitForSearchIndexes(db, ["assets_search", "assets_vector"]);

  // Step 3: Insert fixture with real Voyage AI embedding
  const coll = db.collection("assets");
  const existing = await coll.findOne({ _id: SEARCH_FIXTURE_SKILL_ID });

  if (!existing) {
    console.log("[global-setup] Inserting search fixture document...");
    const apiKey = process.env.VOYAGE_API_KEY;
    if (!apiKey) throw new Error("VOYAGE_API_KEY required for tests");

    const embeddingText = "MongoDB schema design best practices for document databases";
    const response = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "voyage-3-lite", input: [embeddingText], input_type: "document" }),
    });
    if (!response.ok) throw new Error(`Voyage API error: ${response.status}`);
    const data = (await response.json()) as { data: Array<{ embedding: number[] }> };

    const fixtureName = "MongoDB Schema Guide";
    const fixtureDesc = "Best practices for schema design in MongoDB document databases";
    const fixtureContent = "# MongoDB Schema Design\n\nEmbed for 1:1 and 1:few. Reference for 1:many and many:many.";
    const fixtureTags = ["mongodb", "schema", "guide"];
    await coll.insertOne({
      _id: SEARCH_FIXTURE_SKILL_ID,
      _searchFixture: true,
      type: "skill",
      teamId: SEARCH_FIXTURE_TEAM_ID,
      metadata: { name: fixtureName, description: fixtureDesc },
      content: fixtureContent,
      tags: fixtureTags,
      searchText: `Name: ${fixtureName}\n\nDescription: ${fixtureDesc}\n\nTags: ${fixtureTags.join(", ")}\n\nContent:\n${fixtureContent}`,
      embedding: data.data[0].embedding,
      stats: { installCount: 0, viewCount: 0 },
      isPublished: true,
      createdBy: new ObjectId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log("[global-setup] Fixture inserted.");
  } else {
    console.log("[global-setup] Search fixture already exists.");
  }

  // Step 4: Verify fixture is searchable via $search
  console.log("[global-setup] Verifying fixture is in Atlas Search index...");
  const syncStart = Date.now();
  const syncMaxWait = 5 * 60 * 1000;
  let isSearchable = false;

  while (Date.now() - syncStart < syncMaxWait) {
    try {
      const results = await coll.aggregate([
        { $search: { index: "assets_search", text: { query: "MongoDB Schema", path: ["metadata.name", "metadata.description"] } } },
        { $limit: 10 },
        { $project: { _id: 1 } },
      ]).toArray();
      if (results.find((r) => r._id.equals(SEARCH_FIXTURE_SKILL_ID))) { isSearchable = true; break; }
    } catch { /* Index might not be ready */ }
    const elapsed = Math.round((Date.now() - syncStart) / 1000);
    console.log(`[global-setup] Waiting for Atlas Search sync... ${elapsed}s`);
    await new Promise((r) => setTimeout(r, 5000));
  }

  if (isSearchable) {
    console.log("[global-setup] Atlas Search fixture verified — ready for tests!");
  } else {
    throw new Error("[global-setup] Atlas Search fixture NOT searchable after 5 minutes.");
  }

  await client.close();
}

/**
 * Wait for all named search indexes to reach READY status.
 * atlas-local:preview takes ~10-30s to build search indexes.
 */
async function waitForSearchIndexes(db: import("mongodb").Db, indexNames: string[]): Promise<void> {
  const coll = db.collection("assets");
  const maxWait = 120_000; // 2 minutes
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    try {
      const indexes = await coll.listSearchIndexes().toArray();
      const ready = indexNames.every((name) => {
        const idx = indexes.find((i) => i.name === name) as Record<string, unknown> | undefined;
        return idx && (idx.status === "READY" || idx.queryable === true);
      });
      if (ready) {
        console.log(`[global-setup] All search indexes READY: ${indexNames.join(", ")}`);
        return;
      }
      const statuses = indexNames.map((name) => {
        const idx = indexes.find((i) => i.name === name) as Record<string, unknown> | undefined;
        return `${name}=${idx ? (idx.status as string) || "EXISTS" : "NOT_FOUND"}`;
      });
      console.log(`[global-setup] Search index status: ${statuses.join(", ")}`);
    } catch (err) {
      console.log(`[global-setup] listSearchIndexes error: ${(err as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(`[global-setup] Search indexes not READY after ${maxWait / 1000}s`);
}
