/**
 * Search Service — Hybrid search combining lexical + semantic.
 *
 * Per mongodb-search-and-ai hybrid-search:
 * - $search (Atlas Search) for lexical matching
 * - $vectorSearch for semantic matching
 * - Combined via application-level rank fusion
 *
 * Per async-api-routes: Start embedding promise early, await late.
 * Per mongodb-natural-language-querying: $match early, project only needed fields.
 *
 * Team isolation: ALL queries pre-filter by teamId.
 * Type isolation: Optional type filter for asset-specific queries.
 */

import type { Db, ObjectId, Document } from "mongodb";
import type { AssetType } from "@/types/asset";
import { generateEmbedding } from "@/lib/voyage";
import { detectSearchMode, getVectorIndexName } from "@/lib/search-mode";

/** Search result returned to the client */
export interface SearchResult {
  assetId: string;
  type: AssetType;
  name: string;
  description: string;
  tags: string[];
  score: number;
  highlights?: string[];
  /** @deprecated Use assetId instead */
  skillId?: string;
}

/** Options for search queries */
export interface SearchOptions {
  teamId: ObjectId;
  query: string;
  limit?: number;
  /** "hybrid" | "lexical" | "semantic" */
  mode?: "hybrid" | "lexical" | "semantic";
  /** Filter by asset type(s) */
  assetType?: AssetType | AssetType[];
  /** Filter by tags */
  tags?: string[];
  /** Only published assets */
  publishedOnly?: boolean;
}

/** Build type filter array for Atlas Search compound queries */
function buildTypeFilter(assetType?: AssetType | AssetType[]): Document[] {
  if (!assetType) return [];
  if (Array.isArray(assetType)) {
    return assetType.length > 0 ? [{ in: { path: "type", value: assetType } }] : [];
  }
  return [{ equals: { path: "type", value: assetType } }];
}

/**
 * Lexical search using Atlas Search $search operator.
 * Per mongodb-search-and-ai: compound query with text (must) + equals (filter).
 * Requires "assets_search" Atlas Search index on the cluster.
 */
export async function lexicalSearch(
  db: Db,
  options: SearchOptions
): Promise<SearchResult[]> {
  const { teamId, query, limit = 10, assetType, tags, publishedOnly } = options;

  const pipeline: Document[] = [
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
            ...buildTypeFilter(assetType),
            ...(publishedOnly ? [{ equals: { path: "isPublished", value: true } }] : []),
            ...(tags?.length ? [{ in: { path: "tags", value: tags } }] : []),
          ],
        },
        highlight: { path: ["metadata.name", "metadata.description"] },
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
        score: { $meta: "searchScore" },
        highlights: { $meta: "searchHighlights" },
      },
    },
  ];

  const results = await db.collection("assets").aggregate(pipeline).toArray();

  return results.map((doc) => ({
    assetId: doc._id.toString(),
    skillId: doc._id.toString(),
    type: doc.type,
    name: doc.metadata.name,
    description: doc.metadata.description,
    tags: doc.tags,
    score: doc.score,
    highlights: doc.highlights?.map(
      (h: { texts: Array<{ value: string }> }) =>
        h.texts.map((t) => t.value).join("")
    ),
  }));
}

/**
 * Semantic search using Vector Search — dual-mode (ADR-010).
 *
 * AUTO mode (M10+): Uses "assets_autoembed" index. MongoDB auto-embeds the query text.
 *   → No client-side embedding needed, query with text string.
 * MANUAL mode (M0/local): Uses "assets_vector" index with pre-computed Voyage embeddings.
 *   → Client-side embedding via Voyage AI, query with vector.
 *
 * Mode is auto-detected at startup and cached.
 */
export async function semanticSearch(
  db: Db,
  options: SearchOptions
): Promise<SearchResult[]> {
  const { teamId, query, limit = 10, assetType, publishedOnly } = options;

  const mode = await detectSearchMode(db);
  const indexName = getVectorIndexName(mode);

  const vectorFilter: Document = { teamId };
  if (assetType) {
    vectorFilter.type = Array.isArray(assetType) ? { $in: assetType } : assetType;
  }
  if (publishedOnly) vectorFilter.isPublished = true;

  let pipeline: Document[];

  if (mode === "auto") {
    // AutoEmbed mode — query with text, MongoDB converts to vector automatically
    pipeline = [
      {
        $vectorSearch: {
          index: indexName,
          path: "searchText",
          queryString: query,
          numCandidates: limit * 10,
          limit,
          filter: vectorFilter,
        },
      },
      {
        $project: {
          _id: 1, type: 1, "metadata.name": 1, "metadata.description": 1,
          tags: 1, score: { $meta: "vectorSearchScore" },
        },
      },
    ];
  } else {
    // Manual mode — generate query embedding client-side via Voyage
    const queryEmbedding = await generateEmbedding(query, "query");
    pipeline = [
      {
        $vectorSearch: {
          index: indexName,
          path: "embedding",
          queryVector: queryEmbedding,
          numCandidates: limit * 10,
          limit,
          filter: vectorFilter,
        },
      },
      {
        $project: {
          _id: 1, type: 1, "metadata.name": 1, "metadata.description": 1,
          tags: 1, score: { $meta: "vectorSearchScore" },
        },
      },
    ];
  }

  const results = await db.collection("assets").aggregate(pipeline).toArray();

  return results.map((doc) => ({
    assetId: doc._id.toString(),
    skillId: doc._id.toString(),
    type: doc.type,
    name: doc.metadata.name,
    description: doc.metadata.description,
    tags: doc.tags,
    score: doc.score,
  }));
}
