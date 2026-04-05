/**
 * Exporter types — shared interfaces for the multi-format export engine.
 *
 * Mirrors parser registry pattern (Phase 9):
 * - Each exporter implements ExporterPlugin interface
 * - Registry dispatches by target tool
 * - Exporters are stateless and side-effect-free
 *
 * Per typescript-advanced-types: discriminated unions for export targets.
 */

import type { AssetDocument, AssetType } from "@/types/asset";

/** Supported export target tools */
export const EXPORT_TARGETS = [
  "claude-code",
  "cursor",
  "copilot",
  "windsurf",
  "codex",
] as const;

export type ExportTarget = (typeof EXPORT_TARGETS)[number];

/** Result of exporting an asset to a target format */
export interface ExportedFile {
  /** Target filename (e.g., ".cursorrules", "SKILL.md") */
  filename: string;
  /** Generated file content */
  content: string;
  /** MIME type for HTTP response */
  mimeType: string;
  /** Source asset type that was exported */
  sourceType: AssetType;
  /** Target tool this was exported for */
  target: ExportTarget;
}

/** Exporter plugin interface — one per target tool */
export interface ExporterPlugin {
  /** Unique exporter ID */
  id: string;
  /** Human-readable name */
  name: string;
  /** Target tool this exporter generates files for */
  target: ExportTarget;
  /** Asset types this exporter can handle */
  supportedTypes: AssetType[];

  /**
   * Export a single asset to the target format.
   * Returns the generated file(s).
   *
   * @throws Error if asset type is not supported
   */
  export(asset: AssetDocument): ExportedFile;
}
