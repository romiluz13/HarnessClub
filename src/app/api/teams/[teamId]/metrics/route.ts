/**
 * GET /api/teams/[teamId]/metrics — Team-level KPIs with trend data.
 * Per api-security-best-practices: auth + team membership required.
 */

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { requireAuth, getUserTeamIds } from "@/lib/api-helpers";
import { getMetricsReport } from "@/services/metrics-service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.ok) return authResult.response;

  const { teamId: teamIdStr } = await params;
  if (!ObjectId.isValid(teamIdStr)) {
    return NextResponse.json({ error: "Invalid teamId" }, { status: 400 });
  }

  const db = await getDb();
  const teamId = new ObjectId(teamIdStr);

  // Verify team membership
  const userTeams = await getUserTeamIds(db, authResult.userId);
  if (!userTeams.some((t) => t.equals(teamId))) {
    return NextResponse.json({ error: "Not a member of this team" }, { status: 403 });
  }

  const team = await db.collection("teams").findOne({ _id: teamId });
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const report = await getMetricsReport(db, "team", teamId, team.name, [teamId]);

  return NextResponse.json(report);
}
