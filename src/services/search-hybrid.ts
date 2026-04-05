/**
 * Hybrid Search — Combines lexical and semantic results.
 *
 * Per mongodb-search-and-ai hybrid-search:
 * Strategy 1 (preferred): $rankFusion — native MongoDB server-side RRF.
 *   Runs $search + $vectorSearch in a single aggregation pipeline.
 *   Available on Atlas clusters v8.1+, and mongodb-atlas-local:preview Docker.
 *   NOT available on Atlas M0 free tier (preview features disabled on free/shared).
 *   Ref: https://www.mongodb.com/docs/manual/reference/operator/aggregation/rankFusion/
 *
 * Strategy 2 (fallback): Application-level RRF — run $search + $vectorSearch
 *   as separate queries, merge in JavaScript using RRF formula.
 *   Works on ALL MongoDB deployments with Atlas Search + Vector Search.
 *
 * RRF formula: score = Σ 1/(k + rank_i) for each result list
 * k=60 is the standard constant (from academic literature)
 */

import type { Db, Document } from "mongodb";
import type { AssetType } from "@/types/asset";
import { lexicalSearch, semanticSearch, type SearchOptions, type SearchResult } from "./search";
import { generateEmbedding } from "@/lib/voyage";
import { detectSearchMode, getVectorIndexName } from "@/lib/search-mode";

const RRF_K = 60;

/**
 * Reciprocal Rank Fusion — merge multiple ranked lists.
 * Each result gets a score of 1/(k + rank) from each list it appears in.
 * Results appearing in multiple lists get boosted.
 */
export function reciprocalRankFusion(
  resultLists: SearchResult[][],
  limit: number
): SearchResult[] {
  const scoreMap = new Map<string, { result: SearchResult; score: number }>();

  for (const list of resultLists) {
    for (let rank = 0; rank < list.length; rank++) {
      const result = list[rank];
      const rrfScore = 1 / (RRF_K + rank + 1);
      const key = result.assetId;
      const existing = scoreMap.get(key);

      if (existing) {
        existing.score += rrfScore;
        if (result.highlights?.length) {
          existing.result.highlights = [
            ...(existing.result.highlights || []),
            ...result.highlights,
          ];
        }
      } else {
        scoreMap.set(key, {
          result: { ...result },
          score: rrfScore,
        });
      }
    }
  }

  return Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ result, score }) => ({ ...result, score }));
}

/**
 * Build the $rankFusion aggregation pipeline.
 * Per MongoDB docs: $rankFusion is a Preview feature on Atlas v8.1+ and atlas-local:preview.
 * NOT available on M0 free tier. Ref: https://www.mongodb.com/docs/atlas/atlas-vector-search/hybrid-search/
 */
function buildRankFusionPipeline(
  options: SearchOptions,
  queryEmbedding: number[],
  searchMode: "auto" | "manual" = "manual"
): Document[] {
  const { teamId, query, limit = 10, assetType, tags, publishedOnly } = options;

  // Build type filter for lexical branch
  const typeFilter: Document[] = [];
  if (assetType) {
    if (Array.isArray(assetType) && assetType.length > 0) {
      typeFilter.push({ in: { path: "type", value: assetType } });
    } else if (typeof assetType === "string") {
      typeFilter.push({ equals: { path: "type", value: assetType } });
    }
  }

  // Build vector filter
  const vectorFilter: Document = { teamId };
  if (assetType) {
    vectorFilter.type = Array.isArray(assetType) ? { $in: assetType } : assetType;
  }
  if (publishedOnly) vectorFilter.isPublished = true;

  // Build semantic pipeline branch based on mode (ADR-010)
  const vectorIndex = getVectorIndexName(searchMode);
  const semanticStage: Document = searchMode === "auto"
    ? {
        $vectorSearch: {
          index: vectorIndex,
          path: "searchText",
          queryString: query,
          numCandidates: limit * 10,
          limit: limit * 2,
          filter: vectorFilter,
        },
      }
    : {
        $vectorSearch: {
          index: vectorIndex,
          path: "embedding",
          queryVector: queryEmbedding,
          numCandidates: limit * 10,
          limit: limit * 2,
          filter: vectorFilter,
        },
      };

  return [
    {
      $rankFusion: {
        input: {
          pipelines: {
            lexical: [
              {
                $search: {
                  index: "assets_search",
                  compound: {
                    must: [
                      {
                        text: {
                          query,
                          path: ["metadata.name", "metadata.description", "content", "searchText"],
                          fuzzy: { maxEdits: 1 },
                        },
                      },
                    ],
                    filter: [
                      { equals: { path: "teamId", value: teamId } },
                      ...typeFilter,
                      ...(publishedOnly ? [{ equals: { path: "isPublished", value: true } }] : []),
                      ...(tags?.length ? [{ in: { path: "tags", value: tags } }] : []),
                    ],
                  },
                },
              },
              { $limit: limit * 2 },
            ],
            semantic: [semanticStage],
          },
        },
      },
    },
    { $limit: limit },
    {
      $project: {
        _id: 1,
        type: 1,
        "metadata.name": 1,
        "metadata.description": 1,
        tags: 1,
        score: { $meta: "score" },
      },
    },
  ];
}

/**
 * Try native $rankFusion (Atlas v8.1+, atlas-local:preview).
 * Returns null if $rankFusion is not supported (M0 free tier, older versions).
 */
async function tryRankFusion(
  db: Db,
  options: SearchOptions,
  queryEmbedding: number[],
  searchMode: "auto" | "manual" = "manual"
): Promise<SearchResult[] | null> {
  const pipeline = buildRankFusionPipeline(options, queryEmbedding, searchMode);

  try {
    const results = await db.collection("assets").aggregate(pipeline).toArray();

    return results.map((doc) => ({
      assetId: doc._id.toString(),
      skillId: doc._id.toString(),
      type: doc.type,
      name: doc.metadata?.name ?? "",
      description: doc.metadata?.description ?? "",
      tags: doc.tags ?? [],
      score: doc.score ?? 0,
    }));
  } catch (err: unknown) {
    const mongoErr = err as { code?: number; codeName?: string; message?: string };
    // Error code 40324 = "Unrecognized pipeline stage name" (M0, MongoDB <8.0)
    // Also check for common error messages about $rankFusion not being supported
    if (
      mongoErr.code === 40324 ||
      mongoErr.codeName === "Location40324" ||
      mongoErr.message?.includes("rankFusion") ||
      mongoErr.message?.includes("Unrecognized pipeline stage")
    ) {
      return null; // Fallback to app-level RRF
    }
    throw err; // Re-throw unexpected errors
  }
}

/**
 * Hybrid search — tries native $rankFusion first, falls back to app-level RRF.
 *
 * Strategy:
 * 1. Generate query embedding (needed for both strategies)
 * 2. Try $rankFusion (server-side, Atlas v8.1+ / atlas-local:preview)
 * 3. If not supported → fall back to parallel $search + $vectorSearch + JS RRF
 *
 * Per async-parallel (CRITICAL): Both searches run simultaneously in fallback.
 * Per async-api-routes: Start embedding promise early (in semanticSearch).
 */
export async function hybridSearch(
  db: Db,
  options: SearchOptions
): Promise<SearchResult[]> {
  const { mode = "hybrid", limit = 10 } = options;

  if (mode === "lexical") {
    return lexicalSearch(db, options);
  }

  if (mode === "semantic") {
    return semanticSearch(db, options);
  }

  // Detect search mode (auto vs manual) — cached per process (ADR-010)
  const searchMode = await detectSearchMode(db);

  // Generate embedding — only needed in manual mode, but always generate for fallback
  const queryEmbedding = searchMode === "manual"
    ? await generateEmbedding(options.query, "query")
    : []; // autoEmbed mode doesn't need client-side embedding

  // Strategy 1: Try native $rankFusion (Atlas v8.1+, atlas-local:preview)
  const rankFusionResults = await tryRankFusion(db, options, queryEmbedding, searchMode);
  if (rankFusionResults !== null) {
    return rankFusionResults;
  }

  // Strategy 2: Fallback — parallel $search + $vectorSearch, merge with app-level RRF
  const [lexicalResults, semanticResults] = await Promise.all([
    lexicalSearch(db, { ...options, limit: limit * 2 }),
    semanticSearch(db, { ...options, limit: limit * 2 }),
  ]);

  return reciprocalRankFusion([lexicalResults, semanticResults], limit);
}

/**
 * Autocomplete search — fast prefix matching for search-as-you-type.
 * Uses Atlas Search autocomplete analyzer.
 */
export async function autocompleteSearch(
  db: Db,
  teamId: SearchOptions["teamId"],
  prefix: string,
  limit: number = 5,
  assetType?: AssetType | AssetType[]
): Promise<Array<{ assetId: string; type: AssetType; name: string; skillId?: string }>> {
  // Build type filter
  const typeFilter: Document[] = [];
  if (assetType) {
    if (Array.isArray(assetType) && assetType.length > 0) {
      typeFilter.push({ in: { path: "type", value: assetType } });
    } else if (typeof assetType === "string") {
      typeFilter.push({ equals: { path: "type", value: assetType } });
    }
  }

  const pipeline = [
    {
      $search: {
        index: "assets_search",
        compound: {
          must: [
            {
              autocomplete: {
                query: prefix,
                path: "metadata.name",
                fuzzy: { maxEdits: 1 },
              },
            },
          ],
          filter: [
            { equals: { path: "teamId", value: teamId } },
            ...typeFilter,
          ],
        },
      },
    },
    { $limit: limit },
    { $project: { _id: 1, type: 1, "metadata.name": 1 } },
  ];

  const results = await db.collection("assets").aggregate(pipeline).toArray();

  return results.map((doc) => ({
    assetId: doc._id.toString(),
    skillId: doc._id.toString(),
    type: doc.type,
    name: doc.metadata.name,
  }));
}
