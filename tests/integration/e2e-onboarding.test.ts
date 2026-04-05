/**
 * E2E Tests — Phase 16: Interactive Onboarding Wizard
 *
 * Real MongoDB, real services, zero mocks.
 * Tests the full processOnboarding flow and customizeContent engine.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ObjectId, type Db } from "mongodb";
import { getTestDb, closeTestDb } from "../helpers/db-setup";
import {
  processOnboarding,
  customizeContent,
  validateOnboardingAnswers,
  type OnboardingAnswers,
  type AgentTooling,
  type TeamScale,
  type WorkflowPreference,
} from "@/services/onboarding-service";
import type { CachedUserRef } from "@/types/team";

let db: Db;
const MARKER = `onb-${Date.now()}`;

const owner: CachedUserRef = {
  userId: new ObjectId(),
  name: "Onboarding Test Owner",
  email: `onb-owner-${MARKER}@test.com`,
};

beforeAll(async () => {
  db = await getTestDb();
  // Seed the owner user
  await db.collection("users").insertOne({
    _id: owner.userId,
    email: owner.email,
    name: owner.name,
    auth: { provider: "github", providerId: `onb-${MARKER}` },
    orgMemberships: [],
    teamMemberships: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
});

afterAll(async () => {
  // Clean up everything created during tests
  await Promise.all([
    db.collection("organizations").deleteMany({ slug: { $regex: MARKER } }),
    db.collection("departments").deleteMany({ name: { $regex: MARKER } }),
    db.collection("teams").deleteMany({ slug: { $regex: MARKER } }),
    db.collection("assets").deleteMany({ "metadata.name": { $regex: MARKER } }),
    db.collection("users").deleteMany({ email: { $regex: MARKER } }),
  ]);
  await closeTestDb();
});

function makeAnswers(overrides: Partial<OnboardingAnswers> = {}): OnboardingAnswers {
  return {
    orgName: `Test Org ${MARKER}`,
    deptType: "engineering_fe",
    teamName: `Frontend Squad ${MARKER}`,
    tooling: "claude-code",
    scale: "small",
    workflow: "balanced",
    ...overrides,
  };
}

// ─── customizeContent unit tests ────────────────────────────

describe("customizeContent", () => {
  it("replaces all placeholder tokens", () => {
    const template = "Welcome to {{ORG_NAME}}. Team: {{TEAM_NAME}}. Agent: {{TOOLING}}. Scale: {{SCALE_HINT}}. Workflow: {{WORKFLOW_HINT}}.";
    const result = customizeContent(template, {
      orgName: "Acme",
      teamName: "Alpha",
      tooling: "cursor",
      scale: "medium",
      workflow: "strict_review",
    });
    expect(result).toContain("Acme");
    expect(result).toContain("Alpha");
    expect(result).toContain("Cursor");
    expect(result).toContain("Medium team");
    expect(result).toContain("Strict review");
    expect(result).not.toContain("{{");
  });

  it("appends Configuration section when not present", () => {
    const result = customizeContent("# My Skill", {
      orgName: "X", teamName: "Y", tooling: "copilot", scale: "solo", workflow: "move_fast",
    });
    expect(result).toContain("## Configuration");
    expect(result).toContain("GitHub Copilot");
    expect(result).toContain("Solo developer");
    expect(result).toContain("Move fast");
  });

  it("does NOT append Configuration section when already present", () => {
    const content = "# My Skill\n\n## Configuration\n\nAlready configured.";
    const result = customizeContent(content, {
      orgName: "X", teamName: "Y", tooling: "codex", scale: "large", workflow: "balanced",
    });
    const configCount = (result.match(/## Configuration/g) ?? []).length;
    expect(configCount).toBe(1);
  });
});


// ─── validateOnboardingAnswers ──────────────────────────────

describe("validateOnboardingAnswers", () => {
  it("rejects empty body", () => {
    expect(validateOnboardingAnswers(null).valid).toBe(false);
    expect(validateOnboardingAnswers({}).valid).toBe(false);
  });

  it("rejects short orgName", () => {
    const r = validateOnboardingAnswers({ ...makeAnswers(), orgName: "x" });
    expect(r.valid).toBe(false);
    expect(r.error).toContain("orgName");
  });

  it("rejects invalid deptType", () => {
    const r = validateOnboardingAnswers({ ...makeAnswers(), deptType: "imaginary" });
    expect(r.valid).toBe(false);
    expect(r.error).toContain("deptType");
  });

  it("rejects invalid tooling", () => {
    const r = validateOnboardingAnswers({ ...makeAnswers(), tooling: "vim" });
    expect(r.valid).toBe(false);
  });

  it("accepts valid answers", () => {
    const r = validateOnboardingAnswers(makeAnswers());
    expect(r.valid).toBe(true);
    expect(r.error).toBeUndefined();
  });
});

// ─── processOnboarding — Full E2E ──────────────────────────

describe("processOnboarding — Full E2E (real DB)", () => {
  it("creates org + dept + team + seeds customized assets for engineering_fe", async () => {
    const ts = Date.now();
    const answers = makeAnswers({
      orgName: `FE Org ${MARKER}-${ts}`,
      teamName: `FE Team ${MARKER}-${ts}`,
      deptType: "engineering_fe",
      tooling: "claude-code",
      scale: "small",
      workflow: "balanced",
    });

    const result = await processOnboarding(db, answers, owner);
    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
    expect(result.orgId).toBeDefined();
    expect(result.deptId).toBeDefined();
    expect(result.teamId).toBeDefined();
    expect(result.seededAssetCount).toBeGreaterThan(0);

    // Verify org in DB
    const org = await db.collection("organizations").findOne({ _id: result.orgId });
    expect(org).not.toBeNull();
    expect(org!.name).toBe(`FE Org ${MARKER}-${ts}`);

    // Verify dept in DB
    const dept = await db.collection("departments").findOne({ _id: result.deptId });
    expect(dept).not.toBeNull();
    expect(dept!.type).toBe("engineering_fe");

    // Verify team in DB with correct linkage
    const team = await db.collection("teams").findOne({ _id: result.teamId });
    expect(team).not.toBeNull();
    expect(team!.orgId!.toHexString()).toBe(result.orgId!.toHexString());
    expect(team!.departmentId!.toHexString()).toBe(result.deptId!.toHexString());
    expect(team!.settings.autoPublish).toBe(false); // balanced = no auto-publish

    // Verify assets were seeded AND customized
    const assets = await db.collection("assets")
      .find({ _id: { $in: result.seededAssetIds! } })
      .toArray();
    expect(assets.length).toBe(result.seededAssetCount);

    for (const asset of assets) {
      expect(asset.teamId.toHexString()).toBe(result.teamId!.toHexString());
      expect(asset.content).toContain("Claude Code");
      expect(asset.content).toContain("Configuration");
      expect(asset.tags).toContain("tooling:claude-code");
      expect(asset.tags).toContain("scale:small");
    }

    // Verify user memberships updated
    const user = await db.collection("users").findOne({ _id: owner.userId });
    const hasOrg = user!.orgMemberships.some((m: { orgId: ObjectId }) => m.orgId.toHexString() === result.orgId!.toHexString());
    const hasTeam = user!.teamMemberships.some((m: { teamId: ObjectId }) => m.teamId.toHexString() === result.teamId!.toHexString());
    expect(hasOrg).toBe(true);
    expect(hasTeam).toBe(true);
  });


  it("creates org with devops dept and strict_review workflow", async () => {
    const ts = Date.now();
    const answers = makeAnswers({
      orgName: `DevOps Org ${MARKER}-${ts}`,
      teamName: `Infra Team ${MARKER}-${ts}`,
      deptType: "devops",
      tooling: "cursor",
      scale: "large",
      workflow: "strict_review",
    });

    const result = await processOnboarding(db, answers, owner);
    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
    expect(result.seededAssetCount).toBeGreaterThan(0);

    // Verify team has strict settings
    const team = await db.collection("teams").findOne({ _id: result.teamId });
    expect(team!.settings.autoPublish).toBe(false);
    expect(team!.settings.marketplaceEnabled).toBe(false);

    // Verify assets contain Cursor customization
    const assets = await db.collection("assets")
      .find({ _id: { $in: result.seededAssetIds! } })
      .toArray();
    for (const asset of assets) {
      expect(asset.content).toContain("Cursor");
      expect(asset.tags).toContain("tooling:cursor");
      expect(asset.tags).toContain("scale:large");
    }
  });

  it("creates org with custom dept (no templates = 0 seeded assets)", async () => {
    const ts = Date.now();
    const answers = makeAnswers({
      orgName: `Custom Org ${MARKER}-${ts}`,
      teamName: `Custom Team ${MARKER}-${ts}`,
      deptType: "custom",
      tooling: "undecided",
      scale: "solo",
      workflow: "move_fast",
    });

    const result = await processOnboarding(db, answers, owner);
    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
    expect(result.seededAssetCount).toBe(0);
    expect(result.seededAssetIds).toEqual([]);

    // Team should have move_fast settings
    const team = await db.collection("teams").findOne({ _id: result.teamId });
    expect(team!.settings.autoPublish).toBe(true);
    expect(team!.settings.marketplaceEnabled).toBe(true);
  });

  it("creates org with sales dept and copilot tooling", async () => {
    const ts = Date.now();
    const answers = makeAnswers({
      orgName: `Sales Org ${MARKER}-${ts}`,
      teamName: `Sales Team ${MARKER}-${ts}`,
      deptType: "sales",
      tooling: "copilot",
      scale: "medium",
      workflow: "balanced",
    });

    const result = await processOnboarding(db, answers, owner);
    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
    expect(result.seededAssetCount).toBeGreaterThan(0);

    const assets = await db.collection("assets")
      .find({ _id: { $in: result.seededAssetIds! } })
      .toArray();
    for (const asset of assets) {
      expect(asset.content).toContain("GitHub Copilot");
      expect(asset.tags).toContain("tooling:copilot");
    }
  });

  it("rejects too-short org name", async () => {
    const answers = makeAnswers({ orgName: "x" });
    const result = await processOnboarding(db, answers, owner);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Organization name");
  });

  it("rejects too-short team name", async () => {
    const answers = makeAnswers({ teamName: "a" });
    const result = await processOnboarding(db, answers, owner);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Team name");
  });

  it("handles all 7 tooling options without error", async () => {
    const toolingOptions: AgentTooling[] = ["claude-code", "cursor", "copilot", "windsurf", "codex", "multiple", "undecided"];
    for (const tooling of toolingOptions) {
      const result = customizeContent("# Skill for {{TOOLING}}", {
        orgName: "Test", teamName: "Test", tooling, scale: "small", workflow: "balanced",
      });
      expect(result).not.toContain("{{TOOLING}}");
      expect(result.length).toBeGreaterThan(10);
    }
  });

  it("handles all 4 scale options without error", async () => {
    const scaleOptions: TeamScale[] = ["solo", "small", "medium", "large"];
    for (const scale of scaleOptions) {
      const result = customizeContent("Scale: {{SCALE_HINT}}", {
        orgName: "Test", teamName: "Test", tooling: "cursor", scale, workflow: "balanced",
      });
      expect(result).not.toContain("{{SCALE_HINT}}");
    }
  });

  it("handles all 3 workflow options without error", async () => {
    const wfOptions: WorkflowPreference[] = ["move_fast", "balanced", "strict_review"];
    for (const workflow of wfOptions) {
      const result = customizeContent("Workflow: {{WORKFLOW_HINT}}", {
        orgName: "Test", teamName: "Test", tooling: "cursor", scale: "small", workflow,
      });
      expect(result).not.toContain("{{WORKFLOW_HINT}}");
    }
  });
});
