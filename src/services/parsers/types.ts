/**
 * Parser types — shared interfaces for the multi-format import engine.
 *
 * Per typescript-advanced-types: discriminated unions, generics for parser plugins.
 * Per Phase 9: Parse ANY agent config format from ANY AI coding tool.
 */

import type { AssetType } from "@/types/asset";

/** Known config file formats the engine can parse */
export const KNOWN_FORMATS = [
  "skill.md",
  "agent.md",
  "claude.md",
  "plugin.json",
  "cursorrules",
  "cursor-mdc",
  "copilot-instructions",
  "windsurfrules",
  "agents.md",
  "mcp.json",
  "hooks.json",
] as const;

export type ConfigFormat = (typeof KNOWN_FORMATS)[number];

/** Result of parsing a config file — normalized for asset creation */
export interface ParsedAsset {
  /** Detected format */
  format: ConfigFormat;
  /** Mapped asset type */
  assetType: AssetType;
  /** Extracted metadata */
  metadata: {
    name: string;
    description: string;
    author?: string;
    version?: string;
    license?: string;
  };
  /** Raw content (original text/JSON) */
  content: string;
  /** Extracted tags from frontmatter, headings, or JSON keys */
  tags: string[];
  /** Type-specific config extracted from the content */
  typeConfig?: Record<string, unknown>;
  /** Source tool that uses this format */
  sourceTool: string;
}

/** Detection result — format + confidence score (0-100) */
export interface DetectionResult {
  format: ConfigFormat;
  confidence: number;
  /** Which parser should handle this */
  parserId: string;
}

/**
 * Parser plugin interface — each format implements this.
 * Per typescript-advanced-types: generic plugin pattern.
 */
export interface ParserPlugin {
  /** Unique parser identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Formats this parser handles */
  formats: ConfigFormat[];
  /** Source tool(s) this parser targets */
  sourceTools: string[];

  /**
   * Detect if this parser can handle the given file.
   * Returns confidence score (0-100). Higher = better match.
   * Should be FAST — called for every parser on every file.
   */
  detect(filename: string, content: string): number;

  /**
   * Parse the file content into a normalized ParsedAsset.
   * Only called when detect() returned the highest confidence.
   * Can throw on malformed content — caller handles errors.
   */
  parse(filename: string, content: string): ParsedAsset;
}
