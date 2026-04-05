/**
 * Exporter module entry point.
 *
 * Importing this file registers ALL exporters with the registry.
 * Exporters auto-register via registerExporter() at module load time.
 *
 * Usage:
 *   import { exportAsset, getAvailableTargets } from "@/services/exporters";
 */

// Import exporter files to trigger registration side effects
import "./claude-code-exporter";
import "./cursor-exporter";
import "./copilot-exporter";
import "./windsurf-exporter";
import "./codex-exporter";

// Re-export public API from registry
export {
  exportAsset,
  canExport,
  getAvailableTargets,
  getRegisteredExporters,
} from "./registry";

// Re-export types
export type {
  ExporterPlugin,
  ExportedFile,
  ExportTarget,
} from "./types";

export { EXPORT_TARGETS } from "./types";
