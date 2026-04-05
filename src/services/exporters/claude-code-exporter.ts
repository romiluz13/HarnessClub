/**
 * Claude Code Exporter — native format (1:1 mapping).
 *
 * Claude Code is the native format for AgentConfig, so export is mostly passthrough.
 * Maps asset types to their Claude Code file conventions:
 * - skill → SKILL.md (with frontmatter)
 * - agent → agents/{name}.md
 * - rule → CLAUDE.md
 * - plugin → plugin.json (manifest + bundled references)
 * - mcp_config → .mcp.json
 * - hook → hooks.json
 * - settings_bundle → settings.json
 */

import { registerExporter } from "./registry";
import type { ExporterPlugin, ExportedFile } from "./types";
import type { AssetDocument } from "@/types/asset";

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function buildFrontmatter(asset: AssetDocument): string {
  const lines = ["---"];
  lines.push(`name: ${asset.metadata.name}`);
  lines.push(`description: ${asset.metadata.description}`);
  if (asset.metadata.author) lines.push(`author: ${asset.metadata.author}`);
  if (asset.metadata.version) lines.push(`version: ${asset.metadata.version}`);
  if (asset.tags.length > 0) lines.push(`tags: ${asset.tags.join(", ")}`);
  lines.push("---");
  return lines.join("\n");
}

const claudeCodeExporter: ExporterPlugin = {
  id: "claude-code",
  name: "Claude Code (Native)",
  target: "claude-code",
  supportedTypes: ["skill", "agent", "rule", "plugin", "mcp_config", "hook", "settings_bundle"],

  export(asset: AssetDocument): ExportedFile {
    switch (asset.type) {
      case "skill": {
        const frontmatter = buildFrontmatter(asset);
        const content = `${frontmatter}\n\n${asset.content}`;
        return {
          filename: "SKILL.md",
          content,
          mimeType: "text/markdown",
          sourceType: asset.type,
          target: "claude-code",
        };
      }

      case "agent": {
        const frontmatter = buildFrontmatter(asset);
        const slug = slugify(asset.metadata.name);
        const content = `${frontmatter}\n\n${asset.content}`;
        return {
          filename: `agents/${slug}.md`,
          content,
          mimeType: "text/markdown",
          sourceType: asset.type,
          target: "claude-code",
        };
      }

      case "rule":
        return {
          filename: "CLAUDE.md",
          content: asset.content,
          mimeType: "text/markdown",
          sourceType: asset.type,
          target: "claude-code",
        };

      case "plugin": {
        const manifest = asset.type === "plugin" && asset.pluginConfig?.manifest
          ? asset.pluginConfig.manifest
          : { version: asset.metadata.version ?? "1.0.0" };
        const json = JSON.stringify({
          name: slugify(asset.metadata.name),
          description: asset.metadata.description,
          ...manifest,
        }, null, 2);
        return {
          filename: "plugin.json",
          content: json,
          mimeType: "application/json",
          sourceType: asset.type,
          target: "claude-code",
        };
      }

      case "mcp_config":
        return {
          filename: ".mcp.json",
          content: asset.content,
          mimeType: "application/json",
          sourceType: asset.type,
          target: "claude-code",
        };

      case "hook":
        return {
          filename: "hooks.json",
          content: asset.content,
          mimeType: "application/json",
          sourceType: asset.type,
          target: "claude-code",
        };

      case "settings_bundle":
        return {
          filename: "settings.json",
          content: asset.content,
          mimeType: "application/json",
          sourceType: asset.type,
          target: "claude-code",
        };

      default: {
        const _exhaustive: never = asset;
        throw new Error(`Unsupported asset type for Claude Code: ${(_exhaustive as AssetDocument).type}`);
      }
    }
  },
};

registerExporter(claudeCodeExporter);
