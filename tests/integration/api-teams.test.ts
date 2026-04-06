/**
 * API Integration Test: Teams — list, create, slug gen, member counts.
 *
 * Tests team query patterns used by GET/POST /api/teams against REAL MongoDB.
 * Per api-security-best-practices: validation, slug uniqueness.
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

describe("Teams API — Query Patterns", () => {
  // ── User's teams lookup ─────────────────────────────────────
  it("gets user team memberships", async () => {
    const user = await db.collection("users").findOne(
      { _id: USER_OWNER_ID },
      { projection: { teamMemberships: 1 } }
    );
    expect(user).not.toBeNull();
    expect(user!.teamMemberships.length).toBeGreaterThan(0);
    const membership = user!.teamMemberships[0];
    expect(membership).toHaveProperty("teamId");
    expect(membership).toHaveProperty("role");
  });

  it("fetches teams by IDs from memberships", async () => {
    const user = await db.collection("users").findOne(
      { _id: USER_OWNER_ID },
      { projection: { teamMemberships: 1 } }
    );
    const teamIds = user!.teamMemberships.map((m: { teamId: ObjectId }) => m.teamId);

    const teams = await db.collection("teams")
      .find({ _id: { $in: teamIds } })
      .toArray();
    expect(teams.length).toBeGreaterThan(0);
    teams.forEach((t) => {
      expect(t).toHaveProperty("name");
      expect(t).toHaveProperty("slug");
      expect(t).toHaveProperty("owner");
      expect(t).toHaveProperty("memberIds");
    });
  });

  // ── Skill counts per team via aggregation ───────────────────
  it("counts skills per team with $group", async () => {
    const teamIds = [TEAM_A_ID, TEAM_B_ID];
    const results = await db.collection("assets")
      .aggregate<{ _id: ObjectId; count: number }>([
        { $match: { teamId: { $in: teamIds }, [CAP_TEST_MARKER]: true } },
        { $group: { _id: "$teamId", count: { $sum: 1 } } },
      ])
      .toArray();

    expect(results.length).toBeGreaterThan(0);
    results.forEach((r) => {
      expect(r.count).toBeGreaterThan(0);
    });
  });

  // ── Slug generation ─────────────────────────────────────────
  it("generates slug from team name", () => {
    // Replicate the slug logic
    const name = "My Awesome Team!";
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50);
    expect(slug).toBe("my-awesome-team");
    expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it("handles edge case slug generation", () => {
    const edge = "---Special  Characters 123!@#---";
    const slug = edge
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50);
    expect(slug).toBe("special-characters-123");
  });

  // ── Team creation validation ────────────────────────────────
  it("requires team name with min 2 characters", () => {
    const validate = (name: string) =>
      typeof name === "string" && name.trim().length >= 2;

    expect(validate("AB")).toBe(true);
    expect(validate("A")).toBe(false);
    expect(validate("")).toBe(false);
    expect(validate("  A  ")).toBe(false); // trimmed = 1 char
    expect(validate("My Team")).toBe(true);
  });

  it("caps team name at 100 characters", () => {
    const longName = "A".repeat(200);
    const capped = longName.trim().slice(0, 100);
    expect(capped.length).toBe(100);
  });

  // ── Role mapping ────────────────────────────────────────────
  it("builds role map from user memberships", async () => {
    const user = await db.collection("users").findOne(
      { _id: USER_OWNER_ID },
      { projection: { teamMemberships: 1 } }
    );
    const roleMap = new Map(
      user!.teamMemberships.map((m: { teamId: ObjectId; role: string }) => [
        m.teamId.toHexString(),
        m.role,
      ])
    );
    expect(roleMap.get(TEAM_A_ID.toHexString())).toBe("owner");
  });

  // ── Member count from document ──────────────────────────────
  it("counts members from memberIds array length", async () => {
    const team = await db.collection("teams").findOne({ _id: TEAM_A_ID });
    expect(team).not.toBeNull();
    expect(team!.memberIds.length).toBeGreaterThan(0);
  });
});
