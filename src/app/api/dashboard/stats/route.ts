/**
 * GET /api/dashboard/stats — Real dashboard statistics.
 *
 * Returns counts from MongoDB for the user's active team:
 * - assetCount: total assets in team
 * - memberCount: team member count
 * - teamCount: teams in the user's org
 * - pendingApprovals: approval requests with status=pending
 * - recentActivity: last 10 audit log entries
 *
 * All data is REAL — from DB aggregation, not hardcoded.
 */

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/api-helpers";
import type { UserDocument } from "@/types/user";
import type { AuditLogEntry } from "@/services/audit-service";

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult.response;

  const db = await getDb();
  const userId = new ObjectId(authResult.userId);

  // Get user's active org + team from memberships
  const user = await db.collection<UserDocument>("users").findOne({ _id: userId });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const orgMembership = user.orgMemberships?.[0];
  const teamMembership = user.teamMemberships?.[0];

  if (!orgMembership || !teamMembership) {
    return NextResponse.json({
      assetCount: 0,
      memberCount: 0,
      teamCount: 0,
      pendingApprovals: 0,
      recentActivity: [],
    });
  }

  const orgId = orgMembership.orgId;
  const teamId = teamMembership.teamId;

  // Run all counts in parallel — independent queries
  const [assetCount, team, teamCount, pendingApprovals, recentActivity] = await Promise.all([
    // Count assets in this team
    db.collection("assets").countDocuments({ teamId }),

    // Get team for member count
    db.collection("teams").findOne({ _id: teamId }),

    // Count teams in this org
    db.collection("teams").countDocuments({ orgId }),

    // Count pending approvals for this team
    db.collection("approvals").countDocuments({ teamId, status: "pending" }),

    // Last 10 audit events for this team
    db.collection<AuditLogEntry>("audit_logs")
      .find({ teamId })
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray(),
  ]);

  const memberCount = team?.memberIds?.length ?? 1;

  // Enrich activity with actor names
  const actorIds = [...new Set(recentActivity.map((a) => a.actorId.toHexString()))];
  const actors = actorIds.length > 0
    ? await db.collection("users")
        .find({ _id: { $in: actorIds.map((id) => new ObjectId(id)) } })
        .project({ name: 1, email: 1 })
        .toArray()
    : [];
  const actorMap = new Map(actors.map((a) => [a._id.toHexString(), a.name ?? a.email]));

  const activity = recentActivity.map((entry) => ({
    id: entry._id.toHexString(),
    action: entry.action,
    actorName: actorMap.get(entry.actorId.toHexString()) ?? "Unknown",
    targetId: entry.targetId.toHexString(),
    targetType: entry.targetType ?? null,
    details: entry.details ?? null,
    timestamp: entry.timestamp.toISOString(),
  }));

  return NextResponse.json({
    assetCount,
    memberCount,
    teamCount,
    pendingApprovals,
    recentActivity: activity,
  });
}
