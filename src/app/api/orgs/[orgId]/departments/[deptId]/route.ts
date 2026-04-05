/**
 * GET /api/orgs/:orgId/departments/:deptId — Department detail with assets.
 * PATCH /api/orgs/:orgId/departments/:deptId — Update department settings.
 *
 * Returns department info + assets from teams in this department.
 * Per api-security-best-practices: auth + org membership required.
 */

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/api-helpers";
import { getDepartment, getOrgById } from "@/services/org-service";
import type { AssetDocument } from "@/types/asset";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orgId: string; deptId: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.ok) return authResult.response;

  const { orgId, deptId } = await params;

  let orgOid: ObjectId;
  let deptOid: ObjectId;
  try {
    orgOid = new ObjectId(orgId);
    deptOid = new ObjectId(deptId);
  } catch {
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }

  const db = await getDb();

  // Verify org and department exist
  const [org, dept] = await Promise.all([
    getOrgById(db, orgOid),
    getDepartment(db, deptOid),
  ]);

  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }
  if (!dept || dept.orgId.toHexString() !== orgOid.toHexString()) {
    return NextResponse.json({ error: "Department not found" }, { status: 404 });
  }

  // Get teams in this department
  const teams = await db.collection("teams")
    .find({ orgId: orgOid, departmentId: deptOid })
    .project({ _id: 1, name: 1, slug: 1 })
    .toArray();

  const teamIds = teams.map((t) => t._id);

  // Get assets from teams in this department
  const assets = await db.collection<AssetDocument>("assets")
    .find({ teamId: { $in: teamIds } })
    .project({
      type: 1,
      "metadata.name": 1,
      "metadata.description": 1,
      tags: 1,
      isPublished: 1,
      updatedAt: 1,
    })
    .sort({ type: 1, "metadata.name": 1 })
    .limit(100)
    .toArray();

  // Type breakdown
  const typeBreakdown: Record<string, number> = {};
  for (const a of assets) {
    typeBreakdown[a.type] = (typeBreakdown[a.type] ?? 0) + 1;
  }

  // Default assets (from template provisioning)
  const defaultAssets = dept.defaultAssetIds.length > 0
    ? await db.collection<AssetDocument>("assets")
        .find({ _id: { $in: dept.defaultAssetIds } })
        .project({ type: 1, "metadata.name": 1, "metadata.description": 1 })
        .toArray()
    : [];

  return NextResponse.json({
    department: {
      id: dept._id.toHexString(),
      orgId: dept.orgId.toHexString(),
      name: dept.name,
      type: dept.type,
      description: dept.description,
      teamCount: teams.length,
      createdAt: dept.createdAt.toISOString(),
    },
    teams: teams.map((t) => ({
      id: t._id.toHexString(),
      name: t.name,
      slug: t.slug,
    })),
    assets: {
      items: assets.map((a) => ({
        id: a._id.toHexString(),
        type: a.type,
        name: a.metadata.name,
        description: a.metadata.description,
        isPublished: a.isPublished,
      })),
      totalCount: assets.length,
      typeBreakdown,
    },
    defaultAssets: defaultAssets.map((a) => ({
      id: a._id.toHexString(),
      type: a.type,
      name: a.metadata.name,
    })),
  });
}
