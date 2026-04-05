/**
 * E2E Tests — Phase 17: Asset Version History + Diff Viewer
 *
 * Real MongoDB, real services, zero mocks.
 * Tests: createVersion, getVersionHistory, rollback, computeDiff, compareVersions.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ObjectId, type Db } from "mongodb";
import { getTestDb, closeTestDb } from "../helpers/db-setup";
import {
  computeDiff,
  createVersion,
  getVersionHistory,
  getVersion,
  rollbackToVersion,
  compareVersions,
} from "@/services/version-service";

let db: Db;
const MARKER = `ver-${Date.now()}`;
const userId = new ObjectId();
const teamId = new ObjectId();
let assetId: ObjectId;

beforeAll(async () => {
  db = await getTestDb();
  // Seed a base asset (no versions yet)
  assetId = new ObjectId();
  await db.collection("assets").insertOne({
    _id: assetId,
    type: "skill",
    teamId,
    metadata: { name: `Version Test ${MARKER}`, description: "Original description" },
    content: "# Original\n\nLine one.\nLine two.\nLine three.",
    tags: ["v-test"],
    stats: { installCount: 0, viewCount: 0 },
    isPublished: false,
    createdBy: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
});

afterAll(async () => {
  await db.collection("assets").deleteMany({ "metadata.name": { $regex: MARKER } });
  await closeTestDb();
});

// ─── computeDiff unit tests ─────────────────────────────────

describe("computeDiff", () => {
  it("detects no changes for identical content", () => {
    const diff = computeDiff("hello\nworld", "hello\nworld");
    expect(diff.linesAdded).toBe(0);
    expect(diff.linesRemoved).toBe(0);
    expect(diff.linesUnchanged).toBe(2);
  });

  it("detects added lines", () => {
    const diff = computeDiff("line1\nline2", "line1\nline2\nline3");
    expect(diff.linesAdded).toBe(1);
    expect(diff.linesRemoved).toBe(0);
    const addedLines = diff.lines.filter((l) => l.type === "add");
    expect(addedLines[0].content).toBe("line3");
  });

  it("detects removed lines", () => {
    const diff = computeDiff("line1\nline2\nline3", "line1\nline3");
    expect(diff.linesRemoved).toBe(1);
    const removed = diff.lines.filter((l) => l.type === "remove");
    expect(removed[0].content).toBe("line2");
  });

  it("detects mixed changes", () => {
    const diff = computeDiff("a\nb\nc\nd", "a\nB\nc\nD\ne");
    expect(diff.linesAdded).toBeGreaterThan(0);
    expect(diff.linesRemoved).toBeGreaterThan(0);
    expect(diff.linesUnchanged).toBeGreaterThanOrEqual(2); // a, c unchanged
  });

  it("handles empty to content", () => {
    const diff = computeDiff("", "new content");
    expect(diff.linesAdded).toBe(1);
    // Empty string splits to [""] so the empty line is removed
    expect(diff.linesRemoved).toBe(1);
  });

  it("handles content to empty", () => {
    const diff = computeDiff("old content", "");
    expect(diff.linesRemoved).toBe(1);
    // Empty string splits to [""] so the empty line is added
    expect(diff.linesAdded).toBe(1);
  });
});

// ─── Version lifecycle E2E ──────────────────────────────────

describe("Version lifecycle (real DB)", () => {
  it("creates version 1 with diff from original content", async () => {
    const result = await createVersion(db, assetId, {
      content: "# Updated\n\nLine one.\nLine two updated.\nLine three.",
      metadata: { name: `Version Test ${MARKER}`, description: "Updated description" },
      tags: ["v-test", "updated"],
      updatedBy: userId,
      changeReason: "Updated line two",
    });
    expect(result.versionNumber).toBe(1);
    expect(result.versionId).toBeDefined();
    expect(result.diff).toBeDefined();
    expect(result.diff!.linesAdded).toBeGreaterThan(0);
    expect(result.diff!.linesRemoved).toBeGreaterThan(0);

    // Verify asset content was updated
    const asset = await db.collection("assets").findOne({ _id: assetId });
    expect(asset!.content).toContain("Line two updated");
    expect(asset!.currentVersionNumber).toBe(1);
    expect(asset!.versions).toHaveLength(1);
  });

  it("creates version 2 with diff from version 1", async () => {
    const result = await createVersion(db, assetId, {
      content: "# V2\n\nCompletely rewritten.\nNew approach.",
      metadata: { name: `Version Test ${MARKER}`, description: "V2 rewrite" },
      tags: ["v-test", "v2"],
      updatedBy: userId,
      changeReason: "Major rewrite",
    });
    expect(result.versionNumber).toBe(2);
    expect(result.diff!.linesAdded).toBeGreaterThan(0);

    const asset = await db.collection("assets").findOne({ _id: assetId });
    expect(asset!.versions).toHaveLength(2);
    expect(asset!.currentVersionNumber).toBe(2);
  });


  it("creates version 3", async () => {
    const result = await createVersion(db, assetId, {
      content: "# V3\n\nThird version.\nMore content here.",
      metadata: { name: `Version Test ${MARKER}`, description: "V3" },
      tags: ["v-test", "v3"],
      updatedBy: userId,
    });
    expect(result.versionNumber).toBe(3);
  });

  it("getVersionHistory returns versions in reverse chronological order", async () => {
    const history = await getVersionHistory(db, assetId, { limit: 10 });
    expect(history.length).toBe(3);
    expect(history[0].versionNumber).toBe(3);
    expect(history[1].versionNumber).toBe(2);
    expect(history[2].versionNumber).toBe(1);
  });

  it("getVersionHistory respects limit", async () => {
    const history = await getVersionHistory(db, assetId, { limit: 2 });
    expect(history.length).toBe(2);
    expect(history[0].versionNumber).toBe(3);
  });

  it("getVersionHistory strips diffs by default", async () => {
    const history = await getVersionHistory(db, assetId, { limit: 10 });
    for (const v of history) {
      expect(v.diff).toBeUndefined();
    }
  });

  it("getVersionHistory includes diffs when requested", async () => {
    const history = await getVersionHistory(db, assetId, { limit: 10, includeDiffs: true });
    const withDiffs = history.filter((v) => v.diff !== undefined);
    expect(withDiffs.length).toBeGreaterThanOrEqual(2);
  });

  it("getVersion retrieves specific version by number", async () => {
    const v2 = await getVersion(db, assetId, 2);
    expect(v2).not.toBeNull();
    expect(v2!.versionNumber).toBe(2);
    expect(v2!.content).toContain("Completely rewritten");
    expect(v2!.changeReason).toBe("Major rewrite");
  });

  it("getVersion returns null for non-existent version", async () => {
    const v99 = await getVersion(db, assetId, 99);
    expect(v99).toBeNull();
  });

  it("compareVersions produces correct diff", async () => {
    const result = await compareVersions(db, assetId, 1, 3);
    expect(result).not.toBeNull();
    expect(result!.from.versionNumber).toBe(1);
    expect(result!.to.versionNumber).toBe(3);
    expect(result!.diff.linesAdded).toBeGreaterThan(0);
  });

  it("compareVersions returns null for non-existent version", async () => {
    const result = await compareVersions(db, assetId, 1, 99);
    expect(result).toBeNull();
  });

  it("rollbackToVersion restores content and creates v4", async () => {
    const v1 = await getVersion(db, assetId, 1);
    const result = await rollbackToVersion(db, assetId, 1, userId);
    expect(result.success).toBe(true);
    expect(result.newVersionNumber).toBe(4);

    const asset = await db.collection("assets").findOne({ _id: assetId });
    expect(asset!.content).toBe(v1!.content);
    expect(asset!.currentVersionNumber).toBe(4);
    expect(asset!.versions).toHaveLength(4);

    const v4 = await getVersion(db, assetId, 4);
    expect(v4!.changeReason).toContain("Rolled back to version 1");
  });

  it("rollbackToVersion fails for non-existent version", async () => {
    const result = await rollbackToVersion(db, assetId, 999, userId);
    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("createVersion throws for non-existent asset", async () => {
    await expect(
      createVersion(db, new ObjectId(), {
        content: "test",
        metadata: { name: "test", description: "test" },
        tags: [],
        updatedBy: userId,
      })
    ).rejects.toThrow("not found");
  });
});
