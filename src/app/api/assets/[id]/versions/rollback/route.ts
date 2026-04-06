/**
 * POST /api/assets/[id]/versions/rollback — Rollback to a specific version.
 * Body: { targetVersion: number }
 */

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { rollbackToVersion } from "@/services/version-service";
import { getMemberRole, requireAuth } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/rbac";
import type { AssetDocument } from "@/types/asset";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult.response;

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid asset ID" }, { status: 400 });
  }

  let body: { targetVersion?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.targetVersion || typeof body.targetVersion !== "number" || body.targetVersion < 1) {
    return NextResponse.json({ error: "targetVersion must be a positive integer" }, { status: 400 });
  }

  const db = await getDb();
  const assetId = new ObjectId(id);
  const asset = await db.collection<AssetDocument>("assets").findOne(
    { _id: assetId },
    { projection: { teamId: 1 } }
  );

  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  const userId = new ObjectId(authResult.userId);
  const role = await getMemberRole(db, userId, asset.teamId);
  if (!role || !hasPermission(role, "skill:update")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const result = await rollbackToVersion(db, assetId, body.targetVersion, userId);

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    newVersionNumber: result.newVersionNumber,
  });
}
