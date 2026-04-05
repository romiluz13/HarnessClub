/**
 * GET /api/assets/[id]/versions — Get version history for an asset.
 * Query params: limit (default 20), includeDiffs (default false)
 */

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { getVersionHistory, compareVersions } from "@/services/version-service";
import { getMemberRole, requireAuth } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/rbac";
import type { AssetDocument } from "@/types/asset";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.ok) return authResult.response;

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid asset ID" }, { status: 400 });
  }

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10), 50);
  const includeDiffs = url.searchParams.get("includeDiffs") === "true";
  const compareFrom = url.searchParams.get("compareFrom");
  const compareTo = url.searchParams.get("compareTo");

  const db = await getDb();
  const assetId = new ObjectId(id);
  const asset = await db.collection<AssetDocument>("assets").findOne(
    { _id: assetId },
    { projection: { teamId: 1 } }
  );

  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  const role = await getMemberRole(db, new ObjectId(authResult.userId), asset.teamId);
  if (!role || !hasPermission(role, "skill:read")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  // If comparing two versions, return diff
  if (compareFrom && compareTo) {
    const from = parseInt(compareFrom, 10);
    const to = parseInt(compareTo, 10);
    if (isNaN(from) || isNaN(to)) {
      return NextResponse.json({ error: "compareFrom and compareTo must be numbers" }, { status: 400 });
    }
    const result = await compareVersions(db, assetId, from, to);
    if (!result) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  }

  // Otherwise, return version history
  const versions = await getVersionHistory(db, assetId, { limit, includeDiffs });
  return NextResponse.json({ versions, total: versions.length });
}
