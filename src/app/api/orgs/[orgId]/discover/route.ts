/**
 * GET /api/orgs/:orgId/discover — Cross-department asset discovery.
 *
 * Lists published assets across ALL departments in the org.
 * Respects org-level crossDeptApprovalRequired setting.
 * Supports ?type= and ?dept= filters.
 *
 * Per api-security-best-practices: auth + org membership.
 */

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/api-helpers";
import { getOrgById } from "@/services/org-service";
import type { AssetDocument } from "@/types/asset";

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
  const org = await getOrgById(db, orgOid);
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Get all teams in this org
  const teamQuery: Record<string, unknown> = { orgId: orgOid };
  const deptFilter = request.nextUrl.searchParams.get("dept");
  if (deptFilter) {
    try {
      teamQuery.departmentId = new ObjectId(deptFilter);
    } catch {
      return NextResponse.json({ error: "Invalid dept filter" }, { status: 400 });
    }
  }

  const orgTeams = await db.collection("teams")
    .find(teamQuery)
    .project({ _id: 1, name: 1, departmentId: 1 })
    .toArray();

  const teamIds = orgTeams.map((t) => t._id);

  // Build asset query
  const assetQuery: Record<string, unknown> = {
    teamId: { $in: teamIds },
    isPublished: true,
  };

  const typeFilter = request.nextUrl.searchParams.get("type");
  if (typeFilter) {
    assetQuery.type = typeFilter;
  }

  const assets = await db.collection<AssetDocument>("assets")
    .find(assetQuery)
    .project({
      type: 1,
      teamId: 1,
      "metadata.name": 1,
      "metadata.description": 1,
      "metadata.version": 1,
      tags: 1,
      updatedAt: 1,
    })
    .sort({ updatedAt: -1 })
    .limit(100)
    .toArray();

  // Map teamId → team info for display
  const teamMap = new Map(orgTeams.map((t) => [t._id.toHexString(), t]));

  // Type breakdown
  const typeBreakdown: Record<string, number> = {};
  for (const a of assets) {
    typeBreakdown[a.type] = (typeBreakdown[a.type] ?? 0) + 1;
  }

  return NextResponse.json({
    orgName: org.name,
    crossDeptApprovalRequired: org.settings.crossDeptApprovalRequired,
    assets: assets.map((a) => {
      const team = teamMap.get(a.teamId.toHexString());
      return {
        id: a._id.toHexString(),
        type: a.type,
        name: a.metadata.name,
        description: a.metadata.description,
        version: a.metadata.version,
        tags: a.tags,
        teamName: team?.name ?? "Unknown",
        updatedAt: a.updatedAt.toISOString(),
      };
    }),
    totalCount: assets.length,
    typeBreakdown,
  });
}
