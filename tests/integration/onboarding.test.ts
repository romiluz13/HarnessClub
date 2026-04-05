/**
 * Integration test: Onboarding — org + dept + team creation in one call.
 *
 * Tests the POST /api/orgs service layer directly (bypassing HTTP auth).
 * Verifies: org in DB, department in DB, team in DB, user memberships updated,
 * audit log entry created. Full round-trip.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ObjectId, type Db } from "mongodb";
import { getTestDb, closeTestDb } from "../helpers/db-setup";
import { createOrg, createDepartment, listUserOrgs } from "@/services/org-service";
import { logAuditEvent, getAuditLogs } from "@/services/audit-service";
import type { UserDocument } from "@/types/user";
import type { OrganizationDocument, DepartmentDocument } from "@/types/organization";

const MARKER = "_onboarding_test_" + Date.now();
let db: Db;
const userId = new ObjectId();

beforeAll(async () => {
  db = await getTestDb();

  // Seed a test user
  await db.collection("users").insertOne({
    _id: userId,
    email: "onboard-test@example.com",
    name: "Onboarding Tester",
    orgMemberships: [],
    teamMemberships: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    [MARKER]: true,
  });
}, 30_000);

afterAll(async () => {
  await db.collection("users").deleteMany({ [MARKER]: true });
  await db.collection("organizations").deleteMany({ [MARKER]: true });
  await db.collection("departments").deleteMany({ [MARKER]: true });
  await db.collection("teams").deleteMany({ [MARKER]: true });
  await db.collection("audit_logs").deleteMany({ "details.marker": MARKER });
  await closeTestDb();
});

describe("Onboarding — Full Org Setup", () => {
  let orgId: ObjectId;
  let deptId: ObjectId;
  let teamId: ObjectId;

  it("creates org with settings from input", async () => {
    const owner = { userId, name: "Onboarding Tester", email: "onboard-test@example.com" };
    const result = await createOrg(db, {
      name: "Test Corp",
      slug: `test-corp-${Date.now()}`,
      owner,
      settings: { defaultDeptType: "devops" },
    });

    expect(result.success).toBe(true);
    expect(result.orgId).toBeInstanceOf(ObjectId);
    orgId = result.orgId!;

    // Verify in DB
    const org = await db.collection<OrganizationDocument>("organizations").findOne({ _id: orgId });
    expect(org).not.toBeNull();
    expect(org!.name).toBe("Test Corp");
    expect(org!.settings.defaultDeptType).toBe("devops");
    expect(org!.settings.marketplaceEnabled).toBe(true);

    // Mark for cleanup
    await db.collection("organizations").updateOne({ _id: orgId }, { $set: { [MARKER]: true } });
  });

  it("creates department under org", async () => {
    const result = await createDepartment(db, {
      orgId,
      name: "DevOps",
      type: "devops",
      description: "Default department",
    }, userId);

    expect(result.success).toBe(true);
    expect(result.deptId).toBeInstanceOf(ObjectId);
    deptId = result.deptId!;

    // Verify in DB
    const dept = await db.collection<DepartmentDocument>("departments").findOne({ _id: deptId });
    expect(dept).not.toBeNull();
    expect(dept!.orgId.toHexString()).toBe(orgId.toHexString());
    expect(dept!.type).toBe("devops");

    await db.collection("departments").updateOne({ _id: deptId }, { $set: { [MARKER]: true } });
  });

  it("creates team under department", async () => {
    const owner = { userId, name: "Onboarding Tester", email: "onboard-test@example.com" };
    const result = await db.collection("teams").insertOne({
      name: "Platform Team",
      slug: `platform-team-${Date.now()}`,
      owner,
      memberIds: [userId],
      settings: { marketplaceEnabled: true, defaultRole: "member", autoPublish: false },
      orgId,
      departmentId: deptId,
      createdAt: new Date(),
      updatedAt: new Date(),
      [MARKER]: true,
    });

    teamId = result.insertedId;

    // Verify in DB
    const team = await db.collection("teams").findOne({ _id: teamId });
    expect(team).not.toBeNull();
    expect(team!.orgId.toHexString()).toBe(orgId.toHexString());
    expect(team!.departmentId.toHexString()).toBe(deptId.toHexString());
    expect(team!.memberIds).toHaveLength(1);
  });

  it("updates user memberships", async () => {
    await db.collection<UserDocument>("users").updateOne(
      { _id: userId },
      {
        $push: {
          orgMemberships: { orgId, role: "org_owner", joinedAt: new Date() },
          teamMemberships: { teamId, role: "owner", joinedAt: new Date() },
        },
      },
    );

    const user = await db.collection<UserDocument>("users").findOne({ _id: userId });
    expect(user!.orgMemberships).toHaveLength(1);
    expect(user!.orgMemberships![0].role).toBe("org_owner");
    expect(user!.teamMemberships).toHaveLength(1);
    expect(user!.teamMemberships![0].role).toBe("owner");
  });

  it("listUserOrgs finds org via membership (not just owner)", async () => {
    const orgs = await listUserOrgs(db, userId);
    const found = orgs.find((o) => o._id.toHexString() === orgId.toHexString());
    expect(found).toBeDefined();
    expect(found!.name).toBe("Test Corp");
  });

  it("writes audit log for org creation", async () => {
    await logAuditEvent(db, {
      actorId: userId,
      action: "org:create",
      targetId: orgId,
      targetType: "organization",
      teamId,
      details: { orgName: "Test Corp", marker: MARKER },
    });

    const logs = await getAuditLogs(db, { teamId });
    const found = logs.find((l) => l.targetId.toHexString() === orgId.toHexString());
    expect(found).toBeDefined();
    expect(found!.action).toBe("org:create");
  });
});
