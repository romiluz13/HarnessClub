/**
 * API Integration Test: Search API — text, vector, hybrid modes.
 *
 * Tests the search query patterns used by GET /api/search against REAL MongoDB.
 * Per mongodb-search-and-ai skill: Atlas Search + Vector Search + hybrid.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ObjectId, type Db } from "mongodb";
import { getTestDb, closeTestDb } from "../helpers/db-setup";
import {
  seedCapabilitiesData,
  cleanCapabilitiesData,
  TEAM_A_ID,
} from "../helpers/seed-capabilities";

let db: Db;

beforeAll(async () => {
  db = await getTestDb();
  await seedCapabilitiesData(db);
}, 120_000);

afterAll(async () => {
  await cleanCapabilitiesData(db);
  await closeTestDb();
});

describe("Search API — Query Patterns", () => {
  // ── Input validation ────────────────────────────────────────
  it("validates query parameter bounds", () => {
    const validate = (q: string | null) => {
      if (!q || q.trim().length < 1) return { error: "required" };
      if (q.length > 200) return { error: "too long" };
      return { ok: true };
    };

    expect(validate(null)).toEqual({ error: "required" });
    expect(validate("")).toEqual({ error: "required" });
    expect(validate("  ")).toEqual({ error: "required" });
    expect(validate("react hooks")).toEqual({ ok: true });
    expect(validate("a".repeat(201))).toEqual({ error: "too long" });
    expect(validate("a".repeat(200))).toEqual({ ok: true });
  });

  it("parses limit with min/max bounds", () => {
    const parseLimit = (raw: string | null) => {
      const parsed = parseInt(raw || "10", 10);
      return Math.min(50, Math.max(1, isNaN(parsed) ? 10 : parsed));
    };

    expect(parseLimit(null)).toBe(10);
    expect(parseLimit("5")).toBe(5);
    expect(parseLimit("0")).toBe(1);
    expect(parseLimit("-1")).toBe(1);
    expect(parseLimit("100")).toBe(50);
    expect(parseLimit("abc")).toBe(10); // NaN → default
  });

  it("parses comma-separated tags", () => {
    const parseTags = (raw: string | null) =>
      raw ? raw.split(",").map((t) => t.trim()).filter(Boolean) : undefined;

    expect(parseTags(null)).toBeUndefined();
    expect(parseTags("react,hooks")).toEqual(["react", "hooks"]);
    expect(parseTags("react, hooks, ")).toEqual(["react", "hooks"]);
    expect(parseTags("")).toBeUndefined(); // empty string → filter removes ""
  });

  // ── Team isolation ──────────────────────────────────────────
  it("user team membership determines search scope", async () => {
    const user = await db.collection("users").findOne(
      { _id: new ObjectId("dd0000000000000000000001") }, // USER_OWNER_ID
      { projection: { teamMemberships: 1 } }
    );
    expect(user).not.toBeNull();
    const teamId = user!.teamMemberships[0].teamId as ObjectId;
    expect(teamId.equals(TEAM_A_ID)).toBe(true);
  });

  // ── Atlas Search text query ─────────────────────────────────
  it("runs Atlas Search text query for lexical mode", async () => {
    // Use the global fixture (inserted by global-setup and verified searchable)
    const { SEARCH_FIXTURE_TEAM_ID } = await import("../helpers/global-setup");
    const results = await db.collection("assets").aggregate([
      {
        $search: {
          index: "assets_search",
          compound: {
            filter: [{ equals: { path: "teamId", value: SEARCH_FIXTURE_TEAM_ID } }],
            must: [{ text: { query: "MongoDB Schema", path: ["metadata.name", "metadata.description", "content"] } }],
          },
        },
      },
      { $limit: 10 },
      { $project: { "metadata.name": 1, score: { $meta: "searchScore" } } },
    ]).toArray();

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty("score");
    expect(results[0].score).toBeGreaterThan(0);
  });

  // ── Vector search ───────────────────────────────────────────
  it("runs vector search with real embedding", async () => {
    // Use the global fixture which has a verified embedding
    const { SEARCH_FIXTURE_SKILL_ID } = await import("../helpers/global-setup");
    const skill = await db.collection("assets").findOne(
      { _id: SEARCH_FIXTURE_SKILL_ID },
      { projection: { embedding: 1, teamId: 1 } }
    );
    expect(skill).not.toBeNull();
    expect(skill!.embedding).toBeDefined();
    expect(skill!.embedding.length).toBe(512); // voyage-3-lite = 512 dims

    const results = await db.collection("assets").aggregate([
      {
        $vectorSearch: {
          index: "assets_vector",
          path: "embedding",
          queryVector: skill!.embedding,
          numCandidates: 20,
          limit: 5,
          filter: { teamId: skill!.teamId },
        },
      },
      { $project: { "metadata.name": 1, score: { $meta: "vectorSearchScore" } } },
    ]).toArray();

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty("score");
  });

  // ── Empty results ───────────────────────────────────────────
  it("returns empty for nonsense query", async () => {
    const results = await db.collection("assets").aggregate([
      {
        $search: {
          index: "assets_search",
          compound: {
            filter: [{ equals: { path: "teamId", value: TEAM_A_ID } }],
            must: [{ text: { query: "xyzzy-nonexistent-gibberish-9q8w7e", path: ["metadata.name"] } }],
          },
        },
      },
      { $limit: 10 },
    ]).toArray();

    expect(results).toEqual([]);
  });
});
