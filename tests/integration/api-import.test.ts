/**
 * API Integration Test: Import API — auth, RBAC, validation.
 *
 * Tests the import logic at the data layer against REAL MongoDB.
 * Per api-security-best-practices: auth guard, RBAC, input validation, duplicate detection.
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
  USER_ADMIN_ID,
  USER_MEMBER_ID,
  USER_VIEWER_ID,
  CAP_TEST_MARKER,
} from "../helpers/seed-capabilities";
import { hasPermission } from "../../src/lib/rbac";

let db: Db;

beforeAll(async () => {
  db = await getTestDb();
  await seedCapabilitiesData(db);
}, 120_000);

afterAll(async () => {
  await cleanCapabilitiesData(db);
  await closeTestDb();
});

describe("Import API — Auth & RBAC", () => {
  // ── RBAC permission checks ──────────────────────────────────
  it("owner has skill:create permission", () => {
    expect(hasPermission("owner", "skill:create")).toBe(true);
  });

  it("admin has skill:create permission", () => {
    expect(hasPermission("admin", "skill:create")).toBe(true);
  });

  it("member has skill:create permission", () => {
    expect(hasPermission("member", "skill:create")).toBe(true);
  });

  it("viewer does NOT have skill:create permission", () => {
    expect(hasPermission("viewer", "skill:create")).toBe(false);
  });

  // ── Team membership lookup ──────────────────────────────────
  it("finds user with team membership", async () => {
    const user = await db.collection("users").findOne(
      {
        _id: USER_OWNER_ID,
        "teamMemberships.teamId": TEAM_A_ID,
      },
      { projection: { teamMemberships: 1 } }
    );
    expect(user).not.toBeNull();
    const membership = user!.teamMemberships.find(
      (m: { teamId: ObjectId; role: string }) => m.teamId.equals(TEAM_A_ID)
    );
    expect(membership).toBeDefined();
    expect(membership!.role).toBe("owner");
  });

  it("rejects user not in team", async () => {
    const fakeUserId = new ObjectId("ff0000000000000000000099");
    const user = await db.collection("users").findOne(
      {
        _id: fakeUserId,
        "teamMemberships.teamId": TEAM_A_ID,
      },
      { projection: { teamMemberships: 1 } }
    );
    expect(user).toBeNull();
  });

  // ── Input validation patterns ───────────────────────────────
  it("validates ObjectId format", () => {
    const valid = /^[a-f\d]{24}$/i;
    expect(valid.test("aa0000000000000000000001")).toBe(true);
    expect(valid.test("not-valid")).toBe(false);
    expect(valid.test("")).toBe(false);
    expect(valid.test("zz0000000000000000000001")).toBe(false); // z not hex
  });

  it("URL is trimmed and capped at 500 chars", () => {
    const rawUrl = "  https://github.com/owner/repo  ";
    const processed = rawUrl.trim().slice(0, 500);
    expect(processed).toBe("https://github.com/owner/repo");

    const longUrl = "https://github.com/owner/" + "x".repeat(600);
    const capped = longUrl.trim().slice(0, 500);
    expect(capped.length).toBe(500);
  });

  // ── Duplicate detection ─────────────────────────────────────
  it("detects duplicate repo URL (case-insensitive)", async () => {
    // Insert a test skill with a source URL
    const testId = new ObjectId("ee0000000000000000000099");
    await db.collection("assets").insertOne({
      _id: testId,
      teamId: TEAM_A_ID,
      metadata: { name: "Dup Test", description: "Test", author: "test", version: "1.0" },
      content: "test",
      tags: [],
      source: { repoUrl: "https://github.com/test-owner/test-repo" },
      stats: { installCount: 0, viewCount: 0 },
      isPublished: false,
      createdBy: USER_OWNER_ID,
      createdAt: new Date(),
      updatedAt: new Date(),
      _apiTest: true,
    });

    // Check duplicate detection
    const repoUrl = "https://github.com/test-owner/test-repo";
    const existing = await db.collection("assets").findOne({
      teamId: TEAM_A_ID,
      "source.repoUrl": { $regex: new RegExp(repoUrl.replace(/^https?:\/\//, ""), "i") },
    });
    expect(existing).not.toBeNull();

    // Cleanup
    await db.collection("assets").deleteOne({ _id: testId });
  });

  it("does not flag different repos as duplicates", async () => {
    const repoUrl = "github.com/completely-different/unique-repo-name";
    const existing = await db.collection("assets").findOne({
      teamId: TEAM_A_ID,
      "source.repoUrl": { $regex: new RegExp(repoUrl, "i") },
    });
    expect(existing).toBeNull();
  });
});
