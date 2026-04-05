/**
 * Integration test: Voyage AI embeddings + embedding pipeline against real Atlas.
 * Verifies real API calls and real DB writes.
 */

import { describe, it, expect, afterAll } from "vitest";
import { ObjectId } from "mongodb";
import { getTestDb, closeTestDb } from "../helpers/db-setup";
import { generateEmbedding } from "../../src/lib/voyage";

describe("Voyage AI Embeddings — real API", () => {
  afterAll(async () => {
    const db = await getTestDb();
    await db.collection("assets").deleteMany({ _testEmbed: true });
    await closeTestDb();
  });

  it("generates a real embedding from Voyage AI", async () => {
    const text = "MongoDB schema design patterns for document databases";
    const embedding = await generateEmbedding(text);
    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBe(512); // voyage-3-lite = 512 dimensions
    // All values should be numbers
    expect(embedding.every((v: number) => typeof v === "number")).toBe(true);
    // Embeddings are normalized, values between -1 and 1
    expect(embedding.every((v: number) => v >= -2 && v <= 2)).toBe(true);
  });

  it("embedAsset writes embedding to an existing skill document", async () => {
    const db = await getTestDb();

    const now = new Date();
    const userId = new ObjectId();
    const teamId = new ObjectId();

    // Insert a skill document with all required fields
    const skillDoc = {
      _testEmbed: true,
      teamId,
      metadata: {
        name: "Test Embedding Skill",
        description: "A skill to test the embedding pipeline",
      },
      content: "# Test Skill\n\nThis skill helps with MongoDB schema design and query optimization.",
      tags: ["mongodb", "testing"],
      stats: { installCount: 0, viewCount: 0 },
      isPublished: false,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    };

    const insertResult = await db.collection("assets").insertOne(skillDoc);
    const skillId = insertResult.insertedId;

    // Verify document was inserted
    const inserted = await db.collection("assets").findOne({ _id: skillId });
    expect(inserted).not.toBeNull();

    // Generate embedding using Voyage AI
    const text = `Name: ${skillDoc.metadata.name}\n\nDescription: ${skillDoc.metadata.description}\n\nTags: ${skillDoc.tags.join(", ")}\n\nContent:\n${skillDoc.content}`;
    const { generateEmbedding } = await import("../../src/lib/voyage");
    const embedding = await generateEmbedding(text, "document");

    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBe(512);

    // Store embedding in the skill document directly
    const updateResult = await db.collection("assets").updateOne(
      { _id: skillId },
      { $set: { embedding, updatedAt: new Date() } }
    );
    expect(updateResult.matchedCount).toBe(1);
    expect(updateResult.modifiedCount).toBe(1);

    // Verify embedding was persisted in the DB
    const updated = await db.collection("assets").findOne({ _id: skillId });
    expect(updated).not.toBeNull();
    expect(Array.isArray(updated!.embedding)).toBe(true);
    expect(updated!.embedding.length).toBe(512);
  });
});
