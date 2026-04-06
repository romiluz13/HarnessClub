/**
 * GET /api/assets/:id — Fetch a single asset with full content.
 * PATCH /api/assets/:id — Update asset metadata/content.
 *
 * Auth required. User must be member of the asset's team.
 * Per api-security-best-practices: auth, ownership check, input validation.
 */

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import type { AssetDocument, ReleaseStatus } from "@/types/asset";
import { getEffectiveReleaseStatus } from "@/types/asset";
import { requireAuth, getMemberRole, serializeAsset } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/rbac";
import { logAuditEvent } from "@/services/audit-service";
import { updateAsset } from "@/services/asset-service";

function isValidObjectId(id: string): boolean {
  return /^[a-f\d]{24}$/i.test(id);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult.response;

  const { id } = await params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid asset ID" }, { status: 400 });
  }

  const db = await getDb();
  const asset = await db.collection<AssetDocument>("assets").findOne(
    { _id: new ObjectId(id) },
    { projection: { embedding: 0, searchText: 0 } }
  );

  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  const role = await getMemberRole(db, new ObjectId(authResult.userId), asset.teamId);
  if (!role || !hasPermission(role, "skill:read")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  return NextResponse.json({
    ...serializeAsset(asset),
    content: asset.content,
    sourceUrl: asset.source?.repoUrl,
    lastScan: asset.lastScan ?? null,
  });
}

const MUTABLE_RELEASE_STATUSES: ReleaseStatus[] = ["draft", "archived"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult.response;

  const { id } = await params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid asset ID" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const db = await getDb();
  const asset = await db.collection<AssetDocument>("assets").findOne(
    { _id: new ObjectId(id) },
    {
      projection: {
        teamId: 1,
        metadata: 1,
        content: 1,
        tags: 1,
        isPublished: 1,
        releaseStatus: 1,
      },
    }
  );

  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  const role = await getMemberRole(db, new ObjectId(authResult.userId), asset.teamId);
  if (!role) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const wantsContentChange = ["name", "description", "version", "tags", "content"].some((field) => field in body);
  const wantsPublishChange = "isPublished" in body || "releaseStatus" in body;
  const requestedReleaseStatus = typeof body.releaseStatus === "string"
    ? body.releaseStatus as ReleaseStatus
    : undefined;
  const currentReleaseStatus = getEffectiveReleaseStatus(asset);

  if (wantsContentChange && !hasPermission(role, "skill:update")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }
  if (wantsPublishChange && !hasPermission(role, "skill:publish")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  if (requestedReleaseStatus && !MUTABLE_RELEASE_STATUSES.includes(requestedReleaseStatus)) {
    return NextResponse.json(
      { error: "Direct release transitions to pending_review, approved, or published must go through the approvals workflow" },
      { status: 409 }
    );
  }
  if (body.isPublished === true) {
    return NextResponse.json(
      { error: "Direct publish is blocked. Submit an approval request and complete review before publishing." },
      { status: 409 }
    );
  }
  if (body.isPublished === false && currentReleaseStatus === "published") {
    body.releaseStatus = "draft";
  }

  const updated = await updateAsset(db, new ObjectId(id), {
    name: typeof body.name === "string" ? body.name : undefined,
    description: typeof body.description === "string" ? body.description : undefined,
    version: typeof body.version === "string" ? body.version : undefined,
    content: typeof body.content === "string" ? body.content : undefined,
    tags: Array.isArray(body.tags)
      ? (body.tags as unknown[]).filter((tag): tag is string => typeof tag === "string")
      : undefined,
    isPublished: typeof body.isPublished === "boolean" ? body.isPublished : undefined,
    releaseStatus: requestedReleaseStatus ?? (body.isPublished === false ? "draft" : undefined),
    updatedBy: new ObjectId(authResult.userId),
    changeReason: typeof body.changeReason === "string" ? body.changeReason : undefined,
  });

  if (!updated) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  const refreshed = await db.collection<AssetDocument>("assets").findOne(
    { _id: new ObjectId(id) },
    { projection: { embedding: 0, searchText: 0 } }
  );

  return NextResponse.json({ success: true, asset: refreshed ? serializeAsset(refreshed) : null });
}


export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult.response;

  const { id } = await params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid asset ID" }, { status: 400 });
  }

  const db = await getDb();
  const asset = await db.collection<AssetDocument>("assets").findOne(
    { _id: new ObjectId(id) },
    { projection: { teamId: 1, metadata: 1, type: 1 } }
  );

  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  const role = await getMemberRole(db, new ObjectId(authResult.userId), asset.teamId);
  if (!role || !hasPermission(role, "skill:delete")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  await db.collection("assets").deleteOne({ _id: new ObjectId(id) });

  await logAuditEvent(db, {
    actorId: new ObjectId(authResult.userId),
    action: "asset:delete",
    targetId: new ObjectId(id),
    targetType: asset.type,
    teamId: asset.teamId,
    details: { name: asset.metadata.name },
  });

  return NextResponse.json({ success: true, deleted: id });
}
