/**
 * GET /api/assets/:id/export?format=cursor — Export asset to target tool format.
 *
 * Supported formats: claude-code, cursor, copilot, windsurf, codex
 * Returns the exported file content with correct Content-Type and filename.
 *
 * Per api-security-best-practices: auth required, input validation, error handling.
 */

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { requireAuth, getMemberRole } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/rbac";
import type { TeamRole } from "@/types/team";
import type { AssetDocument } from "@/types/asset";
import {
  exportAsset,
  canExport,
  getAvailableTargets,
  EXPORT_TARGETS,
} from "@/services/exporters";
import type { ExportTarget } from "@/services/exporters";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.ok) return authResult.response;

  const { id } = await params;

  // Validate ObjectId
  let assetId: ObjectId;
  try {
    assetId = new ObjectId(id);
  } catch {
    return NextResponse.json({ error: "Invalid asset ID" }, { status: 400 });
  }

  // Validate format parameter
  const format = request.nextUrl.searchParams.get("format");
  if (!format) {
    return NextResponse.json(
      { error: "format parameter is required", availableFormats: [...EXPORT_TARGETS] },
      { status: 400 }
    );
  }
  if (!EXPORT_TARGETS.includes(format as ExportTarget)) {
    return NextResponse.json(
      { error: `Invalid format: ${format}`, availableFormats: [...EXPORT_TARGETS] },
      { status: 400 }
    );
  }

  const target = format as ExportTarget;
  const db = await getDb();

  // Fetch asset
  const asset = await db.collection<AssetDocument>("assets").findOne({ _id: assetId });
  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  // RBAC — user must have read access to the team
  const userId = new ObjectId(authResult.userId);
  const role = await getMemberRole(db, userId, asset.teamId);
  if (!role) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  // Check if this asset type can be exported to the target
  if (!canExport(asset.type, target)) {
    return NextResponse.json(
      {
        error: `Cannot export ${asset.type} to ${target}`,
        availableTargets: getAvailableTargets(asset.type),
      },
      { status: 422 }
    );
  }

  // Export
  const exported = exportAsset(asset, target);

  // Audit log
  const { logAuditEvent } = await import("@/services/audit-service");
  await logAuditEvent(db, {
    actorId: userId,
    action: "asset:export",
    targetId: assetId,
    targetType: asset.type,
    teamId: asset.teamId,
    details: { name: asset.metadata.name, exportTarget: target },
  });

  // Return with appropriate headers for download
  const disposition = request.nextUrl.searchParams.get("download") === "true"
    ? `attachment; filename="${exported.filename.split("/").pop()}"`
    : "inline";

  return new NextResponse(exported.content, {
    status: 200,
    headers: {
      "Content-Type": exported.mimeType,
      "Content-Disposition": disposition,
      "X-Export-Target": exported.target,
      "X-Export-Filename": exported.filename,
    },
  });
}
