/**
 * MongoDB Capabilities Test — Aggregation Pipeline (9.x, 10.x, 15.x).
 *
 * Tests $group, $unwind, $lookup, $facet, $bucket, $graphLookup,
 * $setWindowFields, $merge, $sample, $sortByCount, $unionWith,
 * plus aggregation expressions ($sum, $avg, $dateToString, etc.).
 *
 * All tests run against REAL Atlas M0 with seeded data.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Db } from "mongodb";
import { getTestDb, closeTestDb } from "../helpers/db-setup";
import {
  seedCapabilitiesData,
  cleanCapabilitiesData,
  TEAM_A_ID,
  SKILL_IDS,
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

describe("9.x Aggregation — Core Stages", () => {
  it("9.3 $group — total installs by team", async () => {
    const results = await db.collection("assets").aggregate([
      { $match: { [CAP_TEST_MARKER]: true } },
      { $group: { _id: "$teamId", totalInstalls: { $sum: "$stats.installCount" } } },
      { $sort: { totalInstalls: -1 } },
    ]).toArray();
    expect(results.length).toBe(3);
    // Team A has the most skills → most installs
    expect(results[0]._id.equals(TEAM_A_ID)).toBe(true);
    expect(results[0].totalInstalls).toBeGreaterThan(0);
  });

  it("9.7 $unwind — flatten tags for tag cloud", async () => {
    const results = await db.collection("assets").aggregate([
      { $match: { teamId: TEAM_A_ID, [CAP_TEST_MARKER]: true } },
      { $unwind: "$tags" },
      { $group: { _id: "$tags", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]).toArray();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty("_id");
    expect(results[0]).toHaveProperty("count");
    // "frontend" appears in many Team A skills
    const frontendTag = results.find((r) => r._id === "frontend");
    expect(frontendTag).toBeDefined();
    expect(frontendTag!.count).toBeGreaterThanOrEqual(4);
  });

  it("9.8 $lookup — join skills with teams", async () => {
    const results = await db.collection("assets").aggregate([
      { $match: { _id: SKILL_IDS.reactHooks } },
      {
        $lookup: {
          from: "teams",
          localField: "teamId",
          foreignField: "_id",
          as: "team",
        },
      },
      { $unwind: "$team" },
    ]).toArray();
    expect(results.length).toBe(1);
    expect(results[0].team.name).toBe("Frontend Masters");
  });

  it("9.6 $skip + 9.5 $limit — offset pagination", async () => {
    const page1 = await db.collection("assets").aggregate([
      { $match: { teamId: TEAM_A_ID, [CAP_TEST_MARKER]: true } },
      { $sort: { "stats.installCount": -1 } },
      { $skip: 0 }, { $limit: 3 },
    ]).toArray();
    const page2 = await db.collection("assets").aggregate([
      { $match: { teamId: TEAM_A_ID, [CAP_TEST_MARKER]: true } },
      { $sort: { "stats.installCount": -1 } },
      { $skip: 3 }, { $limit: 3 },
    ]).toArray();
    expect(page1.length).toBe(3);
    expect(page2.length).toBe(3);
    // Pages should not overlap
    const ids1 = new Set(page1.map((r) => r._id.toString()));
    page2.forEach((r) => expect(ids1.has(r._id.toString())).toBe(false));
  });

  it("9.9 $addFields — computed isPopular flag", async () => {
    const results = await db.collection("assets").aggregate([
      { $match: { teamId: TEAM_A_ID, [CAP_TEST_MARKER]: true } },
      {
        $addFields: {
          isPopular: { $gte: ["$stats.installCount", 200] },
        },
      },
    ]).toArray();
    expect(results.length).toBeGreaterThan(0);
    const popular = results.filter((r) => r.isPopular);
    const unpopular = results.filter((r) => !r.isPopular);
    expect(popular.length).toBeGreaterThan(0);
    expect(unpopular.length).toBeGreaterThan(0);
    popular.forEach((r) => expect(r.stats.installCount).toBeGreaterThanOrEqual(200));
  });

  it("9.11 $count — total matching", async () => {
    const results = await db.collection("assets").aggregate([
      { $match: { teamId: TEAM_A_ID, [CAP_TEST_MARKER]: true } },
      { $count: "total" },
    ]).toArray();
    expect(results[0].total).toBeGreaterThanOrEqual(10);
  });

  it("9.12 $sample — random skills", async () => {
    const results = await db.collection("assets").aggregate([
      { $match: { [CAP_TEST_MARKER]: true } },
      { $sample: { size: 3 } },
    ]).toArray();
    expect(results.length).toBe(3);
  });

  it("9.17 $sortByCount — most popular tags", async () => {
    const results = await db.collection("assets").aggregate([
      { $match: { [CAP_TEST_MARKER]: true } },
      { $unwind: "$tags" },
      { $sortByCount: "$tags" },
      { $limit: 5 },
    ]).toArray();
    expect(results.length).toBe(5);
    // Results sorted by count desc
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].count).toBeGreaterThanOrEqual(results[i].count);
    }
  });
});


describe("10.x Aggregation — Advanced Stages", () => {
  it("10.1 $facet — results + tag counts + total in one query", async () => {
    const results = await db.collection("assets").aggregate([
      { $match: { teamId: TEAM_A_ID, [CAP_TEST_MARKER]: true } },
      {
        $facet: {
          results: [{ $sort: { "stats.installCount": -1 } }, { $limit: 5 }],
          tagCloud: [
            { $unwind: "$tags" },
            { $group: { _id: "$tags", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
          totalCount: [{ $count: "total" }],
        },
      },
    ]).toArray();
    expect(results[0].results.length).toBe(5);
    expect(results[0].tagCloud.length).toBeGreaterThan(0);
    expect(results[0].totalCount[0].total).toBeGreaterThanOrEqual(10);
  });

  it("10.2 $bucket — install count histogram", async () => {
    const results = await db.collection("assets").aggregate([
      { $match: { [CAP_TEST_MARKER]: true } },
      {
        $bucket: {
          groupBy: "$stats.installCount",
          boundaries: [0, 100, 200, 300, 500, 1000],
          default: "1000+",
          output: { count: { $sum: 1 }, skills: { $push: "$metadata.name" } },
        },
      },
    ]).toArray();
    expect(results.length).toBeGreaterThan(0);
    const totalSkills = results.reduce((sum: number, b: Record<string, number>) => sum + b.count, 0);
    expect(totalSkills).toBeGreaterThanOrEqual(15);
  });

  it("10.4 $graphLookup — skill dependency tree", async () => {
    const results = await db.collection("assets").aggregate([
      { $match: { _id: SKILL_IDS.webFundamentals } },
      {
        $graphLookup: {
          from: "assets",
          startWith: "$_id",
          connectFromField: "_id",
          connectToField: "parentSkillId",
          as: "dependents",
          maxDepth: 3,
        },
      },
    ]).toArray();
    expect(results.length).toBe(1);
    const dependentNames = results[0].dependents.map(
      (d: Record<string, unknown>) => (d.metadata as Record<string, unknown>).name
    );
    expect(dependentNames).toContain("CSS Fundamentals");
    expect(dependentNames).toContain("JavaScript Basics");
  });

  it("10.7 $setWindowFields — running install total + rank", async () => {
    const results = await db.collection("assets").aggregate([
      { $match: { teamId: TEAM_A_ID, [CAP_TEST_MARKER]: true, isPublished: true } },
      { $sort: { "stats.installCount": -1 } },
      {
        $setWindowFields: {
          sortBy: { "stats.installCount": -1 },
          output: {
            rank: { $rank: {} },
            runningTotal: {
              $sum: "$stats.installCount",
              window: { documents: ["unbounded", "current"] },
            },
          },
        },
      },
    ]).toArray();
    expect(results[0].rank).toBe(1);
    expect(results[0].runningTotal).toBe(results[0].stats.installCount);
    expect(results[1].runningTotal).toBe(
      results[0].stats.installCount + results[1].stats.installCount
    );
  });

  it("9.15 $merge — materialized view of published skills", async () => {
    const viewName = "cap_test_published_view";
    await db.collection("assets").aggregate([
      { $match: { isPublished: true, [CAP_TEST_MARKER]: true } },
      { $project: { name: "$metadata.name", teamId: 1, installs: "$stats.installCount" } },
      { $merge: { into: viewName, whenMatched: "replace", whenNotMatched: "insert" } },
    ]).toArray();

    const viewDocs = await db.collection(viewName).find().toArray();
    expect(viewDocs.length).toBeGreaterThan(0);
    expect(viewDocs[0]).toHaveProperty("name");
    expect(viewDocs[0]).toHaveProperty("installs");
    await db.collection(viewName).drop();
  });
});

describe("15.x Aggregation Expressions", () => {
  it("15.1/15.2 $sum/$avg/$max/$min — team stats", async () => {
    const results = await db.collection("assets").aggregate([
      { $match: { [CAP_TEST_MARKER]: true } },
      {
        $group: {
          _id: "$teamId",
          totalInstalls: { $sum: "$stats.installCount" },
          avgInstalls: { $avg: "$stats.installCount" },
          maxInstalls: { $max: "$stats.installCount" },
          minInstalls: { $min: "$stats.installCount" },
        },
      },
    ]).toArray();
    expect(results.length).toBe(3);
    results.forEach((r) => {
      expect(r.totalInstalls).toBeGreaterThan(0);
      expect(r.avgInstalls).toBeGreaterThan(0);
      expect(r.maxInstalls).toBeGreaterThanOrEqual(r.minInstalls);
    });
  });

  it("15.6 $filter — filter memberships by role", async () => {
    const results = await db.collection("users").aggregate([
      { $match: { _id: USER_OWNER_ID } },
      {
        $project: {
          name: 1,
          ownerMemberships: {
            $filter: {
              input: "$teamMemberships",
              as: "m",
              cond: { $eq: ["$$m.role", "owner"] },
            },
          },
        },
      },
    ]).toArray();
    expect(results[0].ownerMemberships.length).toBe(1);
  });

  it("15.7 $map — extract names from embedded array", async () => {
    const results = await db.collection("teams").aggregate([
      { $match: { _id: TEAM_A_ID } },
      {
        $lookup: {
          from: "users",
          localField: "memberIds",
          foreignField: "_id",
          as: "members",
        },
      },
      {
        $project: {
          name: 1,
          memberNames: { $map: { input: "$members", as: "m", in: "$$m.name" } },
        },
      },
    ]).toArray();
    expect(results[0].memberNames).toContain("Alice Owner");
    expect(results[0].memberNames).toContain("Bob Admin");
  });

  it("15.10 $cond — conditional labels", async () => {
    const results = await db.collection("assets").aggregate([
      { $match: { [CAP_TEST_MARKER]: true } },
      {
        $project: {
          name: "$metadata.name",
          tier: {
            $cond: {
              if: { $gte: ["$stats.installCount", 300] }, then: "hot",
              else: { $cond: { if: { $gte: ["$stats.installCount", 100] }, then: "warm", else: "cold" } },
            },
          },
        },
      },
    ]).toArray();
    const hot = results.filter((r) => r.tier === "hot");
    const warm = results.filter((r) => r.tier === "warm");
    const cold = results.filter((r) => r.tier === "cold");
    expect(hot.length).toBeGreaterThan(0);
    expect(warm.length).toBeGreaterThan(0);
    expect(cold.length).toBeGreaterThan(0);
  });

  it("15.12 $dateToString — group skills by month", async () => {
    const results = await db.collection("assets").aggregate([
      { $match: { [CAP_TEST_MARKER]: true } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]).toArray();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]._id).toMatch(/^\d{4}-\d{2}$/);
  });

  it("15.15 $ifNull — default for missing fields", async () => {
    const results = await db.collection("assets").aggregate([
      { $match: { _id: SKILL_IDS.reactHooks } },
      {
        $project: {
          name: "$metadata.name",
          forkCount: { $ifNull: ["$stats.forkCount", 0] },
        },
      },
    ]).toArray();
    expect(results[0].forkCount).toBe(0);
  });
});
