/**
 * Asset Management Service.
 *
 * Business logic for multi-type asset CRUD.
 * Handles: searchText auto-population, type validation, dual-mode embedding.
 *
 * Per ADR-010: Uses detectSearchMode to decide manual vs autoEmbed.
 * Per pattern-polymorphic: type discriminator on all documents.
 * Per async-parallel: parallelize independent operations.
 */

import { ObjectId, type Db } from "mongodb";
import type { AssetType, AssetDocument, CreateAssetInput } from "@/types/asset";
import { buildSearchText, generateFingerprint } from "@/types/asset";
import { validateAssetInput } from "@/lib/asset-validators";
import type { ValidationResult } from "@/lib/asset-validators";
import { embedAsset } from "@/services/embedding-pipeline";
import { detectSearchMode, needsManualEmbedding } from "@/lib/search-mode";
import { logAuditEvent } from "@/services/audit-service";
import { dispatchWebhook } from "@/services/webhook-service";

/** Result of asset creation */
export interface CreateAssetResult {
  success: true;
  assetId: ObjectId;
  type: AssetType;
  name: string;
}

/** Error result with validation details */
export interface CreateAssetError {
  success: false;
  error: string;
  validationErrors?: Array<{ field: string; message: string }>;
}

/**
 * Create a new asset with full validation and auto-population.
 *
 * Steps:
 * 1. Validate input via per-type validators (8.2)
 * 2. Build searchText for autoEmbed (ADR-010)
 * 3. Insert document
 * 4. Generate embedding if in manual mode (M0/local)
 */
export async function createAsset(
  db: Db,
  input: CreateAssetInput
): Promise<CreateAssetResult | CreateAssetError> {
  // 1. Validate
  const validation: ValidationResult = validateAssetInput(input);
  if (!validation.valid) {
    return { success: false, error: "Validation failed", validationErrors: validation.errors };
  }

  // 2. Build document
  const now = new Date();
  const searchText = buildSearchText(
    input.metadata.name,
    input.metadata.description,
    input.content,
    input.tags
  );

  const doc = {
    _id: new ObjectId(),
    type: input.type,
    teamId: input.teamId,
    metadata: input.metadata,
    content: input.content,
    tags: input.tags.map((t) => t.toLowerCase().trim()),
    searchText,
    source: input.source,
    stats: { installCount: 0, viewCount: 0 },
    isPublished: input.isPublished ?? false,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
    // Type-specific configs
    ...(input.agentConfig && { agentConfig: input.agentConfig }),
    ...(input.ruleConfig && { ruleConfig: input.ruleConfig }),
    ...(input.pluginConfig && { pluginConfig: input.pluginConfig }),
    ...(input.mcpConfig && { mcpConfig: input.mcpConfig }),
    ...(input.hookConfig && { hookConfig: input.hookConfig }),
    ...(input.settingsConfig && { settingsConfig: input.settingsConfig }),
  };

  // 3. Insert
  await db.collection("assets").insertOne(doc);

  // 4. Embed if manual mode (non-blocking — don't fail creation on embed error)
  const mode = await detectSearchMode(db);
  if (needsManualEmbedding(mode)) {
    try {
      await embedAsset(
        db, doc._id,
        input.metadata.name, input.metadata.description,
        input.content, input.tags
      );
    } catch (err) {
      console.warn(`Manual embedding failed for asset ${doc._id}:`, err);
    }
  }

  // 5. Audit log (fire-and-forget)
  logAuditEvent(db, {
    actorId: input.createdBy,
    action: "asset:create",
    targetId: doc._id,
    targetType: input.type,
    teamId: input.teamId,
    details: { name: input.metadata.name },
  });

  // 6. Webhook dispatch (fire-and-forget)
  if (input.teamId) {
    const orgDoc = await db.collection("teams").findOne(
      { _id: input.teamId },
      { projection: { orgId: 1 } }
    );
    if (orgDoc?.orgId) {
      dispatchWebhook(db, orgDoc.orgId, "asset.created", {
        assetId: doc._id.toHexString(),
        type: input.type,
        name: input.metadata.name,
      });
    }
  }

  return { success: true, assetId: doc._id, type: input.type, name: input.metadata.name };
}

/**
 * Update an asset's mutable fields, rebuild searchText, and auto-version.
 *
 * When content or metadata changes AND updatedBy is provided,
 * a new version entry is created automatically.
 *
 * Returns true if update was applied, false if asset not found.
 */
export async function updateAsset(
  db: Db,
  assetId: ObjectId,
  updates: {
    name?: string;
    description?: string;
    version?: string;
    content?: string;
    tags?: string[];
    isPublished?: boolean;
    updatedBy?: ObjectId;
    changeReason?: string;
  }
): Promise<boolean> {
  // Fetch current doc for searchText rebuild
  const current = await db.collection<AssetDocument>("assets").findOne(
    { _id: assetId },
    { projection: { teamId: 1, metadata: 1, content: 1, tags: 1 } }
  );
  if (!current) return false;

  // If content/metadata changed and updatedBy is provided, create version
  const hasVersionableChange = updates.content !== undefined || updates.name !== undefined || updates.description !== undefined;
  if (hasVersionableChange && updates.updatedBy) {
    const { createVersion } = await import("./version-service");
    await createVersion(db, assetId, {
      content: updates.content ?? current.content,
      metadata: {
        name: updates.name ?? current.metadata.name,
        description: updates.description ?? current.metadata.description,
        version: updates.version ?? current.metadata.version,
      },
      tags: updates.tags ?? current.tags,
      updatedBy: updates.updatedBy,
      changeReason: updates.changeReason,
    });
    // createVersion already updates the asset's content, metadata, tags
    // so we only need to handle the remaining fields
    const $setRemaining: Record<string, unknown> = {};
    if (updates.isPublished !== undefined) $setRemaining.isPublished = updates.isPublished;
    if (Object.keys($setRemaining).length > 0) {
      await db.collection("assets").updateOne({ _id: assetId }, { $set: $setRemaining });
    }
    return true;
  }

  const $set: Record<string, unknown> = { updatedAt: new Date() };

  if (updates.name !== undefined) $set["metadata.name"] = updates.name;
  if (updates.description !== undefined) $set["metadata.description"] = updates.description;
  if (updates.version !== undefined) $set["metadata.version"] = updates.version;
  if (updates.content !== undefined) $set.content = updates.content;
  if (updates.tags !== undefined) $set.tags = updates.tags.map((t) => t.toLowerCase().trim());
  if (updates.isPublished !== undefined) $set.isPublished = updates.isPublished;

  // Rebuild searchText if searchable fields changed
  const hasSearchableChange = updates.name || updates.description || updates.content || updates.tags;
  if (hasSearchableChange) {
    const newName = updates.name ?? current.metadata.name;
    const newDesc = updates.description ?? current.metadata.description;
    const newContent = updates.content ?? current.content;
    const newTags = updates.tags ?? current.tags;
    $set.searchText = buildSearchText(newName, newDesc, newContent, newTags);
  }

  const result = await db.collection("assets").updateOne({ _id: assetId }, { $set });

  // Audit log (fire-and-forget) — only if update matched a document
  if (result.matchedCount > 0 && current.teamId) {
    logAuditEvent(db, {
      actorId: updates.updatedBy ?? assetId,
      action: updates.isPublished === true ? "asset:publish"
        : updates.isPublished === false ? "asset:unpublish"
        : "asset:update",
      targetId: assetId,
      teamId: current.teamId as unknown as ObjectId,
      details: { updatedFields: Object.keys(updates).filter((k) => updates[k as keyof typeof updates] !== undefined) },
    });
  }

  return result.matchedCount > 0;
}

/**
 * Get a single asset by ID.
 * Excludes embedding and searchText from projection (large fields).
 */
export async function getAsset(
  db: Db,
  assetId: ObjectId
): Promise<AssetDocument | null> {
  return db.collection<AssetDocument>("assets").findOne(
    { _id: assetId },
    { projection: { embedding: 0, searchText: 0 } }
  );
}

/** Options for listing team assets */
export interface ListAssetsOptions {
  teamId: ObjectId;
  type?: AssetType;
  publishedOnly?: boolean;
  page?: number;
  limit?: number;
}

/**
 * List assets for a team with pagination and optional type filter.
 * Returns [assets, totalCount].
 */
export async function listTeamAssets(
  db: Db,
  options: ListAssetsOptions
): Promise<[AssetDocument[], number]> {
  const { teamId, type, publishedOnly, page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = { teamId };
  if (type) filter.type = type;
  if (publishedOnly) filter.isPublished = true;

  const [assets, total] = await Promise.all([
    db.collection<AssetDocument>("assets")
      .find(filter, { projection: { content: 0, embedding: 0, searchText: 0 } })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(Math.min(limit, 50))
      .toArray(),
    db.collection<AssetDocument>("assets").countDocuments(filter),
  ]);

  return [assets, total];
}

/**
 * Increment a stat counter (viewCount or installCount) on an asset.
 * Per pattern-computed: atomic increment, no race conditions.
 */
export async function incrementAssetStat(
  db: Db,
  assetId: ObjectId,
  stat: "viewCount" | "installCount"
): Promise<void> {
  await db.collection("assets").updateOne(
    { _id: assetId },
    { $inc: { [`stats.${stat}`]: 1 } }
  );
}

/** Result of checking for upstream updates */
export interface UpdateCheckResult {
  assetId: ObjectId;
  name: string;
  hasUpdate: boolean;
  currentFingerprint: string;
  upstreamFingerprint?: string;
  currentVersion?: string;
}

/**
 * Check if assets with source tracking have upstream changes.
 * Compares stored fingerprint to current content fingerprint.
 * Used by "updates available" indicator (ADR-008).
 */
export async function checkForUpdates(
  db: Db,
  teamId: ObjectId
): Promise<UpdateCheckResult[]> {
  const assets = await db.collection<AssetDocument>("assets")
    .find(
      { teamId, "source.repoUrl": { $exists: true, $ne: null } },
      { projection: { metadata: 1, content: 1, source: 1 } }
    )
    .toArray();

  return assets.map((asset) => {
    const currentFingerprint = generateFingerprint(asset.metadata, asset.content);
    return {
      assetId: asset._id,
      name: asset.metadata.name,
      hasUpdate: false, // Requires upstream fetch — flagged for background job
      currentFingerprint,
      currentVersion: asset.metadata.version,
    };
  });
}
