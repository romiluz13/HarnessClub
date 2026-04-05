/**
 * API Integration Test: Skills CRUD — pagination, filtering, sorting.
 *
 * Tests the skills query patterns used by GET /api/skills against REAL MongoDB.
 * Per api-security-best-practices: typed responses, pagination bounds.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ObjectId, type Db } from "mongodb";
import { getTestDb, closeTestDb } from "../helpers/db-setup";
import {
  seedCapabilitiesData,
  cleanCapabilitiesData,
  TEAM_A_ID,
  TEAM_B_ID,
  USER_OWNER_ID,
  CAP_TEST_MARKER,
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

describe("Skills API — Query Patterns", () => {
  // ── Pagination ──────────────────────────────────────────────
  it("paginates skills with limit and skip", async () => {
    const limit = 3;
    const page = 1;
    const skip = (page - 1) * limit;

    const [skills, total] = await Promise.all([
      db.collection("assets")
        .find({ teamId: TEAM_A_ID, [CAP_TEST_MARKER]: true }, { projection: { content: 0, embedding: 0 } })
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection("assets").countDocuments({ teamId: TEAM_A_ID, [CAP_TEST_MARKER]: true }),
    ]);

    expect(skills.length).toBeLessThanOrEqual(limit);
    expect(total).toBeGreaterThanOrEqual(skills.length);
  });

  it("page 2 returns different skills than page 1", async () => {
    const limit = 3;
    const filter = { teamId: TEAM_A_ID, [CAP_TEST_MARKER]: true };

    const page1 = await db.collection("assets")
      .find(filter, { projection: { _id: 1 } })
      .sort({ updatedAt: -1 })
      .skip(0).limit(limit).toArray();

    const page2 = await db.collection("assets")
      .find(filter, { projection: { _id: 1 } })
      .sort({ updatedAt: -1 })
      .skip(limit).limit(limit).toArray();

    if (page2.length > 0) {
      const page1Ids = new Set(page1.map((s) => s._id.toHexString()));
      page2.forEach((s) => {
        expect(page1Ids.has(s._id.toHexString())).toBe(false);
      });
    }
  });

  // ── Sorting ─────────────────────────────────────────────────
  it("sorts skills by updatedAt descending", async () => {
    const skills = await db.collection("assets")
      .find({ teamId: TEAM_A_ID, [CAP_TEST_MARKER]: true })
      .sort({ updatedAt: -1 })
      .limit(5)
      .toArray();

    for (let i = 1; i < skills.length; i++) {
      expect(skills[i - 1].updatedAt.getTime()).toBeGreaterThanOrEqual(
        skills[i].updatedAt.getTime()
      );
    }
  });

  // ── Projection ──────────────────────────────────────────────
  it("excludes content and embedding from list query", async () => {
    const skills = await db.collection("assets")
      .find(
        { teamId: TEAM_A_ID, [CAP_TEST_MARKER]: true },
        { projection: { content: 0, embedding: 0 } }
      )
      .limit(3)
      .toArray();

    skills.forEach((s) => {
      expect(s).not.toHaveProperty("content");
      expect(s).not.toHaveProperty("embedding");
      expect(s).toHaveProperty("metadata");
      expect(s).toHaveProperty("tags");
      expect(s).toHaveProperty("stats");
    });
  });

  // ── Multi-team query ────────────────────────────────────────
  it("fetches skills from multiple teams with $in", async () => {
    const teamIds = [TEAM_A_ID, TEAM_B_ID];
    const skills = await db.collection("assets")
      .find({ teamId: { $in: teamIds }, [CAP_TEST_MARKER]: true })
      .toArray();

    const teams = new Set(skills.map((s) => s.teamId.toHexString()));
    expect(teams.size).toBeGreaterThanOrEqual(2);
  });

  // ── Empty result for no teams ───────────────────────────────
  it("returns empty array for user with no teams", async () => {
    const skills = await db.collection("assets")
      .find({ teamId: { $in: [] } })
      .toArray();
    expect(skills).toEqual([]);
  });

  // ── Serialization ───────────────────────────────────────────
  it("skill documents have required fields for serialization", async () => {
    const skill = await db.collection("assets").findOne({
      teamId: TEAM_A_ID,
      [CAP_TEST_MARKER]: true,
    });
    expect(skill).not.toBeNull();
    expect(skill!._id).toBeInstanceOf(ObjectId);
    expect(skill!.metadata.name).toBeTruthy();
    expect(skill!.metadata.description).toBeTruthy();
    expect(Array.isArray(skill!.tags)).toBe(true);
    expect(typeof skill!.stats.installCount).toBe("number");
    expect(typeof skill!.stats.viewCount).toBe("number");
    expect(typeof skill!.isPublished).toBe("boolean");
    expect(skill!.createdAt).toBeInstanceOf(Date);
    expect(skill!.updatedAt).toBeInstanceOf(Date);
  });
});
