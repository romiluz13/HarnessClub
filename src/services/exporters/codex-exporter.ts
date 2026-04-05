/**
 * Codex / OpenAI Exporter — AGENTS.md format.
 *
 * OpenAI's Codex CLI uses AGENTS.md for agent instructions.
 * Similar to CLAUDE.md — merged rules into a single markdown file.
 * Sections are separated by H2 headers with asset name.
 */

import { registerExporter } from "./registry";
import type { ExporterPlugin, ExportedFile } from "./types";
import type { AssetDocument } from "@/types/asset";

const codexExporter: ExporterPlugin = {
  id: "codex",
  name: "Codex / OpenAI",
  target: "codex",
  supportedTypes: ["skill", "agent", "rule"],

  export(asset: AssetDocument): ExportedFile {
    const header = `## ${asset.metadata.name}\n\n> ${asset.metadata.description}\n\n`;
    const content = header + asset.content;

    return {
      filename: "AGENTS.md",
      content,
      mimeType: "text/markdown",
      sourceType: asset.type,
      target: "codex",
    };
  },
};

registerExporter(codexExporter);
