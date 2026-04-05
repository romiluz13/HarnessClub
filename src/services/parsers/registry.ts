/**
 * Parser Registry — format detection + dispatch.
 *
 * Architecture:
 * 1. All parsers register themselves at module load time
 * 2. detect() runs ALL parsers against a file, picks highest confidence
 * 3. parse() delegates to the winning parser
 * 4. Parsers are stateless and side-effect-free
 *
 * Per Phase 9: supports 11 formats from 5+ AI coding tools.
 */

import type { ParserPlugin, ParsedAsset, DetectionResult } from "./types";

/** Registry of all parser plugins */
const parsers: Map<string, ParserPlugin> = new Map();

/**
 * Register a parser plugin.
 * Called at module load time by each parser file.
 * Idempotent — re-registering same ID overwrites.
 */
export function registerParser(parser: ParserPlugin): void {
  parsers.set(parser.id, parser);
}

/**
 * Detect the best parser for a given file.
 * Runs all registered parsers' detect() methods and picks highest confidence.
 * Returns null if no parser has confidence > 0.
 */
export function detectFormat(
  filename: string,
  content: string
): DetectionResult | null {
  let best: DetectionResult | null = null;

  for (const parser of parsers.values()) {
    const confidence = parser.detect(filename, content);
    if (confidence > 0 && (!best || confidence > best.confidence)) {
      best = {
        format: parser.formats[0], // Primary format
        confidence,
        parserId: parser.id,
      };
    }
  }

  return best;
}

/**
 * Parse a file using the best-matching parser.
 * Auto-detects format if parserId not specified.
 *
 * @throws Error if no parser matches or parsing fails
 */
export function parseFile(
  filename: string,
  content: string,
  parserId?: string
): ParsedAsset {
  let parser: ParserPlugin | undefined;

  if (parserId) {
    parser = parsers.get(parserId);
    if (!parser) {
      throw new Error(`Parser "${parserId}" not found in registry`);
    }
  } else {
    const detection = detectFormat(filename, content);
    if (!detection) {
      throw new Error(
        `No parser matched file "${filename}". Registered parsers: ${Array.from(parsers.keys()).join(", ")}`
      );
    }
    parser = parsers.get(detection.parserId);
  }

  if (!parser) {
    throw new Error(`Parser not found for file "${filename}"`);
  }

  return parser.parse(filename, content);
}

/**
 * Get all registered parsers (for debugging/listing).
 */
export function getRegisteredParsers(): Array<{
  id: string;
  name: string;
  formats: string[];
  sourceTools: string[];
}> {
  return Array.from(parsers.values()).map((p) => ({
    id: p.id,
    name: p.name,
    formats: [...p.formats],
    sourceTools: [...p.sourceTools],
  }));
}

/**
 * Detect ALL matching parsers for a file (sorted by confidence desc).
 * Useful for ambiguous files where user may want to choose.
 */
export function detectAllFormats(
  filename: string,
  content: string
): DetectionResult[] {
  const results: DetectionResult[] = [];

  for (const parser of parsers.values()) {
    const confidence = parser.detect(filename, content);
    if (confidence > 0) {
      results.push({
        format: parser.formats[0],
        confidence,
        parserId: parser.id,
      });
    }
  }

  return results.sort((a, b) => b.confidence - a.confidence);
}

/** Reset registry — for testing only */
export function resetRegistry(): void {
  parsers.clear();
}
