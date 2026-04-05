/**
 * Supply Chain Security — upstream monitoring, fork detection, dependency scanning.
 *
 * Per api-security-best-practices: defense in depth for asset supply chain.
 *
 * Features:
 * 1. Upstream monitoring — detect changes in source repos via fingerprint comparison
 * 2. Fork detection — identify if an asset is a derivative of another in the registry
 * 3. Dependency scanning — for plugin bundles, check all bundled assets
 */

import { ObjectId, type Db } from "mongodb";
import type { AssetDocument } from "@/types/asset";
import { generateFingerprint } from "@/types/asset";
import { scanAsset, type TypedScanResult } from "./type-scanner";

/** Upstream change status */
export type UpstreamStatus = "current" | "outdated" | "unknown" | "no_upstream";

/** Result of checking a single asset's upstream */
export interface UpstreamCheckResult {
  assetId: ObjectId;
  assetName: string;
  status: UpstreamStatus;
  currentFingerprint: string;
  /** True if the source URL is still reachable (for future use) */
  sourceReachable?: boolean;
}

/** Fork detection result */
export interface ForkCheckResult {
  assetId: ObjectId;
  assetName: string;
  /** True if this asset's content closely matches another in the registry */
  isPotentialFork: boolean;
  /** IDs of similar assets */
  similarAssetIds: ObjectId[];
}

/** Plugin bundle scan result */
export interface BundleScanResult {
  pluginId: ObjectId;
  pluginName: string;
  /** Individual scan results for each bundled asset */
  assetScans: Array<{
    assetId: ObjectId;
    assetName: string;
    scan: TypedScanResult;
  }>;
  /** Aggregate: are ALL bundled assets safe? */
  allSafe: boolean;
  /** Total finding counts across all bundled assets */
  totalFindings: { critical: number; high: number; medium: number; low: number };
}

// ─── Upstream Monitoring ──────────────────────────────────

/**
 * Check upstream status for all assets with source tracking in a team.
 */
export async function checkUpstream(
  db: Db,
  teamId: ObjectId
): Promise<UpstreamCheckResult[]> {
  const assets = await db.collection<AssetDocument>("assets")
    .find(
      { teamId, "source.repoUrl": { $exists: true, $ne: null } },
      { projection: { metadata: 1, content: 1, source: 1, provenance: 1 } }
    )
    .toArray();

  return assets.map((asset) => {
    const currentFingerprint = generateFingerprint(asset.metadata, asset.content);
    const storedFingerprint = asset.provenance?.sourceFingerprint;

    let status: UpstreamStatus = "no_upstream";
    if (storedFingerprint) {
      status = currentFingerprint === storedFingerprint ? "current" : "outdated";
    } else if (asset.source?.repoUrl) {
      status = "unknown"; // Has source but no stored fingerprint
    }

    return {
      assetId: asset._id,
      assetName: asset.metadata.name,
      status,
      currentFingerprint,
    };
  });
}

// ─── Fork Detection ──────────────────────────────────────

/**
 * Detect if an asset is a potential fork of another in the same org.
 * Uses fingerprint comparison — identical fingerprints = potential fork.
 */
export async function detectForks(
  db: Db,
  orgTeamIds: ObjectId[]
): Promise<ForkCheckResult[]> {
  const assets = await db.collection<AssetDocument>("assets")
    .find(
      { teamId: { $in: orgTeamIds } },
      { projection: { metadata: 1, content: 1 } }
    )
    .toArray();

  // Build fingerprint → asset ID map
  const fingerprintMap = new Map<string, ObjectId[]>();
  for (const asset of assets) {
    const fp = generateFingerprint(asset.metadata, asset.content);
    const existing = fingerprintMap.get(fp) ?? [];
    existing.push(asset._id);
    fingerprintMap.set(fp, existing);
  }

  // Find duplicates
  const results: ForkCheckResult[] = [];
  for (const asset of assets) {
    const fp = generateFingerprint(asset.metadata, asset.content);
    const matches = fingerprintMap.get(fp) ?? [];
    const others = matches.filter((id) => !id.equals(asset._id));

    if (others.length > 0) {
      results.push({
        assetId: asset._id,
        assetName: asset.metadata.name,
        isPotentialFork: true,
        similarAssetIds: others,
      });
    }
  }

  return results;
}

// ─── Plugin Bundle Scanning ──────────────────────────────

/**
 * Scan all assets in a plugin bundle.
 * Returns aggregate safety status.
 */
export async function scanPluginBundle(
  db: Db,
  pluginId: ObjectId
): Promise<BundleScanResult | null> {
  const plugin = await db.collection<AssetDocument>("assets").findOne({ _id: pluginId });
  if (!plugin || plugin.type !== "plugin") return null;

  const bundledIds = (plugin.pluginConfig as { bundledAssetIds?: ObjectId[] })?.bundledAssetIds ?? [];
  if (bundledIds.length === 0) {
    return {
      pluginId, pluginName: plugin.metadata.name,
      assetScans: [], allSafe: true,
      totalFindings: { critical: 0, high: 0, medium: 0, low: 0 },
    };
  }

  const bundledAssets = await db.collection<AssetDocument>("assets")
    .find({ _id: { $in: bundledIds } })
    .toArray();

  const totals = { critical: 0, high: 0, medium: 0, low: 0 };
  const assetScans = bundledAssets.map((asset) => {
    const scan = scanAsset(asset.content, asset.type);
    totals.critical += scan.counts.critical;
    totals.high += scan.counts.high;
    totals.medium += scan.counts.medium;
    totals.low += scan.counts.low;
    return { assetId: asset._id, assetName: asset.metadata.name, scan };
  });

  return {
    pluginId, pluginName: plugin.metadata.name,
    assetScans, allSafe: totals.critical === 0,
    totalFindings: totals,
  };
}
