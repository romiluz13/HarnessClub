/**
 * Cursor Exporter — .cursorrules / .cursor/rules/*.mdc format.
 *
 * Cursor supports two rule formats:
 * 1. .cursorrules — flat text file at project root (legacy)
 * 2. .cursor/rules/*.mdc — MDC format with frontmatter (preferred)
 *
 * Skills/rules/agents are flattened into a single instruction block.
 * MCP configs are exported as .cursor/mcp.json.
 */

import { registerExporter } from "./registry";
import type { ExporterPlugin, ExportedFile } from "./types";
import type { AssetDocument } from "@/types/asset";

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/**
 * Build MDC (Markdown Component) format for Cursor rules.
 * MDC uses a frontmatter with description, globs, and alwaysApply.
 */
function buildMdc(asset: AssetDocument): string {
  const lines = ["---"];
  lines.push(`description: ${asset.metadata.description}`);
  lines.push("alwaysApply: true");
  lines.push("---");
  lines.push("");
  lines.push(asset.content);
  return lines.join("\n");
}

const cursorExporter: ExporterPlugin = {
  id: "cursor",
  name: "Cursor",
  target: "cursor",
  supportedTypes: ["skill", "agent", "rule", "mcp_config"],

  export(asset: AssetDocument): ExportedFile {
    switch (asset.type) {
      case "skill":
      case "agent":
      case "rule": {
        // Export as MDC rule file (preferred Cursor format)
        const slug = slugify(asset.metadata.name);
        const content = buildMdc(asset);
        return {
          filename: `.cursor/rules/${slug}.mdc`,
          content,
          mimeType: "text/markdown",
          sourceType: asset.type,
          target: "cursor",
        };
      }

      case "mcp_config":
        return {
          filename: ".cursor/mcp.json",
          content: asset.content,
          mimeType: "application/json",
          sourceType: asset.type,
          target: "cursor",
        };

      default:
        throw new Error(`Unsupported asset type for Cursor: ${asset.type}`);
    }
  },
};

registerExporter(cursorExporter);
