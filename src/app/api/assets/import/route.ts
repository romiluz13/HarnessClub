/**
 * POST /api/assets/import — Import asset from raw content, URL, or GitHub.
 *
 * Supports 3 import modes:
 * 1. content + filename: Paste raw content (auto-detect format)
 * 2. url: Fetch from URL (auto-detect format from URL path)
 * 3. repoUrl: GitHub import (delegates to /api/skills/import)
 *
 * All imports go through: parse → security scan → create.
 * Per api-security-best-practices: auth, input validation, scan before store.
 */

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { requireAuth, getMemberRole } from "@/lib/api-helpers";
import { hasPermission } from "@/lib/rbac";
import type { TeamRole } from "@/types/team";
import { parseFile, detectAllFormats } from "@/services/parsers";
import { scanContent } from "@/services/security-scanner";
import { scanAsset as typeScanAsset } from "@/services/type-scanner";
import { createAsset } from "@/services/asset-service";
import { computeTrustScore } from "@/services/trust-score";
import type { CreateAssetInput, AssetDocument } from "@/types/asset";
import type { AssetType } from "@/types/asset";

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { teamId, content, filename, url } = body;

  if (!teamId) {
    return NextResponse.json({ error: "teamId is required" }, { status: 400 });
  }

  let teamOid: ObjectId;
  try {
    teamOid = new ObjectId(teamId as string);
  } catch {
    return NextResponse.json({ error: "Invalid teamId" }, { status: 400 });
  }

  const db = await getDb();
  const userId = new ObjectId(authResult.userId);

  // RBAC
  const role = await getMemberRole(db, userId, teamOid);
  if (!role || !hasPermission(role as TeamRole, "skill:create")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  let rawContent: string;
  let rawFilename: string;

  if (typeof content === "string" && content.trim().length > 0) {
    // Mode 1: Raw content paste
    rawContent = content as string;
    rawFilename = (filename as string) || "imported-content.md";
  } else if (typeof url === "string" && (url as string).startsWith("http")) {
    // Mode 2: Fetch from URL
    try {
      const response = await fetch(url as string, {
        headers: { "User-Agent": "AgentConfig/2.0" },
      });
      if (!response.ok) {
        return NextResponse.json({ error: `Failed to fetch URL: ${response.status}` }, { status: 422 });
      }
      rawContent = await response.text();
      // Extract filename from URL path
      const urlPath = new URL(url as string).pathname;
      rawFilename = urlPath.split("/").filter(Boolean).pop() || "imported-url.md";
    } catch (err) {
      return NextResponse.json({ error: `Failed to fetch URL: ${(err as Error).message}` }, { status: 422 });
    }
  } else {
    return NextResponse.json(
      { error: "Provide either 'content' (raw text) or 'url' (HTTP URL)" },
      { status: 400 }
    );
  }

  // Security scan — use type-specific scanner for typed assets, base scanner otherwise
  const assetType = (body.assetType as AssetType) || "skill";
  const typedAssets: AssetType[] = ["mcp_config", "hook", "settings_bundle"];
  const scan = typedAssets.includes(assetType)
    ? typeScanAsset(rawContent, assetType)
    : scanContent(rawContent);

  if (!scan.safe) {
    const criticals = scan.findings.filter((f) => f.severity === "critical");
    return NextResponse.json(
      {
        error: "Security scan blocked import",
        findings: criticals.map((f) => ({ severity: f.severity, message: f.message, line: f.line })),
      },
      { status: 422 }
    );
  }

  // Parse
  let parsed;
  try {
    parsed = parseFile(rawFilename, rawContent);
  } catch {
    // If no parser matches, show available formats
    const detected = detectAllFormats(rawFilename, rawContent);
    return NextResponse.json(
      {
        error: `Could not detect format for "${rawFilename}"`,
        detectedFormats: detected.map((d) => ({ format: d.format, confidence: d.confidence })),
      },
      { status: 422 }
    );
  }

  // Create asset
  const input: CreateAssetInput = {
    type: (body.assetType as AssetType) || parsed.assetType,
    teamId: teamOid,
    metadata: { ...parsed.metadata, author: parsed.metadata.author ?? authResult.userId },
    content: rawContent,
    tags: parsed.tags,
    createdBy: userId,
    ...(parsed.typeConfig || {}),
  };

  const result = await createAsset(db, input);

  if (!result.success) {
    return NextResponse.json({ error: result.error, errors: result.validationErrors }, { status: 422 });
  }

  // Compute trust score and store on asset
  const assetDoc = await db.collection<AssetDocument>("assets").findOne({ _id: result.assetId });
  let trustScore = null;
  if (assetDoc) {
    trustScore = computeTrustScore(assetDoc, assetDoc.provenance as Parameters<typeof computeTrustScore>[1]);
    await db.collection("assets").updateOne(
      { _id: result.assetId },
      { $set: { trustScore } }
    );
  }

  // Collect warnings
  const warnings = scan.findings.filter((f) => f.severity !== "critical");

  return NextResponse.json(
    {
      assetId: result.assetId.toHexString(),
      type: result.type,
      name: result.name,
      format: parsed.format,
      sourceTool: parsed.sourceTool,
      trustScore: trustScore ? { overall: trustScore.overall, grade: trustScore.grade } : undefined,
      warnings: warnings.length > 0 ? warnings.map((w) => w.message) : undefined,
      message: "Asset imported successfully",
    },
    { status: 201 }
  );
}
