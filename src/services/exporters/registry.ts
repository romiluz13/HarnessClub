/**
 * Exporter Registry — target tool → exporter dispatch.
 *
 * Architecture mirrors parser registry (Phase 9):
 * 1. All exporters register themselves at module load time
 * 2. exportAsset() dispatches to the correct exporter by target + type
 * 3. Exporters are stateless and side-effect-free
 *
 * Per Phase 10: supports 5 target tools.
 */

import type { ExporterPlugin, ExportedFile, ExportTarget } from "./types";
import type { AssetDocument, AssetType } from "@/types/asset";

/** Registry of all exporter plugins */
const exporters: Map<string, ExporterPlugin> = new Map();

/**
 * Register an exporter plugin.
 * Called at module load time by each exporter file.
 */
export function registerExporter(exporter: ExporterPlugin): void {
  exporters.set(exporter.id, exporter);
}

/**
 * Export a single asset to a target tool format.
 *
 * @throws Error if no exporter matches the target + asset type
 */
export function exportAsset(
  asset: AssetDocument,
  target: ExportTarget
): ExportedFile {
  // Find exporter for this target that supports this asset type
  for (const exporter of exporters.values()) {
    if (
      exporter.target === target &&
      exporter.supportedTypes.includes(asset.type)
    ) {
      return exporter.export(asset);
    }
  }

  throw new Error(
    `No exporter found for target "${target}" and asset type "${asset.type}". ` +
    `Available exporters: ${Array.from(exporters.values()).map((e) => `${e.target}[${e.supportedTypes.join(",")}]`).join(", ")}`
  );
}

/**
 * Check if an asset can be exported to a given target.
 */
export function canExport(assetType: AssetType, target: ExportTarget): boolean {
  for (const exporter of exporters.values()) {
    if (exporter.target === target && exporter.supportedTypes.includes(assetType)) {
      return true;
    }
  }
  return false;
}

/**
 * Get all available export targets for a given asset type.
 */
export function getAvailableTargets(assetType: AssetType): ExportTarget[] {
  const targets: Set<ExportTarget> = new Set();
  for (const exporter of exporters.values()) {
    if (exporter.supportedTypes.includes(assetType)) {
      targets.add(exporter.target);
    }
  }
  return Array.from(targets);
}

/**
 * Get all registered exporters (for debugging/listing).
 */
export function getRegisteredExporters(): Array<{
  id: string;
  name: string;
  target: ExportTarget;
  supportedTypes: AssetType[];
}> {
  return Array.from(exporters.values()).map((e) => ({
    id: e.id,
    name: e.name,
    target: e.target,
    supportedTypes: [...e.supportedTypes],
  }));
}
