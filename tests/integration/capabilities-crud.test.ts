/**
 * MongoDB Capabilities Test — CRUD, Query Operators, Update Operators.
 *
 * Tests capabilities 1.x, 2.x, 3.x, 4.x, 5.x, 6.x, 7.x, 8.x
 * from context/MONGODB_CAPABILITIES.md against REAL Atlas M0 with seeded data.
 *
 * Zero mocks, zero skips. All assertions use real MongoDB responses.
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
  USER_MEMBER_ID,
  SKILL_IDS,
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

describe("1.x CRUD Operations", () => {
  it("1.3 findOne — find team by slug", async () => {
    const team = await db.collection("teams").findOne({ slug: "cap-frontend-masters" });
    expect(team).not.toBeNull();
    expect(team!.name).toBe("Frontend Masters");
  });

  it("1.4 find — list skills for team", async () => {
    const skills = await db.collection("assets")
      .find({ teamId: TEAM_A_ID, [CAP_TEST_MARKER]: true })
      .toArray();
    expect(skills.length).toBeGreaterThanOrEqual(10);
  });

  it("1.11 findOneAndUpdate — atomic increment + return", async () => {
    const result = await db.collection("assets").findOneAndUpdate(
      { _id: SKILL_IDS.reactHooks },
      { $inc: { "stats.viewCount": 1 } },
      { returnDocument: "after" }
    );
    expect(result).not.toBeNull();
    expect(result!.stats.viewCount).toBeGreaterThan(1205);
  });

  it("1.14 countDocuments — count published skills for team", async () => {
    const count = await db.collection("assets").countDocuments({
      teamId: TEAM_A_ID, isPublished: true, [CAP_TEST_MARKER]: true,
    });
    expect(count).toBeGreaterThanOrEqual(8);
  });

  it("1.15 estimatedDocumentCount — fast approximate count", async () => {
    const count = await db.collection("assets").estimatedDocumentCount();
    expect(count).toBeGreaterThan(0);
  });

  it("1.16 distinct — get all unique tags", async () => {
    const tags = await db.collection("assets").distinct("tags", {
      teamId: TEAM_A_ID, [CAP_TEST_MARKER]: true,
    });
    expect(tags).toContain("react");
    expect(tags).toContain("typescript");
    expect(tags).toContain("mongodb");
    expect(tags.length).toBeGreaterThanOrEqual(10);
  });
});

describe("2.x Query Operators — Comparison", () => {
  it("2.3 $gt — skills with > 300 installs", async () => {
    const results = await db.collection("assets")
      .find({ "stats.installCount": { $gt: 300 }, [CAP_TEST_MARKER]: true })
      .toArray();
    expect(results.length).toBeGreaterThan(0);
    results.forEach((r) => expect(r.stats.installCount).toBeGreaterThan(300));
  });

  it("2.5 $in — skills matching multiple tags", async () => {
    const results = await db.collection("assets")
      .find({ tags: { $in: ["react", "typescript"] }, teamId: TEAM_A_ID, [CAP_TEST_MARKER]: true })
      .toArray();
    expect(results.length).toBeGreaterThanOrEqual(3);
  });

  it("2.2 $ne — exclude unpublished skills", async () => {
    const results = await db.collection("assets")
      .find({ isPublished: { $ne: false }, teamId: TEAM_A_ID, [CAP_TEST_MARKER]: true })
      .toArray();
    results.forEach((r) => expect(r.isPublished).not.toBe(false));
  });
});

describe("3.x Query Operators — Logical", () => {
  it("3.2 $or — search name OR description", async () => {
    const results = await db.collection("assets").find({
      $or: [
        { "metadata.name": /React/i },
        { "metadata.description": /Generic/i },
      ],
      [CAP_TEST_MARKER]: true,
    }).toArray();
    expect(results.length).toBeGreaterThanOrEqual(2);
  });
});

describe("4.x Query Operators — Element", () => {
  it("4.1 $exists — skills with parentSkillId", async () => {
    const withParent = await db.collection("assets")
      .find({ parentSkillId: { $exists: true }, [CAP_TEST_MARKER]: true })
      .toArray();
    expect(withParent.length).toBe(2); // cssFundamentals + jsBasics
  });
});

describe("5.x Query Operators — Evaluation", () => {
  it("5.1 $expr — skills where viewCount > installCount * 5", async () => {
    const results = await db.collection("assets").find({
      $expr: { $gt: ["$stats.viewCount", { $multiply: ["$stats.installCount", 5] }] },
      [CAP_TEST_MARKER]: true,
    }).toArray();
    expect(results.length).toBeGreaterThan(0);
  });
});

describe("6.x Query Operators — Array", () => {
  it("6.1 $all — skills with ALL specified tags", async () => {
    const results = await db.collection("assets")
      .find({ tags: { $all: ["frontend", "react"] }, [CAP_TEST_MARKER]: true })
      .toArray();
    expect(results.length).toBeGreaterThanOrEqual(2);
    results.forEach((r) => {
      expect(r.tags).toContain("frontend");
      expect(r.tags).toContain("react");
    });
  });

  it("6.2 $elemMatch — user membership for specific team+role", async () => {
    const user = await db.collection("users").findOne({
      teamMemberships: { $elemMatch: { teamId: TEAM_A_ID, role: "admin" } },
      [CAP_TEST_MARKER]: true,
    });
    expect(user).not.toBeNull();
    expect(user!.name).toBe("Bob Admin");
  });
});

describe("7.x Update Operators — Field", () => {
  it("7.3 $inc — atomic increment viewCount", async () => {
    const before = await db.collection("assets").findOne({ _id: SKILL_IDS.typescriptGenerics });
    await db.collection("assets").updateOne(
      { _id: SKILL_IDS.typescriptGenerics },
      { $inc: { "stats.viewCount": 5 } }
    );
    const after = await db.collection("assets").findOne({ _id: SKILL_IDS.typescriptGenerics });
    expect(after!.stats.viewCount).toBe(before!.stats.viewCount + 5);
  });

  it("7.2 $unset — remove optional field", async () => {
    await db.collection("assets").updateOne(
      { _id: SKILL_IDS.dockerBasics },
      { $set: { deprecatedField: "old" } }
    );
    await db.collection("assets").updateOne(
      { _id: SKILL_IDS.dockerBasics },
      { $unset: { deprecatedField: "" } }
    );
    const doc = await db.collection("assets").findOne({ _id: SKILL_IDS.dockerBasics });
    expect(doc!.deprecatedField).toBeUndefined();
  });

  it("7.8 $setOnInsert — set field only on upsert insert", async () => {
    const bucketId = new ObjectId();
    // First upsert — creates doc with createdAt
    await db.collection("activity").updateOne(
      { _id: bucketId },
      {
        $setOnInsert: { createdAt: new Date(), [CAP_TEST_MARKER]: true },
        $set: { lastEventAt: new Date() },
      },
      { upsert: true }
    );
    const created = await db.collection("activity").findOne({ _id: bucketId });
    const originalCreatedAt = created!.createdAt;

    // Second upsert — createdAt should NOT change
    await db.collection("activity").updateOne(
      { _id: bucketId },
      {
        $setOnInsert: { createdAt: new Date("2099-01-01") },
        $set: { lastEventAt: new Date() },
      },
      { upsert: true }
    );
    const updated = await db.collection("activity").findOne({ _id: bucketId });
    expect(updated!.createdAt.getTime()).toBe(originalCreatedAt.getTime());
  });

  it("7.9 $currentDate — server-side timestamp", async () => {
    await db.collection("assets").updateOne(
      { _id: SKILL_IDS.tailwindCSS },
      { $currentDate: { updatedAt: true } }
    );
    const doc = await db.collection("assets").findOne({ _id: SKILL_IDS.tailwindCSS });
    const diff = Math.abs(Date.now() - doc!.updatedAt.getTime());
    expect(diff).toBeLessThan(10_000); // Within 10 seconds
  });
});

describe("8.x Update Operators — Array", () => {
  it("8.6 $each + $push — push multiple tags at once", async () => {
    await db.collection("assets").updateOne(
      { _id: SKILL_IDS.graphqlAPI },
      { $push: { tags: { $each: ["new-tag-1", "new-tag-2"] } } }
    );
    const doc = await db.collection("assets").findOne({ _id: SKILL_IDS.graphqlAPI });
    expect(doc!.tags).toContain("new-tag-1");
    expect(doc!.tags).toContain("new-tag-2");
  });

  it("8.8 $slice — cap array size after push", async () => {
    // Push 50 events but keep only last 10
    const manyEvents = Array.from({ length: 50 }, (_, i) => ({
      type: "view", userId: USER_MEMBER_ID, ts: new Date(Date.now() - i * 1000),
    }));
    const bucketId = new ObjectId();
    await db.collection("activity").insertOne({
      _id: bucketId, skillId: SKILL_IDS.reactHooks, teamId: TEAM_A_ID,
      date: new Date(), events: [], [CAP_TEST_MARKER]: true,
    });
    await db.collection("activity").updateOne(
      { _id: bucketId },
      { $push: { events: { $each: manyEvents, $slice: -10 } } }
    );
    const doc = await db.collection("activity").findOne({ _id: bucketId });
    expect(doc!.events.length).toBe(10);
  });

  it("8.12 $[<identifier>] — filtered positional update", async () => {
    // Update only the admin membership to add a note
    await db.collection("users").updateOne(
      { _id: USER_OWNER_ID, [CAP_TEST_MARKER]: true },
      { $set: { "teamMemberships.$[elem].note": "primary team" } },
      { arrayFilters: [{ "elem.teamId": TEAM_A_ID }] }
    );
    const user = await db.collection("users").findOne({ _id: USER_OWNER_ID });
    const membership = user!.teamMemberships.find(
      (m: Record<string, unknown>) => (m.teamId as ObjectId).equals(TEAM_A_ID)
    );
    expect(membership.note).toBe("primary team");
  });
});
