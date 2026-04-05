/**
 * Real MongoDB connection tests.
 * Verifies getDb, getClient, getClientPromise work against real Atlas cluster.
 */

import { describe, it, expect, afterAll } from "vitest";
import { getTestDb, closeTestDb } from "../helpers/db-setup";

describe("Real MongoDB Connection", () => {
  afterAll(async () => {
    await closeTestDb();
  });

  it("connects to real MongoDB and returns a Db instance", async () => {
    const db = await getTestDb();
    expect(db).toBeDefined();
    expect(db.databaseName).toBe("skillshub_test");
  });

  it("can ping the database", async () => {
    const db = await getTestDb();
    const result = await db.command({ ping: 1 });
    expect(result.ok).toBe(1);
  });

  it("can list collections", async () => {
    const db = await getTestDb();
    const collections = await db.listCollections().toArray();
    expect(Array.isArray(collections)).toBe(true);
  });

  it("can write and read a document", async () => {
    const db = await getTestDb();
    const testCol = db.collection("_connection_test");

    const doc = { _test: true, ts: Date.now() };
    const insertResult = await testCol.insertOne(doc);
    expect(insertResult.acknowledged).toBe(true);

    const found = await testCol.findOne({ _id: insertResult.insertedId });
    expect(found).toBeTruthy();
    expect(found!._test).toBe(true);

    // Cleanup
    await testCol.drop();
  });
});
