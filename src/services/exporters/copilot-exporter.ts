/**
 * GitHub Copilot Exporter — .github/copilot-instructions.md format.
 *
 * Copilot uses a single instruction file at .github/copilot-instructions.md.
 * All text-based assets (skills, rules, agents) are merged into this file.
 * Sections are separated by H2 headers with asset name.
 */

import { registerExporter } from "./registry";
import type { ExporterPlugin, ExportedFile } from "./types";
import type { AssetDocument } from "@/types/asset";

const copilotExporter: ExporterPlugin = {
  id: "copilot",
  name: "GitHub Copilot",
  target: "copilot",
  supportedTypes: ["skill", "agent", "rule"],

  export(asset: AssetDocument): ExportedFile {
    const header = `## ${asset.metadata.name}\n\n> ${asset.metadata.description}\n\n`;
    const content = header + asset.content;

    return {
      filename: ".github/copilot-instructions.md",
      content,
      mimeType: "text/markdown",
      sourceType: asset.type,
      target: "copilot",
    };
  },
};

registerExporter(copilotExporter);
