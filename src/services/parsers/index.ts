/**
 * Parser module entry point.
 *
 * Importing this file registers ALL parsers with the registry.
 * Parsers auto-register via registerParser() at module load time.
 *
 * Usage:
 *   import { detectFormat, parseFile } from "@/services/parsers";
 */

// Import parser files to trigger registration side effects
import "./markdown-parsers";
import "./dotfile-parsers";
import "./json-parsers";

// Re-export public API from registry
export { detectFormat, parseFile, detectAllFormats, getRegisteredParsers } from "./registry";

// Re-export types
export type { ParsedAsset, DetectionResult, ConfigFormat, ParserPlugin } from "./types";
