/**
 * GET  /api/orgs — List user's organizations.
 * POST /api/orgs — Onboarding: create org + department + team + memberships.
 *
 * POST creates the full hierarchy in one atomic call:
 *   1. Organization with settings
 *   2. Default department (from selected type)
 *   3. First team under that department
 *   4. User orgMembership (org_owner) + teamMembership (owner)
 *   5. Audit log entry
 *
 * Per api-security-best-practices: auth required, input validation.
 */

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/api-helpers";
import { createOrg, createDepartment, listUserOrgs } from "@/services/org-service";
import { logAuditEvent } from "@/services/audit-service";
import type { DepartmentType } from "@/types/organization";
import type { UserDocument } from "@/types/user";

const VALID_DEPT_TYPES: readonly string[] = [
  "engineering_fe", "engineering_be", "devops", "data_science",
  "product", "design", "qa", "sales", "legal", "marketing", "support", "custom",
];

export async function GET() {
  const authResult = await requireAuth();
  if (!authResult.ok) return authResult.response;

  const db = await getDb();
  const userId = new ObjectId(authResult.userId);
  const orgs = await listUserOrgs(db, userId);

  return NextResponse.json({
    organizations: orgs.map((o) => ({
      id: o._id.toHexString(),
      name: o.name,
      slug: o.slug,
      plan: o.plan,
      settings: o.settings,
      createdAt: o.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (!authResult.ok) return authResult.response;

  let body: { orgName: string; deptType: string; teamName: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.orgName || typeof body.orgName !== "string" || body.orgName.trim().length < 2) {
    return NextResponse.json({ error: "orgName must be at least 2 characters" }, { status: 400 });
  }
  if (!body.teamName || typeof body.teamName !== "string" || body.teamName.trim().length < 2) {
    return NextResponse.json({ error: "teamName must be at least 2 characters" }, { status: 400 });
  }
  if (!body.deptType || !VALID_DEPT_TYPES.includes(body.deptType)) {
    return NextResponse.json(
      { error: `deptType must be one of: ${VALID_DEPT_TYPES.join(", ")}` },
      { status: 400 },
    );
  }

  const db = await getDb();
  const userId = new ObjectId(authResult.userId);

  const user = await db.collection<UserDocument>("users").findOne({ _id: userId });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const orgName = body.orgName.trim();
  const teamName = body.teamName.trim();
  const deptType = body.deptType as DepartmentType;
  const orgSlug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const teamSlug = teamName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const owner = { userId, name: user.name, email: user.email };

  // 1. Create organization
  const orgResult = await createOrg(db, {
    name: orgName,
    slug: orgSlug,
    owner,
    settings: { defaultDeptType: deptType },
  });
  if (!orgResult.success || !orgResult.orgId) {
    return NextResponse.json({ error: orgResult.error ?? "Failed to create org" }, { status: 409 });
  }

  // 2. Create default department
  const deptDisplayName = deptType === "custom"
    ? "General"
    : deptType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const deptResult = await createDepartment(db, {
    orgId: orgResult.orgId,
    name: deptDisplayName,
    type: deptType,
    description: `Default department for ${orgName}`,
  }, userId);

  // 3. Create first team
  const teamResult = await db.collection("teams").insertOne({
    name: teamName,
    slug: teamSlug,
    owner,
    memberIds: [userId],
    settings: { marketplaceEnabled: true, defaultRole: "member" as const, autoPublish: false },
    orgId: orgResult.orgId,
    departmentId: deptResult.deptId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // 4. Update user memberships
  const now = new Date();
  await db.collection("users").updateOne(
    { _id: userId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    {
      $push: {
        orgMemberships: { orgId: orgResult.orgId, role: "org_owner", joinedAt: now },
        teamMemberships: { teamId: teamResult.insertedId, role: "owner", joinedAt: now },
      },
      $set: { updatedAt: now },
    } as any,
  );

  // 5. Audit log
  await logAuditEvent(db, {
    actorId: userId,
    action: "org:create",
    targetId: orgResult.orgId,

    teamId: teamResult.insertedId,
    details: { orgName, deptType, teamName },
  });

  return NextResponse.json({
    orgId: orgResult.orgId.toHexString(),
    departmentId: deptResult.deptId!.toHexString(),
    teamId: teamResult.insertedId.toHexString(),
  }, { status: 201 });
}
