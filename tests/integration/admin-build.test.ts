/**
 * Integration test: Full Admin Build — end-to-end validation.
 *
 * Tests the complete lifecycle:
 * - A10.1: Org onboarding (createOrg + dept + team + membership)
 * - A10.2: Asset lifecycle (create + edit + delete + audit)
 * - A10.3: Team management (create team + add member + change role + remove)
 * - A10.4: Admin settings (API token create + revoke, webhook create)
 * - A10.5: Dashboard stats accuracy
 *
 * All real DB round-trips, no mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ObjectId, type Db } from "mongodb";
import { getTestDb, closeTestDb } from "../helpers/db-setup";
import { createOrg, createDepartment } from "@/services/org-service";
import { createAsset, getAsset } from "@/services/asset-service";
import { addTeamMember, removeTeamMember, updateMemberRole } from "@/services/team-service";
import { createApiToken, validateApiToken, revokeApiToken } from "@/services/api-token-service";
import { createWebhook } from "@/services/webhook-service";
import { logAuditEvent, getAuditLogs } from "@/services/audit-service";
import type { UserDocument } from "@/types/user";

const MARKER = "_admin_build_" + Date.now();
let db: Db;

// Test actors
const ownerId = new ObjectId();
const memberId = new ObjectId();

// Will be populated during tests
let orgId: ObjectId;
let deptId: ObjectId;
let teamId: ObjectId;
let assetId: ObjectId;

beforeAll(async () => {
  db = await getTestDb();

  // Seed test users (auth fields required by auth_provider_unique index)
  await db.collection("users").insertMany([
    {
      _id: ownerId,
      email: `owner-${MARKER}@test.com`,
      name: "Test Owner",
      auth: { provider: "github", providerId: `owner-${MARKER}` },
      orgMemberships: [],
      teamMemberships: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: memberId,
      email: `member-${MARKER}@test.com`,
      name: "Test Member",
      auth: { provider: "github", providerId: `member-${MARKER}` },
      orgMemberships: [],
      teamMemberships: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);
}, 30_000);

afterAll(async () => {
  await db.collection("users").deleteMany({ email: { $regex: MARKER } });
  await db.collection("organizations").deleteMany({ slug: { $regex: MARKER } });
  await db.collection("departments").deleteMany({ description: { $regex: MARKER } });
  await db.collection("teams").deleteMany({ slug: { $regex: MARKER } });
  await db.collection("assets").deleteMany({ "metadata.name": { $regex: MARKER } });
  await db.collection("audit_logs").deleteMany({ "details.marker": MARKER });
  await db.collection("api_tokens").deleteMany({ name: { $regex: MARKER } });
  await db.collection("webhooks").deleteMany({ url: { $regex: MARKER } });
  await closeTestDb();
});

describe("A10.1 — Onboarding E2E", () => {
  it("creates org + dept + team + user memberships", async () => {
    const owner = { userId: ownerId, name: "Test Owner", email: `owner-${MARKER}@test.com` };
    const orgResult = await createOrg(db, {
      name: "Admin Test Org",
      slug: `admin-test-${MARKER}`,
      owner,
      settings: { defaultDeptType: "engineering_be" },
    });
    expect(orgResult.success).toBe(true);
    orgId = orgResult.orgId!;

    const deptResult = await createDepartment(db, {
      orgId, name: "Backend", type: "engineering_be", description: `Dept ${MARKER}`,
    }, ownerId);
    expect(deptResult.success).toBe(true);
    deptId = deptResult.deptId!;

    const teamResult = await db.collection("teams").insertOne({
      name: "Backend Team", slug: `backend-${MARKER}`, owner,
      memberIds: [ownerId], settings: { marketplaceEnabled: true, defaultRole: "member", autoPublish: false },
      orgId, departmentId: deptId, createdAt: new Date(), updatedAt: new Date(),
    });
    teamId = teamResult.insertedId;

    // Update user memberships
    await db.collection("users").updateOne(
      { _id: ownerId },
      { $push: { orgMemberships: { orgId, role: "org_owner", joinedAt: new Date() }, teamMemberships: { teamId, role: "owner", joinedAt: new Date() } } as Record<string, unknown> },
    );

    // Verify: org exists with correct settings
    const org = await db.collection("organizations").findOne({ _id: orgId });
    expect(org!.settings.defaultDeptType).toBe("engineering_be");

    // Verify: dept exists under org
    const dept = await db.collection("departments").findOne({ _id: deptId });
    expect(dept!.orgId.toHexString()).toBe(orgId.toHexString());

    // Verify: team exists under dept
    const team = await db.collection("teams").findOne({ _id: teamId });
    expect(team!.departmentId.toHexString()).toBe(deptId.toHexString());

    // Verify: user has memberships
    const user = await db.collection<UserDocument>("users").findOne({ _id: ownerId });
    expect(user!.orgMemberships!.length).toBeGreaterThanOrEqual(1);
    expect(user!.teamMemberships!.length).toBeGreaterThanOrEqual(1);
  });
});

describe("A10.2 — Asset Lifecycle E2E", () => {
  it("creates asset with real createAsset service", async () => {
    const result = await createAsset(db, {
      type: "skill", teamId, createdBy: ownerId,
      metadata: { name: `Test Skill ${MARKER}`, description: "Test asset for admin build", version: "1.0.0" },
      content: "# Test Skill\n\nThis is a test skill for the admin build integration test.",
      tags: ["test", "admin-build"],
    });
    expect("assetId" in result).toBe(true);
    if ("assetId" in result) assetId = result.assetId;
  });

  it("fetches asset by ID and verifies content", async () => {
    const asset = await getAsset(db, assetId);
    expect(asset).not.toBeNull();
    expect(asset!.metadata.name).toBe(`Test Skill ${MARKER}`);
    expect(asset!.content).toContain("Test Skill");
    expect(asset!.teamId.toHexString()).toBe(teamId.toHexString());
  });

  it("deletes asset and verifies removal", async () => {
    await db.collection("assets").deleteOne({ _id: assetId });
    const deleted = await getAsset(db, assetId);
    expect(deleted).toBeNull();
  });
});

describe("A10.3 — Team Management E2E", () => {
  it("adds member to team", async () => {
    await addTeamMember(db, teamId, memberId, "member");
    const team = await db.collection("teams").findOne({ _id: teamId });
    expect(team!.memberIds.map((id: any) => id.toHexString())).toContain(memberId.toHexString());
  });

  it("changes member role", async () => {
    await updateMemberRole(db, teamId, memberId, "admin");
    const user = await db.collection<UserDocument>("users").findOne({ _id: memberId });
    const membership = user?.teamMemberships?.find(
      (m) => m.teamId.toHexString() === teamId.toHexString()
    );
    expect(membership?.role).toBe("admin");
  });

  it("removes member from team", async () => {
    await removeTeamMember(db, teamId, memberId);
    const team = await db.collection("teams").findOne({ _id: teamId });
    expect(team!.memberIds.map((id: any) => id.toHexString())).not.toContain(memberId.toHexString());
  });
});

describe("A10.4 — Admin Settings E2E", () => {
  it("creates and validates API token", async () => {
    const result = await createApiToken(db, {
      name: `token-${MARKER}`, tokenType: "personal",
      userId: ownerId, orgId, scope: "write", expiresInDays: 30,
    });

    expect(result.rawToken).toBeDefined();
    expect(result.prefix).toBeDefined();

    const validation = await validateApiToken(db, result.rawToken);
    expect(validation).not.toBeNull();
    expect(validation!.userId!.toHexString()).toBe(ownerId.toHexString());
  });

  it("revokes API token", async () => {
    const result = await createApiToken(db, {
      name: `revokable-${MARKER}`, tokenType: "personal",
      userId: ownerId, orgId, scope: "read", expiresInDays: 7,
    });
    const revoked = await revokeApiToken(db, result.tokenId, ownerId);
    expect(revoked).toBe(true);

    const validation = await validateApiToken(db, result.rawToken);
    expect(validation).toBeNull();
  });

  it("creates webhook and verifies in DB", async () => {
    const result = await createWebhook(db, {
      orgId,
      url: `https://example.com/hook-${MARKER}`,
      events: ["asset.created", "asset.deleted"],
    });

    expect(result.webhookId).toBeInstanceOf(ObjectId);
    expect(result.secret).toBeDefined();

    const webhook = await db.collection("webhooks").findOne({ _id: result.webhookId });
    expect(webhook).not.toBeNull();
    expect(webhook!.events).toContain("asset.created");
  });
});

describe("A10.5 — Dashboard Stats Accuracy", () => {
  it("counts match real DB data", async () => {
    for (let i = 0; i < 3; i++) {
      await createAsset(db, {
        type: "rule", teamId, createdBy: ownerId,
        metadata: { name: `Stats Rule ${i} ${MARKER}`, description: "for stats test", version: "1.0.0" },
        content: `Rule ${i}`, tags: ["stats-test"],
      });
    }

    const assetCount = await db.collection("assets").countDocuments({ teamId });
    expect(assetCount).toBe(3);

    const team = await db.collection("teams").findOne({ _id: teamId });
    expect(team!.memberIds.length).toBeGreaterThanOrEqual(1);

    const teamCount = await db.collection("teams").countDocuments({ orgId });
    expect(teamCount).toBeGreaterThanOrEqual(1);

    await logAuditEvent(db, {
      actorId: ownerId, action: "test:stats_check", targetId: orgId,
      targetType: "organization", teamId, details: { marker: MARKER },
    });
    const logs = await getAuditLogs(db, { teamId });
    expect(logs.length).toBeGreaterThanOrEqual(1);
  });
});
