/**
 * GET /api/orgs/:orgId/compliance — Compliance report for organization.
 *
 * Optional query: ?departmentId=xxx to scope to a department.
 * Returns scan coverage, trust distribution, approval compliance, token hygiene.
 *
 * Per api-security-best-practices: auth + org membership required.
 */

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { requireAuth, requireOrgPermission } from "@/lib/api-helpers";
import { getOrgById, listDepartments } from "@/services/org-service";
import { generateComplianceReport } from "@/services/compliance-service";

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
  const userId = new ObjectId(authResult.userId);

  const org = await getOrgById(db, orgOid);
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const orgRole = await requireOrgPermission(db, userId, orgOid, "analytics:read");
  if (!orgRole) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  // Optional department filter
  const departmentId = request.nextUrl.searchParams.get("departmentId");

  if (departmentId) {
    let deptOid: ObjectId;
    try {
      deptOid = new ObjectId(departmentId);
    } catch {
      return NextResponse.json({ error: "Invalid departmentId" }, { status: 400 });
    }

    // Get teams in this department
    const teams = await db.collection("teams")
      .find({ departmentId: deptOid })
      .project({ _id: 1 })
      .toArray();
    const teamIds = teams.map((t) => t._id);

    const dept = await db.collection("departments").findOne({ _id: deptOid });
    const report = await generateComplianceReport(
      db,
      "department",
      deptOid,
      dept?.name ?? "Unknown Department",
      teamIds
    );

    return NextResponse.json({ report });
  }

  // Org-level report: gather all teams
  const departments = await listDepartments(db, orgOid);
  const deptIds = departments.map((d) => d._id);

  const teams = await db.collection("teams")
    .find({ departmentId: { $in: deptIds } })
    .project({ _id: 1 })
    .toArray();

  // Also include teams directly under the org (no department)
  const directTeams = await db.collection("teams")
    .find({ orgId: orgOid, departmentId: { $exists: false } })
    .project({ _id: 1 })
    .toArray();

  const allTeamIds = [...teams, ...directTeams].map((t) => t._id);

  const report = await generateComplianceReport(
    db,
    "org",
    orgOid,
    org.name,
    allTeamIds
  );

  return NextResponse.json({ report });
}
