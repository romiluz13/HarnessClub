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
import type { AssetDocument } from "@/types/asset";
import { requireAuth, getMemberRole } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/rbac";
import { logAuditEvent } from "@/services/audit-service";
import { updateAsset } from "@/services/asset-service";

function isValidObjectId(id: string): boolean {
  return /^[a-f\d]{24}$/i.test(id);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
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
    id: asset._id.toHexString(),
    type: asset.type,
    teamId: asset.teamId.toHexString(),
    name: asset.metadata.name,
    description: asset.metadata.description,
    author: asset.metadata.author,
    version: asset.metadata.version,
    tags: asset.tags,
    content: asset.content,
    installCount: asset.stats?.installCount ?? 0,
    viewCount: asset.stats?.viewCount ?? 0,
    isPublished: asset.isPublished,
    sourceUrl: asset.source?.repoUrl,
    lastScan: asset.lastScan ?? null,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
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
    { projection: { teamId: 1, metadata: 1, content: 1, tags: 1 } }
  );

  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  const role = await getMemberRole(db, new ObjectId(authResult.userId), asset.teamId);
  if (!role) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const wantsContentChange = ["name", "description", "version", "tags", "content"].some((field) => field in body);
  const wantsPublishChange = "isPublished" in body;

  if (wantsContentChange && !hasPermission(role, "skill:update")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }
  if (wantsPublishChange && !hasPermission(role, "skill:publish")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
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
    updatedBy: new ObjectId(authResult.userId),
    changeReason: typeof body.changeReason === "string" ? body.changeReason : undefined,
  });

  if (!updated) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}


export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
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
