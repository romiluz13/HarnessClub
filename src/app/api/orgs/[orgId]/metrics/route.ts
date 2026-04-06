/**
 * GET /api/orgs/[orgId]/metrics — Org-level KPIs with trend data.
 * Per api-security-best-practices: auth + org membership required.
 */

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/api-helpers";
import { getMetricsReport } from "@/services/metrics-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult.response;

  const { orgId: orgIdStr } = await params;
  if (!ObjectId.isValid(orgIdStr)) {
    return NextResponse.json({ error: "Invalid orgId" }, { status: 400 });
  }

  const db = await getDb();
  const orgId = new ObjectId(orgIdStr);

  const org = await db.collection("organizations").findOne({ _id: orgId });
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Gather all teams under this org
  const teams = await db.collection("teams")
    .find({ orgId })
    .project({ _id: 1 })
    .toArray();
  const teamIds = teams.map((t) => t._id);

  const report = await getMetricsReport(db, "org", orgId, org.name, teamIds);

  return NextResponse.json(report);
}
