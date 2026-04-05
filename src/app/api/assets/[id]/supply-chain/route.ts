/**
 * GET /api/assets/:id/supply-chain — Supply chain analysis for an asset.
 *
 * Returns upstream check results, fork detection, plugin bundle scan.
 * Per api-security-best-practices: auth + team membership required.
 */

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { requireAuth, isTeamMember } from "@/lib/api-helpers";
import { getAsset } from "@/services/asset-service";
import { checkUpstream, scanPluginBundle } from "@/services/supply-chain";
import { scanAsset } from "@/services/type-scanner";
import { computeTrustScore } from "@/services/trust-score";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.ok) return authResult.response;

  const { id } = await params;
  let assetOid: ObjectId;
  try {
    assetOid = new ObjectId(id);
  } catch {
    return NextResponse.json({ error: "Invalid asset ID" }, { status: 400 });
  }

  const db = await getDb();
  const asset = await getAsset(db, assetOid);
  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  // Verify team access
  const isMember = await isTeamMember(db, authResult.userId, asset.teamId);
  if (!isMember) {
    return NextResponse.json({ error: "Not a team member" }, { status: 403 });
  }

  // Run type-specific scan
  const typedScan = scanAsset(asset.content ?? "", asset.type);

  // Compute trust score
  const trustScore = computeTrustScore(
    asset,
    asset.provenance as Parameters<typeof computeTrustScore>[1]
  );

  // Check upstream for assets with source URL
  let upstream = null;
  if (asset.source?.repoUrl) {
    const upstreamResults = await checkUpstream(db, asset.teamId);
    upstream = upstreamResults.find((r) => r.assetId.equals(assetOid)) ?? null;
  }

  // Plugin bundle scan
  let bundleScan = null;
  if (asset.type === "plugin") {
    bundleScan = await scanPluginBundle(db, assetOid);
  }

  // Store updated scan + trust on asset (side effect)
  await db.collection("assets").updateOne(
    { _id: assetOid },
    {
      $set: {
        lastScan: {
          scannedAt: typedScan.scannedAt,
          findingCounts: typedScan.counts,
          safe: typedScan.safe,
        },
        trustScore,
      },
    }
  );

  return NextResponse.json({
    assetId: id,
    assetType: asset.type,
    scan: {
      safe: typedScan.safe,
      findingCount: typedScan.findings.length,
      findings: typedScan.findings.map((f) => ({
        severity: f.severity,
        message: f.message,
        line: f.line,
      })),
      counts: typedScan.counts,
      scannedAt: typedScan.scannedAt.toISOString(),
    },
    trustScore: {
      overall: trustScore.overall,
      grade: trustScore.grade,
      components: trustScore.components,
    },
    upstream,
    bundleScan,
  });
}
