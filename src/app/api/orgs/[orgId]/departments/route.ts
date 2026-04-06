/**
 * GET /api/orgs/:orgId/departments — List departments in an organization.
 * POST /api/orgs/:orgId/departments — Create a department (with template provisioning).
 *
 * Per api-security-best-practices: auth + org RBAC required.
 */

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/api-helpers";
import { getOrgById, listDepartments, createDepartment } from "@/services/org-service";
import { getDepartmentTemplateSummaries } from "@/services/department-templates";
import { DEPARTMENT_TYPES, type DepartmentType } from "@/types/organization";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult.response;

  const { orgId } = await params;
  let orgOid: ObjectId;
  try {
    orgOid = new ObjectId(orgId);
  } catch {
    return NextResponse.json({ error: "Invalid orgId" }, { status: 400 });
  }

  const db = await getDb();

  // Verify org exists and user has access
  const org = await getOrgById(db, orgOid);
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const departments = await listDepartments(db, orgOid);

  return NextResponse.json({
    departments: departments.map((d) => ({
      id: d._id.toHexString(),
      name: d.name,
      type: d.type,
      description: d.description,
      teamCount: d.teamCount,
      defaultAssetCount: d.defaultAssetIds.length,
      createdAt: d.createdAt.toISOString(),
    })),
    availableTemplates: getDepartmentTemplateSummaries(),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult.response;

  const { orgId } = await params;
  let orgOid: ObjectId;
  try {
    orgOid = new ObjectId(orgId);
  } catch {
    return NextResponse.json({ error: "Invalid orgId" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, type, description } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!type || !DEPARTMENT_TYPES.includes(type as DepartmentType)) {
    return NextResponse.json(
      { error: `type must be one of: ${DEPARTMENT_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  const db = await getDb();
  const userId = new ObjectId(authResult.userId);

  // Verify org exists
  const org = await getOrgById(db, orgOid);
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // RBAC: only org owner/admin can create departments
  if (org.owner.userId.toHexString() !== userId.toHexString()) {
    return NextResponse.json({ error: "Only organization owner can create departments" }, { status: 403 });
  }

  const result = await createDepartment(db, {
    orgId: orgOid,
    name: name as string,
    type: type as DepartmentType,
    description: description as string | undefined,
  }, userId);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  return NextResponse.json(
    {
      deptId: result.deptId!.toHexString(),
      name,
      type,
      provisionedAssets: result.assetIds?.length ?? 0,
      message: "Department created" + (result.assetIds?.length ? ` with ${result.assetIds.length} template asset(s)` : ""),
    },
    { status: 201 }
  );
}
