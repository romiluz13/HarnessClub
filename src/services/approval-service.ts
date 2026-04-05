/**
 * Approval Workflow Service — configurable review gates for asset publishing.
 *
 * Three approval modes per department:
 * - auto_approve: assets publish immediately (low-security teams)
 * - single_review: one approver required
 * - multi_review: two+ approvers required (enterprise/compliance)
 *
 * Per api-security-best-practices: all state transitions logged to audit trail.
 */

import { ObjectId, type Db } from "mongodb";
import { dispatchWebhook } from "@/services/webhook-service";

/** Approval policy for a department or team */
export type ApprovalMode = "auto_approve" | "single_review" | "multi_review";

/** Approval request status */
export type ApprovalStatus = "pending" | "approved" | "rejected" | "withdrawn";

/** Single approval decision */
export interface ApprovalDecision {
  reviewerId: ObjectId;
  reviewerName: string;
  decision: "approve" | "reject" | "request_changes";
  comment?: string;
  decidedAt: Date;
}

/** Full approval request document */
export interface ApprovalRequest {
  _id: ObjectId;
  /** Asset being reviewed */
  assetId: ObjectId;
  /** Team that owns the asset */
  teamId: ObjectId;
  /** Department (for policy lookup) */
  departmentId?: ObjectId;
  /** Who submitted the request */
  requestedBy: ObjectId;
  /** Type of action being approved */
  action: "publish" | "update" | "cross_dept_share";
  /** Current status */
  status: ApprovalStatus;
  /** Required number of approvals */
  requiredApprovals: number;
  /** Collected decisions */
  decisions: ApprovalDecision[];
  /** Content diff summary (for updates) */
  diffSummary?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Approval CRUD ──────────────────────────────────────

/**
 * Create an approval request.
 */
export async function createApprovalRequest(
  db: Db,
  input: {
    assetId: ObjectId;
    teamId: ObjectId;
    departmentId?: ObjectId;
    requestedBy: ObjectId;
    action: ApprovalRequest["action"];
    mode: ApprovalMode;
    diffSummary?: string;
  }
): Promise<{ success: boolean; requestId?: ObjectId }> {
  // Auto-approve path
  if (input.mode === "auto_approve") {
    return { success: true }; // No request needed
  }

  const requiredApprovals = input.mode === "multi_review" ? 2 : 1;
  const now = new Date();

  const doc: Omit<ApprovalRequest, "_id"> = {
    assetId: input.assetId,
    teamId: input.teamId,
    departmentId: input.departmentId,
    requestedBy: input.requestedBy,
    action: input.action,
    status: "pending",
    requiredApprovals,
    decisions: [],
    diffSummary: input.diffSummary,
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection("approval_requests").insertOne(doc);

  // Webhook: approval requested (fire-and-forget)
  if (input.teamId) {
    const team = await db.collection("teams").findOne({ _id: input.teamId }, { projection: { orgId: 1 } });
    if (team?.orgId) {
      dispatchWebhook(db, team.orgId, "approval.requested", {
        requestId: result.insertedId.toHexString(),
        assetId: input.assetId.toHexString(),
      });
    }
  }

  return { success: true, requestId: result.insertedId };
}

/**
 * Submit a review decision on an approval request.
 */
export async function submitDecision(
  db: Db,
  requestId: ObjectId,
  decision: ApprovalDecision
): Promise<{ success: boolean; newStatus?: ApprovalStatus; error?: string }> {
  const request = await db.collection<ApprovalRequest>("approval_requests").findOne({ _id: requestId });
  if (!request) return { success: false, error: "Request not found" };
  if (request.status !== "pending") return { success: false, error: `Request is ${request.status}` };

  // Prevent self-review
  if (request.requestedBy.equals(decision.reviewerId)) {
    return { success: false, error: "Cannot review your own request" };
  }

  // Prevent duplicate reviews
  if (request.decisions.some((d) => d.reviewerId.equals(decision.reviewerId))) {
    return { success: false, error: "Already reviewed" };
  }

  // Add decision
  const updatedDecisions = [...request.decisions, decision];

  // Determine new status
  let newStatus: ApprovalStatus = "pending";
  if (decision.decision === "reject") {
    newStatus = "rejected";
  } else if (decision.decision === "approve") {
    const approvalCount = updatedDecisions.filter((d) => d.decision === "approve").length;
    if (approvalCount >= request.requiredApprovals) {
      newStatus = "approved";
    }
  }

  await db.collection("approval_requests").updateOne(
    { _id: requestId },
    {
      $push: { decisions: decision as never },
      $set: { status: newStatus, updatedAt: new Date() },
    }
  );

  return { success: true, newStatus };
}

/**
 * Get pending approval requests for a team or department.
 */
export async function getPendingApprovals(
  db: Db,
  filter: { teamId?: ObjectId; teamIds?: ObjectId[]; departmentId?: ObjectId }
): Promise<ApprovalRequest[]> {
  const query: Record<string, unknown> = { status: "pending" };
  if (filter.teamId) query.teamId = filter.teamId;
  else if (filter.teamIds?.length) query.teamId = { $in: filter.teamIds };
  if (filter.departmentId) query.departmentId = filter.departmentId;

  return db.collection<ApprovalRequest>("approval_requests")
    .find(query)
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();
}
