/**
 * GET /api/assets/:id/install — Serve plugin directory structure for installation.
 *
 * Returns a JSON manifest describing the plugin's file tree:
 * - For plugin assets: lists all bundled assets with their export filenames
 * - For individual assets: returns single file info
 * - Used by Claude Code: `/plugin install [url]`
 *
 * Per api-security-best-practices: auth required for non-published assets.
 */

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import type { AssetDocument } from "@/types/asset";
import { isAssetPublishedForDistribution } from "@/types/asset";
import { exportAsset, getAvailableTargets } from "@/services/exporters";
import type { ExportTarget } from "@/services/exporters";

interface InstallFile {
  path: string;
  content: string;
  type: string;
}

interface InstallManifest {
  name: string;
  description: string;
  version: string;
  assetType: string;
  files: InstallFile[];
  availableFormats: string[];
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let assetId: ObjectId;
  try {
    assetId = new ObjectId(id);
  } catch {
    return NextResponse.json({ error: "Invalid asset ID" }, { status: 400 });
  }

  const db = await getDb();
  const asset = await db.collection<AssetDocument>("assets").findOne({ _id: assetId });

  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  // Only fully published assets can be installed without auth
  if (!isAssetPublishedForDistribution(asset)) {
    return NextResponse.json({ error: "Asset is not published for installation" }, { status: 403 });
  }

  const target: ExportTarget = "claude-code";
  const files: InstallFile[] = [];

  if (asset.type === "plugin" && asset.pluginConfig?.bundledAssetIds?.length) {
    // Plugin bundle — export all bundled assets
    const bundledAssets = await db
      .collection<AssetDocument>("assets")
      .find({ _id: { $in: asset.pluginConfig.bundledAssetIds } })
      .toArray();

    const bundledAssetsById = new Map(bundledAssets.map((bundled) => [bundled._id.toHexString(), bundled]));
    const missingBundledAssetIds = asset.pluginConfig.bundledAssetIds
      .filter((bundledAssetId) => !bundledAssetsById.has(bundledAssetId.toHexString()))
      .map((bundledAssetId) => bundledAssetId.toHexString());
    const blockedBundledAssets: Array<{ id: string; name: string; releaseStatus?: string }> = [];
    const unexportableBundledAssets: Array<{ id: string; name: string; type: string }> = [];

    for (const bundled of bundledAssets) {
      if (!isAssetPublishedForDistribution(bundled)) {
        blockedBundledAssets.push({
          id: bundled._id.toHexString(),
          name: bundled.metadata.name,
          releaseStatus: bundled.releaseStatus,
        });
        continue;
      }

      try {
        const exported = exportAsset(bundled, target);
        files.push({
          path: exported.filename,
          content: exported.content,
          type: bundled.type,
        });
      } catch {
        unexportableBundledAssets.push({
          id: bundled._id.toHexString(),
          name: bundled.metadata.name,
          type: bundled.type,
        });
      }
    }

    if (missingBundledAssetIds.length > 0 || blockedBundledAssets.length > 0 || unexportableBundledAssets.length > 0) {
      return NextResponse.json(
        {
          error: "Plugin bundle is incomplete and cannot be installed.",
          missingBundledAssetIds,
          blockedBundledAssets,
          unexportableBundledAssets,
        },
        { status: 409 }
      );
    }

    // Add the plugin manifest itself
    const exported = exportAsset(asset, target);
    files.push({ path: exported.filename, content: exported.content, type: "plugin" });
  } else {
    // Single asset
    const exported = exportAsset(asset, target);
    files.push({ path: exported.filename, content: exported.content, type: asset.type });
  }

  const manifest: InstallManifest = {
    name: asset.metadata.name,
    description: asset.metadata.description,
    version: asset.metadata.version ?? "1.0.0",
    assetType: asset.type,
    files,
    availableFormats: getAvailableTargets(asset.type),
  };

  return NextResponse.json(manifest, {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=60, s-maxage=60",
    },
  });
}
