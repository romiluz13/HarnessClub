/**
 * Embedding Pipeline Service.
 *
 * Generates and stores Voyage AI embeddings for assets.
 * FALLBACK ONLY — used when autoEmbed is unavailable (M0/local).
 *
 * Per ADR-010: Production (M10+) uses MongoDB autoEmbed.
 * This pipeline is the M0/local fallback.
 *
 * Per vercel-react-best-practices async-parallel:
 * - Parallelize embedding generation with metadata save
 * - Use after() for non-blocking embedding updates when possible
 */

import type { Db, ObjectId } from "mongodb";
import type { AssetType } from "@/types/asset";
import { buildSearchText } from "@/types/asset";
import {
  generateEmbedding,
  truncateForEmbedding,
} from "@/lib/voyage";

/**
 * Build the text payload to embed for an asset.
 * Combines metadata + content for rich semantic representation.
 * Delegates to shared buildSearchText, then truncates for Voyage.
 */
export function buildEmbeddingText(
  name: string,
  description: string,
  content: string,
  tags: string[]
): string {
  return truncateForEmbedding(buildSearchText(name, description, content, tags));
}

/**
 * Generate and store embedding for a single asset.
 * Returns the embedding vector for immediate use.
 * FALLBACK — only called when autoEmbed is not available (M0/local).
 */
export async function embedAsset(
  db: Db,
  assetId: ObjectId,
  name: string,
  description: string,
  content: string,
  tags: string[]
): Promise<number[]> {
  const text = buildEmbeddingText(name, description, content, tags);
  const embedding = await generateEmbedding(text, "document");

  await db.collection("assets").updateOne(
    { _id: assetId },
    { $set: { embedding, updatedAt: new Date() } }
  );

  return embedding;
}

/** @deprecated Use embedAsset instead */
export const embedSkill = embedAsset;

/**
 * Re-embed all assets for a team (optionally filtered by type).
 * Useful for model upgrades or reindexing.
 * Processes in batches to avoid Voyage API rate limits.
 * FALLBACK — only needed when autoEmbed is not available.
 */
export async function reembedTeamAssets(
  db: Db,
  teamId: ObjectId,
  assetType?: AssetType,
  batchSize: number = 10
): Promise<{ processed: number; errors: number }> {
  const filter: Record<string, unknown> = { teamId };
  if (assetType) filter.type = assetType;

  const assets = await db
    .collection("assets")
    .find(filter, { projection: { _id: 1, metadata: 1, content: 1, tags: 1 } })
    .toArray();

  let processed = 0;
  let errors = 0;

  for (let i = 0; i < assets.length; i += batchSize) {
    const batch = assets.slice(i, i + batchSize);

    const results = await Promise.allSettled(
      batch.map((asset) =>
        embedAsset(
          db,
          asset._id,
          asset.metadata.name,
          asset.metadata.description,
          asset.content,
          asset.tags
        )
      )
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        processed++;
      } else {
        errors++;
      }
    }
  }

  return { processed, errors };
}

/** @deprecated Use reembedTeamAssets instead */
export const reembedTeamSkills = reembedTeamAssets;
