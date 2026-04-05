/**
 * Voyage AI Embedding Client
 *
 * Uses voyage-3-lite model (512 dimensions) for semantic search.
 * Per ADR-002: Explicit Voyage pipeline since auto-embeddings
 * aren't available on Atlas M0.
 *
 * Per js-cache-function-results: Module-level cache for repeated lookups.
 */

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = "voyage-3-lite";
export const EMBEDDING_DIMENSIONS = 512;

if (!VOYAGE_API_KEY) {
  console.warn(
    "VOYAGE_API_KEY environment variable is not set. " +
      "Semantic search will not work. Add it to .env.local."
  );
}

interface VoyageEmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  usage: {
    total_tokens: number;
  };
}

/**
 * Generate embeddings for one or more texts.
 *
 * Per async-parallel: When embedding multiple texts, this sends
 * them in a single batch request rather than sequential calls.
 *
 * @param texts - Array of strings to embed (max 128 per batch)
 * @param inputType - "document" for indexing, "query" for search queries
 * @returns Array of 512-dimension vectors (voyage-3-lite)
 */
export async function generateEmbeddings(
  texts: string[],
  inputType: "document" | "query" = "document"
): Promise<number[][]> {
  if (!VOYAGE_API_KEY) {
    throw new Error("VOYAGE_API_KEY is not configured");
  }

  if (texts.length === 0) {
    return [];
  }

  // Voyage API batch limit is 128 texts
  if (texts.length > 128) {
    throw new Error(
      `Voyage API supports max 128 texts per batch, got ${texts.length}`
    );
  }

  const response = await fetch(VOYAGE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      model: VOYAGE_MODEL,
      input: texts,
      input_type: inputType,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Voyage API error (${response.status}): ${errorBody}`
    );
  }

  const result = (await response.json()) as VoyageEmbeddingResponse;

  // Sort by index to maintain input order
  return result.data
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
}

/**
 * Generate a single embedding for one text.
 * Convenience wrapper for the common single-document case.
 */
export async function generateEmbedding(
  text: string,
  inputType: "document" | "query" = "document"
): Promise<number[]> {
  const [embedding] = await generateEmbeddings([text], inputType);
  return embedding;
}

/**
 * Truncate text to fit within Voyage API token limits.
 * voyage-3-lite supports up to 32,000 tokens (~128,000 chars).
 * We truncate at 100,000 chars to leave margin.
 */
export function truncateForEmbedding(text: string): string {
  const MAX_CHARS = 100_000;
  if (text.length <= MAX_CHARS) {
    return text;
  }
  return text.slice(0, MAX_CHARS);
}
