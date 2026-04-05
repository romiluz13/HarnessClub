/**
 * Version Service — Asset version history, diff, and rollback.
 *
 * Architecture:
 * - Versions stored as sub-documents in the asset's `versions[]` array
 * - Each version captures: content, metadata snapshot, who, when, diff
 * - Diff computed as line-level additions/removals
 * - Rollback creates a NEW version (preserving full audit trail)
 *
 * Per mongodb-schema-design: embedded array for versions (always accessed
 * with parent, bounded by retention policy — max 50 versions).
 */

import { ObjectId, type Db } from "mongodb";

// ─── Types ──────────────────────────────────────────────────

/** A single line-level diff entry */
export interface DiffLine {
  type: "add" | "remove" | "unchanged";
  lineNumber: number;
  content: string;
}

/** Computed diff between two versions */
export interface VersionDiff {
  linesAdded: number;
  linesRemoved: number;
  linesUnchanged: number;
  lines: DiffLine[];
}

/** A version snapshot stored inside the asset document */
export interface AssetVersion {
  versionId: ObjectId;
  /** Sequential version number (1, 2, 3...) */
  versionNumber: number;
  /** Full content at this version */
  content: string;
  /** Metadata snapshot at this version */
  metadata: { name: string; description: string; version?: string };
  /** Tags snapshot */
  tags: string[];
  /** Who created this version */
  createdBy: ObjectId;
  /** When this version was created */
  createdAt: Date;
  /** Reason for the change */
  changeReason?: string;
  /** Diff from previous version (not present on v1) */
  diff?: VersionDiff;
}

/** Max versions to retain per asset (oldest trimmed) */
const MAX_VERSIONS = 50;

// ─── Diff Engine ────────────────────────────────────────────

/**
 * Compute a line-level diff between two strings.
 * Uses a simple LCS-based approach (no external deps).
 */
export function computeDiff(oldContent: string, newContent: string): VersionDiff {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");
  const diffLines: DiffLine[] = [];
  let linesAdded = 0;
  let linesRemoved = 0;
  let linesUnchanged = 0;

  // Build LCS table
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = oldLines[i - 1] === newLines[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack to produce diff
  let i = m;
  let j = n;
  const result: DiffLine[] = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.push({ type: "unchanged", lineNumber: j, content: newLines[j - 1] });
      linesUnchanged++;
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: "add", lineNumber: j, content: newLines[j - 1] });
      linesAdded++;
      j--;
    } else {
      result.push({ type: "remove", lineNumber: i, content: oldLines[i - 1] });
      linesRemoved++;
      i--;
    }
  }

  // Reverse since we built it backwards
  result.reverse();
  diffLines.push(...result);

  return { linesAdded, linesRemoved, linesUnchanged, lines: diffLines };
}

// ─── Version Management ─────────────────────────────────────

/**
 * Create a new version for an asset.
 * Called automatically when asset content/metadata changes.
 *
 * Returns the new version number.
 */
export async function createVersion(
  db: Db,
  assetId: ObjectId,
  update: {
    content: string;
    metadata: { name: string; description: string; version?: string };
    tags: string[];
    updatedBy: ObjectId;
    changeReason?: string;
  }
): Promise<{ versionNumber: number; versionId: ObjectId; diff?: VersionDiff }> {
  const asset = await db.collection("assets").findOne({ _id: assetId });
  if (!asset) {
    throw new Error(`Asset ${assetId.toHexString()} not found`);
  }

  const existingVersions: AssetVersion[] = asset.versions ?? [];
  const prevVersion = existingVersions[existingVersions.length - 1];
  const newVersionNumber = (prevVersion?.versionNumber ?? 0) + 1;
  const versionId = new ObjectId();

  // Compute diff from previous version (or from current content if no versions yet)
  const previousContent = prevVersion?.content ?? asset.content ?? "";
  const diff = previousContent !== update.content
    ? computeDiff(previousContent, update.content)
    : undefined;

  const newVersion: AssetVersion = {
    versionId,
    versionNumber: newVersionNumber,
    content: update.content,
    metadata: update.metadata,
    tags: update.tags,
    createdBy: update.updatedBy,
    createdAt: new Date(),
    changeReason: update.changeReason,
    diff,
  };

  // Push new version and trim if over MAX_VERSIONS
  const pushUpdate: Record<string, unknown> = {
    $push: { versions: { $each: [newVersion], $slice: -MAX_VERSIONS } },
    $set: {
      content: update.content,
      "metadata.name": update.metadata.name,
      "metadata.description": update.metadata.description,
      tags: update.tags,
      updatedAt: new Date(),
      currentVersionNumber: newVersionNumber,
    },
  };
  if (update.metadata.version) {
    (pushUpdate.$set as Record<string, unknown>)["metadata.version"] = update.metadata.version;
  }

  await db.collection("assets").updateOne({ _id: assetId }, pushUpdate);

  return { versionNumber: newVersionNumber, versionId, diff };
}

/**
 * Get version history for an asset.
 * Returns versions in reverse chronological order (newest first).
 */
export async function getVersionHistory(
  db: Db,
  assetId: ObjectId,
  options: { limit?: number; includeDiffs?: boolean } = {}
): Promise<AssetVersion[]> {
  const limit = options.limit ?? 20;
  const asset = await db.collection("assets").findOne(
    { _id: assetId },
    { projection: { versions: 1 } }
  );
  if (!asset) return [];

  let versions: AssetVersion[] = asset.versions ?? [];

  // Reverse for newest-first
  versions = [...versions].reverse();

  // Apply limit
  if (versions.length > limit) {
    versions = versions.slice(0, limit);
  }

  // Strip diffs if not requested (saves bandwidth)
  if (!options.includeDiffs) {
    versions = versions.map((v) => ({ ...v, diff: undefined }));
  }

  return versions;
}

/**
 * Get a specific version by version number.
 */
export async function getVersion(
  db: Db,
  assetId: ObjectId,
  versionNumber: number
): Promise<AssetVersion | null> {
  const asset = await db.collection("assets").findOne(
    { _id: assetId },
    { projection: { versions: 1 } }
  );
  if (!asset) return null;

  const versions: AssetVersion[] = asset.versions ?? [];
  return versions.find((v) => v.versionNumber === versionNumber) ?? null;
}

/**
 * Rollback to a specific version.
 * Creates a NEW version (preserving full audit trail) with the old content.
 */
export async function rollbackToVersion(
  db: Db,
  assetId: ObjectId,
  targetVersionNumber: number,
  rolledBackBy: ObjectId
): Promise<{ success: boolean; newVersionNumber?: number; error?: string }> {
  const targetVersion = await getVersion(db, assetId, targetVersionNumber);
  if (!targetVersion) {
    return { success: false, error: `Version ${targetVersionNumber} not found` };
  }

  const result = await createVersion(db, assetId, {
    content: targetVersion.content,
    metadata: targetVersion.metadata,
    tags: targetVersion.tags,
    updatedBy: rolledBackBy,
    changeReason: `Rolled back to version ${targetVersionNumber}`,
  });

  return { success: true, newVersionNumber: result.versionNumber };
}

/**
 * Compare two versions of an asset.
 */
export async function compareVersions(
  db: Db,
  assetId: ObjectId,
  fromVersion: number,
  toVersion: number
): Promise<{ diff: VersionDiff; from: AssetVersion; to: AssetVersion } | null> {
  const asset = await db.collection("assets").findOne(
    { _id: assetId },
    { projection: { versions: 1 } }
  );
  if (!asset) return null;

  const versions: AssetVersion[] = asset.versions ?? [];
  const from = versions.find((v) => v.versionNumber === fromVersion);
  const to = versions.find((v) => v.versionNumber === toVersion);
  if (!from || !to) return null;

  const diff = computeDiff(from.content, to.content);
  return { diff, from, to };
}
