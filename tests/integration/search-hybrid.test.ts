/**
 * Integration test: Hybrid search with $rankFusion + app-level RRF fallback.
 *
 * Tests against real MongoDB Atlas M0 (where $rankFusion is NOT available).
 * On M0: hybridSearch() falls back to app-level RRF automatically.
 * On atlas-local:preview: hybridSearch() uses native $rankFusion.
 *
 * Uses the persistent search fixture from global-setup.ts:
 *   - FIXTURE_TEAM_ID: fff666eee555ddd444ccc333
 *   - Skill: "MongoDB Schema Guide" with embedding + content about schema design
 *
 * NO SKIPS. All tests must pass on M0.
 */

import { describe, it, expect, afterAll } from "vitest";
import { ObjectId } from "mongodb";
import { getTestDb, closeTestDb } from "../helpers/db-setup";
import { hybridSearch, reciprocalRankFusion } from "../../src/services/search-hybrid";
import type { SearchResult } from "../../src/services/search";

/** Same fixture IDs as search.test.ts and global-setup.ts */
const FIXTURE_TEAM_ID = new ObjectId("fff666eee555ddd444ccc333");

describe("Hybrid Search — real Atlas M0", () => {
  afterAll(async () => {
    await closeTestDb();
  });

  // ── reciprocalRankFusion pure logic ──────────────────────────────────

  it("RRF merges two result lists correctly", () => {
    const listA: SearchResult[] = [
      { assetId: "aaa", skillId: "aaa", type: "skill", name: "Skill A", description: "d", tags: [], score: 10 },
      { assetId: "bbb", skillId: "bbb", type: "skill", name: "Skill B", description: "d", tags: [], score: 8 },
      { assetId: "ccc", skillId: "ccc", type: "skill", name: "Skill C", description: "d", tags: [], score: 5 },
    ];
    const listB: SearchResult[] = [
      { assetId: "bbb", skillId: "bbb", type: "skill", name: "Skill B", description: "d", tags: [], score: 9 },
      { assetId: "ddd", skillId: "ddd", type: "skill", name: "Skill D", description: "d", tags: [], score: 7 },
      { assetId: "aaa", skillId: "aaa", type: "skill", name: "Skill A", description: "d", tags: [], score: 3 },
    ];

    const merged = reciprocalRankFusion([listA, listB], 10);

    // "bbb" appears in both lists (rank 1 in A, rank 0 in B) — should be boosted highest
    expect(merged[0].skillId).toBe("bbb");
    // "aaa" also appears in both lists (rank 0 in A, rank 2 in B) — second highest
    expect(merged[1].skillId).toBe("aaa");
    // All 4 unique skills should appear
    expect(merged).toHaveLength(4);
    // Scores should be positive and descending
    for (let i = 1; i < merged.length; i++) {
      expect(merged[i - 1].score).toBeGreaterThanOrEqual(merged[i].score);
    }
  });

  it("RRF respects limit", () => {
    const list: SearchResult[] = Array.from({ length: 20 }, (_, i) => ({
      assetId: `s${i}`, skillId: `s${i}`, type: "skill" as const, name: `Skill ${i}`, description: "d", tags: [], score: 20 - i,
    }));
    const merged = reciprocalRankFusion([list], 5);
    expect(merged).toHaveLength(5);
    expect(merged[0].skillId).toBe("s0"); // highest ranked stays first
  });

  it("RRF handles empty lists", () => {
    const merged = reciprocalRankFusion([[], []], 10);
    expect(merged).toHaveLength(0);
  });

  it("RRF merges highlights from both lists", () => {
    const listA: SearchResult[] = [
      { assetId: "x", skillId: "x", type: "skill" as const, name: "X", description: "d", tags: [], score: 1, highlights: ["match-A"] },
    ];
    const listB: SearchResult[] = [
      { assetId: "x", skillId: "x", type: "skill" as const, name: "X", description: "d", tags: [], score: 1, highlights: ["match-B"] },
    ];
    const merged = reciprocalRankFusion([listA, listB], 10);
    expect(merged[0].highlights).toContain("match-A");
    expect(merged[0].highlights).toContain("match-B");
  });

  // ── hybridSearch end-to-end on M0 (fallback path) ───────────────────

  it("hybridSearch returns results for the search fixture (mode=hybrid)", async () => {
    const db = await getTestDb();
    const results = await hybridSearch(db, {
      teamId: FIXTURE_TEAM_ID,
      query: "MongoDB schema design patterns",
      mode: "hybrid",
      limit: 10,
    });

    // Should find our fixture doc via both lexical AND semantic paths
    expect(results.length).toBeGreaterThan(0);
    const fixture = results.find((r) => r.name === "MongoDB Schema Guide");
    expect(fixture).toBeDefined();
    expect(fixture!.score).toBeGreaterThan(0);
  });

  it("hybridSearch mode=lexical delegates to lexicalSearch only", async () => {
    const db = await getTestDb();
    // lexicalSearch uses compound with text + equals filter on teamId.
    // Requires teamId to be indexed as objectId type in the assets_search index.
    const results = await hybridSearch(db, {
      teamId: FIXTURE_TEAM_ID,
      query: "MongoDB Schema Guide",
      mode: "lexical",
      limit: 10,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe("MongoDB Schema Guide");
  });

  it("hybridSearch mode=semantic delegates to semanticSearch only", async () => {
    const db = await getTestDb();
    const results = await hybridSearch(db, {
      teamId: FIXTURE_TEAM_ID,
      query: "database design best practices",
      mode: "semantic",
      limit: 10,
    });

    expect(results.length).toBeGreaterThan(0);
    // Semantic search should find our doc even with different wording
    const fixture = results.find((r) => r.name === "MongoDB Schema Guide");
    expect(fixture).toBeDefined();
  });

  it("hybridSearch returns low-score results for non-matching query", async () => {
    const db = await getTestDb();
    // $vectorSearch always returns nearest neighbors even for gibberish queries,
    // so hybrid search won't be empty — but scores should be very low.
    const goodResults = await hybridSearch(db, {
      teamId: FIXTURE_TEAM_ID,
      query: "MongoDB schema design patterns",
      mode: "hybrid",
      limit: 10,
    });
    const poorResults = await hybridSearch(db, {
      teamId: FIXTURE_TEAM_ID,
      query: "xyzzyplughtwisty99999",
      mode: "hybrid",
      limit: 10,
    });

    // Good query should score higher than gibberish
    if (goodResults.length > 0 && poorResults.length > 0) {
      expect(goodResults[0].score).toBeGreaterThan(poorResults[0].score);
    }
  });

  it("hybridSearch respects team isolation — wrong teamId returns no results", async () => {
    const db = await getTestDb();
    const fakeTeamId = new ObjectId("000000000000000000000099");
    const results = await hybridSearch(db, {
      teamId: fakeTeamId,
      query: "MongoDB schema design",
      mode: "hybrid",
      limit: 10,
    });
    expect(results).toHaveLength(0);
  });

  // ── $rankFusion native support on atlas-local:preview ───────────────

  it("$rankFusion works natively on atlas-local:preview (8.2+)", async () => {
    const db = await getTestDb();

    // Direct $rankFusion pipeline — should SUCCEED on atlas-local:preview 8.2+
    const pipeline = [
      {
        $rankFusion: {
          input: {
            pipelines: {
              lexical: [
                {
                  $search: {
                    index: "assets_search",
                    text: { query: "MongoDB Schema", path: ["metadata.name", "metadata.description"] },
                  },
                },
                { $limit: 5 },
              ],
            },
          },
        },
      },
      { $limit: 5 },
      { $project: { _id: 1, "metadata.name": 1 } },
    ];

    // Must NOT throw — $rankFusion is supported natively
    const results = await db.collection("assets").aggregate(pipeline).toArray();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty("metadata");

    // hybridSearch should also work (uses $rankFusion internally)
    const hybridResults = await hybridSearch(db, {
      teamId: FIXTURE_TEAM_ID,
      query: "MongoDB schema",
      mode: "hybrid",
      limit: 5,
    });
    expect(hybridResults.length).toBeGreaterThan(0);
  });

  it("hybridSearch results have correct shape", async () => {
    const db = await getTestDb();
    const results = await hybridSearch(db, {
      teamId: FIXTURE_TEAM_ID,
      query: "schema design",
      mode: "hybrid",
      limit: 5,
    });

    expect(results.length).toBeGreaterThan(0);
    const result = results[0];
    // Verify shape matches SearchResult interface
    expect(typeof result.assetId).toBe("string");
    expect(typeof result.type).toBe("string");
    expect(typeof result.name).toBe("string");
    expect(typeof result.description).toBe("string");
    expect(Array.isArray(result.tags)).toBe(true);
    expect(typeof result.score).toBe("number");
    expect(result.score).toBeGreaterThan(0);
    expect(result.assetId.length).toBe(24); // ObjectId hex string
  });
});
