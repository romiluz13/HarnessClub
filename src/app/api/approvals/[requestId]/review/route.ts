/**
 * POST /api/approvals/:requestId/review — Submit a review decision.
 *
 * Supports approve, reject, request_changes.
 * Per api-security-best-practices: auth required, no self-review.
 */

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { getMemberRole, requireAuth } from "@/lib/api-helpers";
import { submitDecision, type ApprovalDecision } from "@/services/approval-service";
import { hasPermission } from "@/lib/rbac";
import type { ApprovalRequest } from "@/services/approval-service";

const VALID_DECISIONS = ["approve", "reject", "request_changes"] as const;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult.response;

  const { requestId } = await params;
  let reqOid: ObjectId;
  try {
    reqOid = new ObjectId(requestId);
  } catch {
    return NextResponse.json({ error: "Invalid requestId" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { decision, comment } = body;
  if (!decision || !VALID_DECISIONS.includes(decision as typeof VALID_DECISIONS[number])) {
    return NextResponse.json({ error: `decision must be: ${VALID_DECISIONS.join(", ")}` }, { status: 400 });
  }

  const db = await getDb();
  const userId = new ObjectId(authResult.userId);
  const approvalRequest = await db.collection<ApprovalRequest>("approval_requests").findOne(
    { _id: reqOid },
    { projection: { teamId: 1 } }
  );

  if (!approvalRequest) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  const role = await getMemberRole(db, userId, approvalRequest.teamId);
  if (!role || !hasPermission(role, "skill:publish")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  // Get reviewer name
  const user = await db.collection("users").findOne({ _id: userId });

  const decisionInput: ApprovalDecision = {
    reviewerId: userId,
    reviewerName: user?.name ?? "Unknown",
    decision: decision as ApprovalDecision["decision"],
    comment: typeof comment === "string" ? comment : undefined,
    decidedAt: new Date(),
  };

  const result = await submitDecision(db, reqOid, decisionInput);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    status: result.newStatus,
    message: `Review submitted: ${decision}`,
  });
}
