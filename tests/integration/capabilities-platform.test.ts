/**
 * MongoDB Capabilities Test — Platform Features (12.x, 13.x).
 * Tests indexes, transactions, upserts, explain, bulk ops, collation.
 * All tests run against REAL Atlas M0 with seeded data.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ObjectId, type Db, MongoClient } from "mongodb";
import { getTestDb, closeTestDb } from "../helpers/db-setup";
import {
  seedCapabilitiesData, cleanCapabilitiesData,
  TEAM_A_ID, SKILL_IDS, CAP_TEST_MARKER,
} from "../helpers/seed-capabilities";

let db: Db;
beforeAll(async () => { db = await getTestDb(); await seedCapabilitiesData(db); }, 120_000);
afterAll(async () => {
  await cleanCapabilitiesData(db);
  for (const n of ["cap_test_ttl", "cap_test_partial", "cap_test_collation"]) {
    try { await db.collection(n).drop(); } catch { /* ok */ }
  }
  await closeTestDb();
});

describe("12.x Index Types", () => {
  it("12.5 TTL Index — auto-expire documents", async () => {
    const coll = db.collection("cap_test_ttl");
    await coll.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await coll.insertOne({ token: "invite-123", expiresAt: new Date(Date.now() + 3600_000) });
    const indexes = await coll.indexes();
    const ttl = indexes.find((i) => i.key?.expiresAt === 1);
    expect(ttl).toBeDefined();
    expect(ttl!.expireAfterSeconds).toBe(0);
  });

  it("12.6 Partial Index — only published skills", async () => {
    const coll = db.collection("cap_test_partial");
    await coll.insertMany([{ name: "pub", isPublished: true }, { name: "draft", isPublished: false }]);
    await coll.createIndex({ name: 1 }, { partialFilterExpression: { isPublished: true }, name: "name_pub" });
    const idx = (await coll.indexes()).find((i) => i.name === "name_pub");
    expect(idx).toBeDefined();
    expect(idx!.partialFilterExpression).toEqual({ isPublished: true });
  });

  it("12.12 Collation Index — case-insensitive", async () => {
    const coll = db.collection("cap_test_collation");
    await coll.insertMany([{ name: "React" }, { name: "react" }, { name: "REACT" }]);
    await coll.createIndex({ name: 1 }, { collation: { locale: "en", strength: 2 }, name: "name_ci" });
    const results = await coll.find({}).collation({ locale: "en", strength: 2 }).sort({ name: 1 }).toArray();
    expect(results.length).toBe(3);
  });
});

describe("13.x Platform Features", () => {
  it("13.1 Transactions — atomic multi-doc", async () => {
    const client = new MongoClient(process.env.MONGODB_URI!);
    await client.connect();
    const session = client.startSession();
    const txDb = client.db(process.env.MONGODB_DB_NAME || "skillshub_test");
    const tmpId = new ObjectId();
    try {
      await session.withTransaction(async () => {
        await txDb.collection("assets").insertOne(
          { _id: tmpId, teamId: TEAM_A_ID, metadata: { name: "TX Test" }, [CAP_TEST_MARKER]: true },
          { session }
        );
        await txDb.collection("teams").updateOne(
          { _id: TEAM_A_ID }, { $inc: { skillCount: 1 } }, { session }
        );
      });
      const skill = await txDb.collection("assets").findOne({ _id: tmpId });
      expect(skill).not.toBeNull();
      await txDb.collection("assets").deleteOne({ _id: tmpId });
      await txDb.collection("teams").updateOne({ _id: TEAM_A_ID }, { $unset: { skillCount: "" } });
    } finally {
      await session.endSession();
      await client.close();
    }
  });

  it("13.16 Upserts — insert-or-update atomically", async () => {
    const f = { skillId: SKILL_IDS.reactHooks, teamId: TEAM_A_ID, date: new Date("2026-04-02") };
    const r1 = await db.collection("activity").updateOne(
      f, { $setOnInsert: { createdAt: new Date(), [CAP_TEST_MARKER]: true }, $push: { events: { type: "view", ts: new Date() } } as never },
      { upsert: true }
    );
    expect(r1.upsertedCount).toBe(1);
    const r2 = await db.collection("activity").updateOne(
      f, { $setOnInsert: { createdAt: new Date("2099-01-01") }, $push: { events: { type: "install", ts: new Date() } } as never },
      { upsert: true }
    );
    expect(r2.upsertedCount).toBe(0);
    expect(r2.modifiedCount).toBe(1);
    expect((await db.collection("activity").findOne(f))!.events.length).toBe(2);
  });

  it("13.19 Explain — query plan", async () => {
    const expl = await db.collection("assets")
      .find({ teamId: TEAM_A_ID, isPublished: true }).explain("executionStats");
    expect(expl).toHaveProperty("queryPlanner");
  });

  it("13.17 bulkWrite — batched updates", async () => {
    const r = await db.collection("assets").bulkWrite([
      { updateOne: { filter: { _id: SKILL_IDS.reactHooks }, update: { $inc: { "stats.viewCount": 1 } } } },
      { updateOne: { filter: { _id: SKILL_IDS.typescriptGenerics }, update: { $inc: { "stats.viewCount": 1 } } } },
      { updateOne: { filter: { _id: SKILL_IDS.mongodbIndexing }, update: { $inc: { "stats.viewCount": 1 } } } },
    ]);
    expect(r.modifiedCount).toBe(3);
  });

  it("1.2+1.8 insertMany+deleteMany", async () => {
    const ids = [new ObjectId(), new ObjectId(), new ObjectId()];
    expect((await db.collection("assets").insertMany(ids.map((id) => ({
      _id: id, teamId: TEAM_A_ID, metadata: { name: `B-${id}` }, [CAP_TEST_MARKER]: true,
    })))).insertedCount).toBe(3);
    expect((await db.collection("assets").deleteMany({ _id: { $in: ids } })).deletedCount).toBe(3);
  });

  it("13.10 Collation sort", async () => {
    const r = await db.collection("assets")
      .find({ teamId: TEAM_A_ID, [CAP_TEST_MARKER]: true })
      .collation({ locale: "en", strength: 2 })
      .sort({ "metadata.name": 1 }).limit(5).toArray();
    expect(r.length).toBeGreaterThan(0);
    const n = r.map((x) => x.metadata.name);
    expect(n).toEqual([...n].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
  });

  it("13.7/13.8 Read+Write Concern majority", async () => {
    expect(await db.collection("assets").findOne(
      { _id: SKILL_IDS.reactHooks }, { readConcern: { level: "majority" } }
    )).not.toBeNull();
    const w = await db.collection("assets").updateOne(
      { _id: SKILL_IDS.reactHooks }, { $set: { _wt: true } }, { writeConcern: { w: "majority" } }
    );
    expect(w.acknowledged).toBe(true);
    await db.collection("assets").updateOne({ _id: SKILL_IDS.reactHooks }, { $unset: { _wt: "" } });
  });
});
