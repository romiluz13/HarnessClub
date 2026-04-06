/**
 * Pi Agent Tools — platform tools exposed to the LLM agent.
 *
 * Each tool wraps an existing service function as a Pi AgentTool.
 * Uses @sinclair/typebox for parameter schemas (required by Pi).
 *
 * Tools: search_assets, create_asset, export_asset, explain_asset,
 *        recommend_harness, scan_asset
 */

import { Type } from "@sinclair/typebox";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { ObjectId, type Db } from "mongodb";
import type { AssetDocument } from "@/types/asset";
import type { CopilotContext } from "./types";
import { escapeRegex } from "@/lib/utils";

// ─── Shared helper ──────────────────────────────────────────

type TextResult = AgentToolResult<undefined>;

function textResult(text: string): TextResult {
  return { content: [{ type: "text", text }], details: undefined };
}

// ─── search_assets ──────────────────────────────────────────

const searchSchema = Type.Object({
  query: Type.String({ description: "Search query for assets" }),
  type: Type.Optional(Type.String({ description: "Filter by asset type (skill, agent, rule, plugin, mcp_config, hook, settings_bundle)" })),
  limit: Type.Optional(Type.Number({ description: "Max results to return", default: 10 })),
});

export function createSearchTool(db: Db, context: CopilotContext): AgentTool<typeof searchSchema, undefined> {
  return {
    name: "search_assets",
    label: "Search Assets",
    description: "Search for assets (skills, rules, agents, plugins, configs) in the team's library.",
    parameters: searchSchema,
    execute: async (_id, args) => {
      const filter: Record<string, unknown> = {};
      if (context.teamId) filter.teamId = new ObjectId(context.teamId);
      if (args.type) filter.type = args.type;
      const searchRegex = new RegExp(args.query.split(/\s+/).map(escapeRegex).join("|"), "i");
      filter.searchText = { $regex: searchRegex };

      const assets = await db.collection<AssetDocument>("assets")
        .find(filter)
        .project({ type: 1, "metadata.name": 1, "metadata.description": 1 })
        .limit(args.limit ?? 10)
        .toArray();

      if (assets.length === 0) return textResult("No assets found matching the query.");
      const lines = assets.map((a) => `- **${a.metadata?.name}** (${a.type}): ${a.metadata?.description ?? "No description"}`);
      return textResult(`Found ${assets.length} asset(s):\n\n${lines.join("\n")}`);
    },
  };
}

// ─── explain_asset ──────────────────────────────────────────

const explainSchema = Type.Object({
  assetId: Type.String({ description: "The asset ID to explain" }),
});

export function createExplainTool(db: Db): AgentTool<typeof explainSchema, undefined> {
  return {
    name: "explain_asset",
    label: "Explain Asset",
    description: "Explain what an asset does, its purpose, type, tags, and trust level.",
    parameters: explainSchema,
    execute: async (_id, args) => {
      const asset = await db.collection<AssetDocument>("assets").findOne({ _id: new ObjectId(args.assetId) });
      if (!asset) throw new Error("Asset not found");
      const explanation = [
        `**${asset.metadata.name}** is a ${asset.type} asset.`,
        `Description: ${asset.metadata.description}`,
        asset.tags.length > 0 ? `Tags: ${asset.tags.join(", ")}` : "",
        `Published: ${asset.isPublished ? "Yes" : "No"}`,
        `Content length: ${asset.content.length} characters`,
      ].filter(Boolean).join("\n");
      return textResult(explanation);
    },
  };
}

// ─── export_asset ───────────────────────────────────────────

const exportSchema = Type.Object({
  assetId: Type.String({ description: "The asset ID to export" }),
  target: Type.String({ description: "Export format: claude-code, cursor, copilot, windsurf, codex" }),
});

export function createExportTool(db: Db): AgentTool<typeof exportSchema, undefined> {
  return {
    name: "export_asset",
    label: "Export Asset",
    description: "Export an asset to a specific tool format (claude-code, cursor, copilot, windsurf, codex).",
    parameters: exportSchema,
    execute: async (_id, args) => {
      const { exportAsset } = await import("@/services/exporters");
      const asset = await db.collection<AssetDocument>("assets").findOne({ _id: new ObjectId(args.assetId) });
      if (!asset) throw new Error("Asset not found");
      const exported = exportAsset(asset, args.target as Parameters<typeof exportAsset>[1]);
      return textResult(`Exported to **${exported.target}** format:\n- Filename: \`${exported.filename}\`\n- Content length: ${exported.content.length} chars`);
    },
  };
}

// ─── recommend_harness ──────────────────────────────────────

const recommendSchema = Type.Object({
  departmentDescription: Type.String({ description: "Description of the department or team to recommend a harness for" }),
});

export function createRecommendTool(): AgentTool<typeof recommendSchema, undefined> {
  return {
    name: "recommend_harness",
    label: "Recommend Harness",
    description: "Recommend a department harness template based on a team description.",
    parameters: recommendSchema,
    execute: async (_id, args) => {
      const { getDepartmentTemplateSummaries, getDepartmentTemplate } = await import("@/services/department-templates");
      const summaries = getDepartmentTemplateSummaries();
      const lower = args.departmentDescription.toLowerCase();
      const bestMatch = summaries.find((s) => lower.includes(s.type)) ?? summaries[0];
      const template = getDepartmentTemplate(bestMatch.type as Parameters<typeof getDepartmentTemplate>[0]);
      const assets = template?.assets.map((a: { name: string; type: string }) => a.name) ?? [];
      return textResult(`Recommended: **${bestMatch.displayName}**\n${bestMatch.description}\n\nIncludes ${assets.length} starter asset(s): ${assets.join(", ")}`);
    },
  };
}

// ─── scan_asset ─────────────────────────────────────────────

const scanSchema = Type.Object({
  assetId: Type.String({ description: "The asset ID to security-scan" }),
});

export function createScanTool(db: Db): AgentTool<typeof scanSchema, undefined> {
  return {
    name: "scan_asset",
    label: "Scan Asset",
    description: "Run a security scan on an asset and report findings.",
    parameters: scanSchema,
    execute: async (_id, args) => {
      const { scanAsset } = await import("@/services/type-scanner");
      const asset = await db.collection<AssetDocument>("assets").findOne({ _id: new ObjectId(args.assetId) });
      if (!asset) throw new Error("Asset not found");
      const result = scanAsset(asset.content ?? "", asset.type);
      if (result.safe) return textResult(`✅ Asset is safe. No critical findings. (${result.findings.length} total findings)`);
      const lines = result.findings.map((f) => `- [${f.severity}] ${f.message} (line ${f.line})`);
      return textResult(`⚠️ Security issues found:\n${lines.join("\n")}`);
    },
  };
}
