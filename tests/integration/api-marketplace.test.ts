/**
 * API Integration Test: Marketplace endpoint logic.
 *
 * Tests the marketplace JSON generation against REAL MongoDB.
 * Uses seeded data from capabilities suite.
 * Per api-security-best-practices skill: validates caching, schema, error states.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ObjectId, type Db } from "mongodb";
import { getTestDb, closeTestDb } from "../helpers/db-setup";
import {
  seedCapabilitiesData,
  cleanCapabilitiesData,
  TEAM_A_ID,
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

describe("Marketplace API — Data Layer", () => {
  // ── Team lookup ─────────────────────────────────────────────
  it("finds team by slug", async () => {
    const team = await db.collection("teams").findOne(
      { slug: "cap-frontend-masters" },
      { projection: { _id: 1, name: 1, slug: 1, settings: 1 } }
    );
    expect(team).not.toBeNull();
    expect(team!.name).toBe("Frontend Masters");
    expect(team!._id.equals(TEAM_A_ID)).toBe(true);
  });

  it("returns null for unknown team slug", async () => {
    const team = await db.collection("teams").findOne({ slug: "nonexistent-team-slug-xyz" });
    expect(team).toBeNull();
  });

  // ── Published skills query ─────────────────────────────────
  it("fetches only published skills for a team", async () => {
    const skills = await db.collection("assets")
      .find(
        { teamId: TEAM_A_ID, isPublished: true, [CAP_TEST_MARKER]: true },
        { projection: { "metadata.name": 1, "metadata.description": 1, "source.repoUrl": 1, teamId: 1 } }
      )
      .sort({ "metadata.name": 1 })
      .toArray();

    expect(skills.length).toBeGreaterThan(0);
    // All returned skills should be for team A (teamId is ObjectId from DB)
    skills.forEach((s) => expect(s.teamId.equals(TEAM_A_ID)).toBe(true));
  });

  it("excludes unpublished skills from marketplace", async () => {
    // k8sDeployment is unpublished
    const unpublished = await db.collection("assets").findOne({
      _id: SKILL_IDS.k8sDeployment,
    });
    if (unpublished) {
      expect(unpublished.isPublished).toBe(false);
      // Marketplace query should NOT include it
      const published = await db.collection("assets")
        .find({ teamId: TEAM_A_ID, isPublished: true, [CAP_TEST_MARKER]: true })
        .toArray();
      const ids = published.map((s) => s._id.toHexString());
      expect(ids).not.toContain(SKILL_IDS.k8sDeployment.toHexString());
    }
  });

  // ── Marketplace JSON schema ─────────────────────────────────
  it("generates valid marketplace plugin entries", async () => {
    const skills = await db.collection("assets")
      .find(
        { teamId: TEAM_A_ID, isPublished: true, [CAP_TEST_MARKER]: true },
        { projection: { "metadata.name": 1, "metadata.description": 1, "source.repoUrl": 1, updatedAt: 1 } }
      )
      .sort({ "metadata.name": 1 })
      .toArray();

    const plugins = skills.map((skill) => ({
      name: skill.metadata.name
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-"),
      description: skill.metadata.description,
      source: skill.source?.repoUrl
        ? { source: "github", repo: skill.source.repoUrl }
        : { source: "url", url: `/api/skills/${skill._id.toHexString()}/content` },
    }));

    expect(plugins.length).toBeGreaterThan(0);
    plugins.forEach((p) => {
      expect(p.name).toBeTruthy();
      expect(p.name).toMatch(/^[a-z0-9-]+$/); // slug format
      expect(p.description).toBeTruthy();
      expect(p.source.source).toMatch(/^(github|url)$/);
    });
  });

  // ── ETag generation ─────────────────────────────────────────
  it("generates consistent ETag for same content", async () => {
    const { createHash } = await import("crypto");
    const body = JSON.stringify({ test: "data" }, null, 2);
    const etag1 = `"${createHash("md5").update(body).digest("hex")}"`;
    const etag2 = `"${createHash("md5").update(body).digest("hex")}"`;
    expect(etag1).toBe(etag2);
    expect(etag1).toMatch(/^"[a-f0-9]{32}"$/); // MD5 hex format
  });

  it("generates different ETags for different content", async () => {
    const { createHash } = await import("crypto");
    const body1 = JSON.stringify({ test: "data1" }, null, 2);
    const body2 = JSON.stringify({ test: "data2" }, null, 2);
    const etag1 = `"${createHash("md5").update(body1).digest("hex")}"`;
    const etag2 = `"${createHash("md5").update(body2).digest("hex")}"`;
    expect(etag1).not.toBe(etag2);
  });

  // ── Team isolation ──────────────────────────────────────────
  it("skills from team B are not included in team A marketplace", async () => {
    const teamASkills = await db.collection("assets")
      .find({ teamId: TEAM_A_ID, [CAP_TEST_MARKER]: true })
      .toArray();
    const teamBIds = [SKILL_IDS.pythonFastAPI, SKILL_IDS.djangoModels, SKILL_IDS.celeryTasks];
    const teamBHexIds = teamBIds.map((id) => id.toHexString());
    teamASkills.forEach((s) => {
      expect(teamBHexIds).not.toContain(s._id.toHexString());
    });
  });
});
