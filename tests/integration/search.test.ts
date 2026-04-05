/**
 * Integration test: Search pipeline end-to-end against real Atlas.
 * Tests semantic + lexical search with real embeddings.
 * NO SKIPS — uses a persistent "search fixture" doc that survives across runs,
 * giving Atlas Search indexes time to sync it.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ObjectId, type Collection } from "mongodb";
import { getTestDb, closeTestDb } from "../helpers/db-setup";
import { generateEmbedding } from "../../src/lib/voyage";

/**
 * Stable IDs for the search fixture document — same across all test runs.
 * This lets Atlas Search/Vector Search index the doc ONCE, and subsequent
 * test runs find it immediately without waiting for index sync.
 */
const FIXTURE_SKILL_ID = new ObjectId("aaa111bbb222ccc333ddd444");
const FIXTURE_TEAM_ID = new ObjectId("fff666eee555ddd444ccc333");

const POLL_INTERVAL_MS = 3_000;
const MAX_POLL_MS = 120_000; // 120s — M0 free tier can be slow to index

/**
 * Poll until a specific document appears in search results.
 * Atlas Search indexes on M0 can take 10-120s to sync new documents.
 */
interface SearchMatch {
  _id: ObjectId;
  metadata?: {
    name?: string;
  };
  score?: number;
}

async function waitForDocInSearch(
  coll: Collection,
  pipeline: Record<string, unknown>[],
  targetId: ObjectId,
  label: string
): Promise<SearchMatch> {
  const start = Date.now();
  let lastResultCount = 0;
  while (Date.now() - start < MAX_POLL_MS) {
    const results = await coll.aggregate<SearchMatch>(pipeline).toArray();
    lastResultCount = results.length;
    const match = results.find((result) => result._id.equals(targetId));
    if (match) return match;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(
    `${label}: target doc not found after ${MAX_POLL_MS / 1000}s of polling (last poll returned ${lastResultCount} results)`
  );
}

describe("Search Pipeline — real Atlas", () => {
  let queryEmbedding: number[];

  beforeAll(async () => {
    // Fixture doc is inserted by globalSetup (tests/helpers/global-setup.ts).
    // It persists across runs so Atlas Search has time to index it.
    queryEmbedding = await generateEmbedding("schema design patterns", "query");
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("embedding was stored correctly", async () => {
    const db = await getTestDb();
    const doc = await db.collection("assets").findOne({ _id: FIXTURE_SKILL_ID });
    expect(doc).not.toBeNull();
    expect(doc!.embedding).toBeDefined();
    expect(doc!.embedding.length).toBe(512);
  });

  it("$vectorSearch finds the skill by semantic similarity", async () => {
    const db = await getTestDb();
    const coll = db.collection("assets");

    const pipeline = [
      {
        $vectorSearch: {
          index: "assets_vector",
          path: "embedding",
          queryVector: queryEmbedding,
          numCandidates: 100,
          limit: 50,
        },
      },
      {
        $project: {
          _id: 1,
          "metadata.name": 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
    ];

    const match = await waitForDocInSearch(coll, pipeline, FIXTURE_SKILL_ID, "$vectorSearch");
    expect(match.score).toBeGreaterThan(0);
    expect(match.metadata?.name).toBe("MongoDB Schema Guide");
  });

  it("$search lexical finds the skill by text match", async () => {
    const db = await getTestDb();
    const coll = db.collection("assets");

    const pipeline = [
      {
        $search: {
          index: "assets_search",
          text: {
            query: "MongoDB Schema",
            path: ["metadata.name", "metadata.description"],
          },
        },
      },
      { $limit: 50 },
      {
        $project: {
          _id: 1,
          "metadata.name": 1,
          score: { $meta: "searchScore" },
        },
      },
    ];

    const match = await waitForDocInSearch(coll, pipeline, FIXTURE_SKILL_ID, "$search");
    expect(match.metadata?.name).toBe("MongoDB Schema Guide");
  });
});
