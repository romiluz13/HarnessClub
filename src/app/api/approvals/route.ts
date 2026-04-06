/**
 * GET /api/approvals — List pending approval requests for user's teams.
 * POST /api/approvals — Create a new approval request.
 *
 * Per api-security-best-practices: auth required, RBAC checks.
 */

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { getMemberRole, getUserTeamIds, requireAuth } from "@/lib/api-helpers";
import {
  createApprovalRequest,
  getPendingApprovals,
  type ApprovalMode,
} from "@/services/approval-service";
import { hasPermission } from "@/lib/rbac";
import type { AssetDocument } from "@/types/asset";

const VALID_MODES: ApprovalMode[] = ["auto_approve", "single_review", "multi_review"];
const VALID_ACTIONS = ["publish", "update", "cross_dept_share"] as const;

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult.response;

  const db = await getDb();
  const teamId = request.nextUrl.searchParams.get("teamId");
  const deptId = request.nextUrl.searchParams.get("departmentId");
  const userId = new ObjectId(authResult.userId);
  const userTeamIds = await getUserTeamIds(db, authResult.userId);

  if (userTeamIds.length === 0) {
    return NextResponse.json({ approvals: [], count: 0 });
  }

  const filter: { teamId?: ObjectId; teamIds?: ObjectId[]; departmentId?: ObjectId } = {};
  if (teamId) {
    try {
      filter.teamId = new ObjectId(teamId);
    } catch {
      return NextResponse.json({ error: "Invalid teamId" }, { status: 400 });
    }
    const role = await getMemberRole(db, userId, filter.teamId);
    if (!role || !hasPermission(role, "skill:read")) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }
  } else {
    filter.teamIds = userTeamIds;
  }
  if (deptId) {
    try { filter.departmentId = new ObjectId(deptId); } catch {
      return NextResponse.json({ error: "Invalid departmentId" }, { status: 400 });
    }
  }

  const requests = await getPendingApprovals(db, filter);

  // Enrich with asset + requester names
  const assetIds = [...new Set(requests.map((r) => r.assetId))];
  const requesterIds = [...new Set(requests.map((r) => r.requestedBy))];

  const [assets, requesters] = await Promise.all([
    assetIds.length > 0
      ? db.collection("assets").find({ _id: { $in: assetIds } }).project({ "metadata.name": 1, type: 1 }).toArray()
      : [],
    requesterIds.length > 0
      ? db.collection("users").find({ _id: { $in: requesterIds } }).project({ name: 1, email: 1 }).toArray()
      : [],
  ]);

  const assetMap = new Map(assets.map((a) => [a._id.toHexString(), { name: a.metadata?.name ?? "Unknown", type: a.type ?? "asset" }]));
  const requesterMap = new Map(requesters.map((u) => [u._id.toHexString(), u.name ?? u.email ?? "Unknown"]));

  return NextResponse.json({
    approvals: requests.map((r) => ({
      id: r._id.toHexString(),
      assetId: r.assetId.toHexString(),
      assetName: assetMap.get(r.assetId.toHexString())?.name ?? "Unknown",
      assetType: assetMap.get(r.assetId.toHexString())?.type ?? "asset",
      requesterName: requesterMap.get(r.requestedBy.toHexString()) ?? "Unknown",
      action: r.action,
      status: r.status,
      requiredApprovals: r.requiredApprovals,
      currentApprovals: r.decisions.filter((d) => d.decision === "approve").length,
      reviewComment: r.decisions[0]?.comment ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
    count: requests.length,
  });
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { assetId, teamId, departmentId, action, mode } = body;

  if (!assetId || typeof assetId !== "string") {
    return NextResponse.json({ error: "assetId is required" }, { status: 400 });
  }
  if (!teamId || typeof teamId !== "string") {
    return NextResponse.json({ error: "teamId is required" }, { status: 400 });
  }
  if (!action || !VALID_ACTIONS.includes(action as typeof VALID_ACTIONS[number])) {
    return NextResponse.json({ error: `action must be: ${VALID_ACTIONS.join(", ")}` }, { status: 400 });
  }
  if (!mode || !VALID_MODES.includes(mode as ApprovalMode)) {
    return NextResponse.json({ error: `mode must be: ${VALID_MODES.join(", ")}` }, { status: 400 });
  }

  const db = await getDb();
  const userId = new ObjectId(authResult.userId);

  let assetOid: ObjectId;
  let teamOid: ObjectId;
  try {
    assetOid = new ObjectId(assetId);
    teamOid = new ObjectId(teamId);
  } catch {
    return NextResponse.json({ error: "assetId and teamId must be valid ObjectIds" }, { status: 400 });
  }

  const asset = await db.collection<Pick<AssetDocument, "_id" | "teamId">>("assets").findOne(
    { _id: assetOid },
    { projection: { teamId: 1 } }
  );
  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }
  if (!asset.teamId.equals(teamOid)) {
    return NextResponse.json({ error: "Asset does not belong to the specified team" }, { status: 400 });
  }

  const role = await getMemberRole(db, userId, teamOid);
  if (!role || !hasPermission(role, "skill:update")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }
  if (mode === "auto_approve" && !hasPermission(role, "skill:publish")) {
    return NextResponse.json({ error: "Only publishing roles can auto-approve changes" }, { status: 403 });
  }

  let deptOid: ObjectId | undefined;
  if (departmentId && typeof departmentId === "string") {
    try { deptOid = new ObjectId(departmentId); } catch {
      return NextResponse.json({ error: "Invalid departmentId" }, { status: 400 });
    }
  }

  const result = await createApprovalRequest(db, {
    assetId: assetOid,
    teamId: teamOid,
    departmentId: deptOid,
    requestedBy: userId,
    action: action as "publish" | "update" | "cross_dept_share",
    mode: mode as ApprovalMode,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error ?? "Unable to create approval request" }, { status: 400 });
  }

  if (result.autoApproved) {
    const autoApprovedReleaseStatus = action === "cross_dept_share" ? "approved" : "published";
    return NextResponse.json({
      message: "Auto-approved",
      approved: true,
      releaseStatus: autoApprovedReleaseStatus,
    }, { status: 200 });
  }

  return NextResponse.json(
    { requestId: result.requestId!.toHexString(), message: "Approval request created", releaseStatus: "pending_review" },
    { status: 201 }
  );
}
