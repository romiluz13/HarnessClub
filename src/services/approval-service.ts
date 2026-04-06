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
import { logAuditEvent } from "@/services/audit-service";
import type { AssetDocument, ReleaseStatus } from "@/types/asset";
import { getDraftReleaseStatus, getEffectiveReleaseStatus, isPublishedReleaseStatus } from "@/types/asset";

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
  /** Asset version under review */
  assetVersionNumber: number;
  /** Current status */
  status: ApprovalStatus;
  /** Required number of approvals */
  requiredApprovals: number;
  /** Collected decisions */
  decisions: ApprovalDecision[];
  /** Content diff summary (for updates) */
  diffSummary?: string;
  /** Summary of why a request was resolved/invalidated */
  decisionSummary?: string;
  /** Version number that invalidated this request */
  invalidatedByVersionNumber?: number;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}

interface ApprovalAssetProjection {
  _id: ObjectId;
  teamId: ObjectId;
  createdBy: ObjectId;
  isPublished: boolean;
  releaseStatus?: ReleaseStatus;
  currentVersionNumber?: number;
}

function getRequiredApprovals(mode: ApprovalMode): number {
  return mode === "multi_review" ? 2 : 1;
}

function getApprovedReleaseStatus(action: ApprovalRequest["action"]): ReleaseStatus {
  return action === "cross_dept_share" ? "approved" : "published";
}

function getAuditActionForApprovalStatus(status: Exclude<ApprovalStatus, "pending" | "withdrawn">): "approval:approve" | "approval:reject" {
  return status === "approved" ? "approval:approve" : "approval:reject";
}

function getAssetVersionFilter(versionNumber: number): Record<string, unknown> {
  if (versionNumber === 0) {
    return {
      $or: [
        { currentVersionNumber: 0 },
        { currentVersionNumber: { $exists: false } },
      ],
    };
  }

  return { currentVersionNumber: versionNumber };
}

async function safeLogAuditEvent(
  db: Db,
  input: Parameters<typeof logAuditEvent>[1]
): Promise<void> {
  try {
    await logAuditEvent(db, input);
  } catch (error) {
    console.warn("Approval audit logging failed:", error);
  }
}

async function loadApprovalAsset(db: Db, assetId: ObjectId): Promise<ApprovalAssetProjection | null> {
  return db.collection<ApprovalAssetProjection>("assets").findOne(
    { _id: assetId },
    {
      projection: {
        teamId: 1,
        createdBy: 1,
        isPublished: 1,
        releaseStatus: 1,
        currentVersionNumber: 1,
      },
    }
  );
}

async function setAssetReleaseState(
  db: Db,
  assetId: ObjectId,
  releaseStatus: ReleaseStatus
): Promise<void> {
  await db.collection<AssetDocument>("assets").updateOne(
    { _id: assetId },
    {
      $set: {
        releaseStatus,
        isPublished: isPublishedReleaseStatus(releaseStatus),
        updatedAt: new Date(),
      },
    }
  );
}

async function resolveApprovalOutcome(
  db: Db,
  request: ApprovalRequest,
  newStatus: Exclude<ApprovalStatus, "pending">,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const asset = await loadApprovalAsset(db, request.assetId);
  if (!asset) {
    return { success: false, error: "Asset not found" };
  }

  const currentVersionNumber = asset.currentVersionNumber ?? 0;
  if (newStatus === "approved" && currentVersionNumber !== request.assetVersionNumber) {
    await db.collection<ApprovalRequest>("approval_requests").updateOne(
      { _id: request._id },
      {
        $set: {
          status: "withdrawn",
          decisionSummary: "Asset changed after review request; submit a new approval request.",
          invalidatedByVersionNumber: currentVersionNumber,
          updatedAt: new Date(),
          resolvedAt: new Date(),
        },
      }
    );

    return {
      success: false,
      error: "Asset changed after this review request was opened. Submit a new approval request.",
    };
  }

  if (newStatus === "approved") {
    await setAssetReleaseState(db, request.assetId, getApprovedReleaseStatus(request.action));
    return { success: true };
  }

  const effectiveReleaseStatus = getEffectiveReleaseStatus(asset);
  if (effectiveReleaseStatus === "pending_review") {
    await setAssetReleaseState(db, request.assetId, getDraftReleaseStatus());
  }

  if (reason) {
    await db.collection<ApprovalRequest>("approval_requests").updateOne(
      { _id: request._id },
      { $set: { decisionSummary: reason, updatedAt: new Date(), resolvedAt: new Date() } }
    );
  }

  return { success: true };
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
): Promise<{ success: boolean; requestId?: ObjectId; autoApproved?: boolean; error?: string }> {
  const asset = await loadApprovalAsset(db, input.assetId);
  if (!asset) {
    return { success: false, error: "Asset not found" };
  }

  if (!asset.teamId.equals(input.teamId)) {
    return { success: false, error: "Asset does not belong to the specified team" };
  }

  const assetVersionNumber = asset.currentVersionNumber ?? 0;
  const effectiveReleaseStatus = getEffectiveReleaseStatus(asset);

  if (input.action === "publish" && effectiveReleaseStatus === "published") {
    return { success: false, error: "Asset is already published" };
  }

  if (input.action === "publish" && effectiveReleaseStatus === "pending_review") {
    const existingPendingRequest = await db.collection<ApprovalRequest>("approval_requests").findOne({
      assetId: input.assetId,
      teamId: input.teamId,
      action: input.action,
      assetVersionNumber,
      status: "pending",
    });

    if (existingPendingRequest) {
      return { success: true, requestId: existingPendingRequest._id };
    }
  }

  const existingRequest = await db.collection<ApprovalRequest>("approval_requests").findOne({
    assetId: input.assetId,
    teamId: input.teamId,
    action: input.action,
    assetVersionNumber,
    status: "pending",
  });

  if (existingRequest) {
    return { success: true, requestId: existingRequest._id };
  }

  if (input.mode === "auto_approve") {
    await setAssetReleaseState(db, input.assetId, getApprovedReleaseStatus(input.action));
    await safeLogAuditEvent(db, {
      actorId: input.requestedBy,
      action: "approval:approve",
      targetId: input.assetId,
      teamId: input.teamId,
      details: { action: input.action, assetVersionNumber, mode: input.mode, autoApproved: true },
    });
    return { success: true, autoApproved: true };
  }

  const requiredApprovals = getRequiredApprovals(input.mode);
  const now = new Date();

  const doc: ApprovalRequest = {
    _id: new ObjectId(),
    assetId: input.assetId,
    teamId: input.teamId,
    departmentId: input.departmentId,
    requestedBy: input.requestedBy,
    action: input.action,
    assetVersionNumber,
    status: "pending",
    requiredApprovals,
    decisions: [],
    diffSummary: input.diffSummary,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection<ApprovalRequest>("approval_requests").insertOne(doc);

  const assetUpdateResult = await db.collection<AssetDocument>("assets").updateOne(
    {
      _id: input.assetId,
      teamId: input.teamId,
      ...getAssetVersionFilter(assetVersionNumber),
    },
    {
      $set: {
        releaseStatus: "pending_review",
        isPublished: false,
        updatedAt: now,
      },
    }
  );

  if (assetUpdateResult.matchedCount === 0) {
    await db.collection<ApprovalRequest>("approval_requests").deleteOne({ _id: doc._id });
    return {
      success: false,
      error: "Asset changed before the approval request could be created. Try again.",
    };
  }

  await safeLogAuditEvent(db, {
    actorId: input.requestedBy,
    action: "approval:request",
    targetId: doc._id,
    teamId: input.teamId,
    details: {
      assetId: input.assetId.toHexString(),
      action: input.action,
      assetVersionNumber,
      requiredApprovals,
    },
  });

  // Webhook: approval requested (fire-and-forget)
  const team = await db.collection("teams").findOne({ _id: input.teamId }, { projection: { orgId: 1 } });
  if (team?.orgId) {
    dispatchWebhook(db, team.orgId, "approval.requested", {
      requestId: doc._id.toHexString(),
      assetId: input.assetId.toHexString(),
      assetVersionNumber,
      action: input.action,
    });
  }

  return { success: true, requestId: doc._id };
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
  if (request.decisions.some((existingDecision) => existingDecision.reviewerId.equals(decision.reviewerId))) {
    return { success: false, error: "Already reviewed" };
  }

  // Add decision
  const updatedDecisions = [...request.decisions, decision];

  // Determine new status
  let newStatus: ApprovalStatus = "pending";
  let decisionSummary: string | undefined;

  if (decision.decision === "reject" || decision.decision === "request_changes") {
    newStatus = "rejected";
    decisionSummary = decision.comment ?? "Changes requested before approval.";
  } else {
    const approvalCount = updatedDecisions.filter((entry) => entry.decision === "approve").length;
    if (approvalCount >= request.requiredApprovals) {
      newStatus = "approved";
      decisionSummary = decision.comment ?? "Approval threshold reached.";
    }
  }

  const now = new Date();
  await db.collection<ApprovalRequest>("approval_requests").updateOne(
    { _id: requestId },
    {
      $push: { decisions: decision as never },
      $set: {
        status: newStatus,
        decisionSummary,
        updatedAt: now,
        ...(newStatus === "pending" ? {} : { resolvedAt: now }),
      },
    }
  );

  if (newStatus !== "pending") {
    const outcome = await resolveApprovalOutcome(db, { ...request, decisions: updatedDecisions }, newStatus, decisionSummary);
    if (!outcome.success) {
      return { success: false, error: outcome.error };
    }

    await safeLogAuditEvent(db, {
      actorId: decision.reviewerId,
      action: getAuditActionForApprovalStatus(newStatus),
      targetId: requestId,
      teamId: request.teamId,
      details: {
        assetId: request.assetId.toHexString(),
        action: request.action,
        assetVersionNumber: request.assetVersionNumber,
        reviewerName: decision.reviewerName,
      },
    });

    const team = await db.collection("teams").findOne({ _id: request.teamId }, { projection: { orgId: 1 } });
    if (team?.orgId) {
      dispatchWebhook(db, team.orgId, "approval.completed", {
        requestId: requestId.toHexString(),
        assetId: request.assetId.toHexString(),
        assetVersionNumber: request.assetVersionNumber,
        action: request.action,
        status: newStatus,
      });
    }
  }

  return { success: true, newStatus };
}

export async function invalidateApprovalRequestsForAsset(
  db: Db,
  input: {
    assetId: ObjectId;
    teamId: ObjectId;
    nextVersionNumber?: number;
    reason?: string;
  }
): Promise<number> {
  const filter: Record<string, unknown> = {
    assetId: input.assetId,
    teamId: input.teamId,
    status: "pending",
  };

  if (typeof input.nextVersionNumber === "number") {
    filter.assetVersionNumber = { $lte: input.nextVersionNumber };
  }

  const result = await db.collection<ApprovalRequest>("approval_requests").updateMany(
    filter,
    {
      $set: {
        status: "withdrawn",
        decisionSummary: input.reason ?? "Superseded by a newer asset version.",
        invalidatedByVersionNumber: input.nextVersionNumber,
        updatedAt: new Date(),
        resolvedAt: new Date(),
      },
    }
  );

  return result.modifiedCount;
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
