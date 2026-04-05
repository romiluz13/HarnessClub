/**
 * Search Mode Detection — AutoEmbed vs Manual Embedding.
 *
 * Per ADR-010:
 * - M10+ clusters: Use autoEmbed index ("assets_autoembed") — MongoDB auto-embeds searchText
 * - M0/local: Use manual Voyage embedding ("assets_vector") — we embed client-side
 *
 * Detection is cached per process lifetime (indexes don't change mid-flight).
 * Falls back to manual mode on any error.
 */

import type { Db } from "mongodb";

export type SearchMode = "auto" | "manual";

/** Cached detection result — null means not yet detected */
let cachedMode: SearchMode | null = null;

/**
 * Detect which semantic search mode is available.
 * Checks if the autoEmbed index exists and is READY.
 * Caches result for the process lifetime.
 */
export async function detectSearchMode(db: Db): Promise<SearchMode> {
  if (cachedMode !== null) return cachedMode;

  try {
    const indexes = await db.collection("assets").listSearchIndexes().toArray();
    const autoEmbedIdx = indexes.find(
      (idx) => idx.name === "assets_autoembed"
    );

    // listSearchIndexes() returns Record<string, unknown> — status may not be typed
    if (autoEmbedIdx && (autoEmbedIdx as Record<string, unknown>).status === "READY") {
      cachedMode = "auto";
      console.log("[search-mode] Using autoEmbed (M10+ mode)");
    } else {
      cachedMode = "manual";
      console.log("[search-mode] Using manual Voyage embedding (M0/local mode)");
    }
  } catch {
    cachedMode = "manual";
    console.log("[search-mode] Defaulting to manual embedding (detection failed)");
  }

  return cachedMode;
}

/**
 * Get the vector search index name for the current mode.
 * - auto mode: "assets_autoembed" (query with text, MongoDB converts to vector)
 * - manual mode: "assets_vector" (query with pre-computed queryVector)
 */
export function getVectorIndexName(mode: SearchMode): string {
  return mode === "auto" ? "assets_autoembed" : "assets_vector";
}

/**
 * Check if assets need manual embedding (M0/local mode).
 * When autoEmbed is active, we skip client-side Voyage calls.
 */
export function needsManualEmbedding(mode: SearchMode): boolean {
  return mode === "manual";
}

/** Reset cached mode — for testing only */
export function resetSearchModeCache(): void {
  cachedMode = null;
}
