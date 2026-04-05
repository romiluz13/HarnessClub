/**
 * Copilot Tool Executor — dispatches tool calls to platform services.
 *
 * Each tool maps to existing service functions (search, CRUD, export, etc.).
 * The copilot doesn't access the database directly — it goes through services.
 */

import { ObjectId, type Db } from "mongodb";
import type { CopilotToolName, ToolParams, ToolResults, CopilotContext } from "./types";
import type { AssetDocument } from "@/types/asset";
import { exportAsset } from "@/services/exporters";
import { getDepartmentTemplate, getDepartmentTemplateSummaries } from "@/services/department-templates";
import type { DepartmentType } from "@/types/organization";

/**
 * Execute a copilot tool call.
 */
export async function executeTool<T extends CopilotToolName>(
  db: Db,
  toolName: T,
  params: ToolParams[T],
  context: CopilotContext
): Promise<ToolResults[T]> {
  switch (toolName) {
    case "search_assets":
      return executeSearchAssets(db, params as ToolParams["search_assets"], context) as Promise<ToolResults[T]>;
    case "create_asset":
      return executeCreateAsset(db, params as ToolParams["create_asset"], context) as Promise<ToolResults[T]>;
    case "recommend_harness":
      return executeRecommendHarness(params as ToolParams["recommend_harness"]) as ToolResults[T];
    case "export_asset":
      return executeExportAsset(db, params as ToolParams["export_asset"]) as Promise<ToolResults[T]>;
    case "explain_asset":
      return executeExplainAsset(db, params as ToolParams["explain_asset"]) as Promise<ToolResults[T]>;
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

async function executeSearchAssets(
  db: Db,
  params: ToolParams["search_assets"],
  context: CopilotContext
): Promise<ToolResults["search_assets"]> {
  const filter: Record<string, unknown> = {};
  if (context.teamId) filter.teamId = new ObjectId(context.teamId);
  if (params.type) filter.type = params.type;

  // Text search using searchText field
  const searchRegex = new RegExp(params.query.split(/\s+/).join("|"), "i");
  filter.searchText = { $regex: searchRegex };

  const assets = await db.collection<AssetDocument>("assets")
    .find(filter)
    .project({ type: 1, "metadata.name": 1, "metadata.description": 1 })
    .limit(params.limit ?? 10)
    .toArray();

  return {
    assets: assets.map((a) => ({
      id: a._id.toHexString(),
      name: a.metadata.name,
      type: a.type,
      description: a.metadata.description,
    })),
  };
}

async function executeCreateAsset(
  db: Db,
  params: ToolParams["create_asset"],
  context: CopilotContext
): Promise<ToolResults["create_asset"]> {
  const { createAsset } = await import("@/services/asset-service");
  const teamId = context.teamId ? new ObjectId(context.teamId) : new ObjectId();

  const result = await createAsset(db, {
    type: params.type,
    teamId,
    metadata: { name: params.name, description: params.description },
    content: params.content,
    tags: params.tags ?? [],
    createdBy: new ObjectId(), // Will be set from auth context
  });

  const assetId = result.success && "assetId" in result ? (result as { assetId: ObjectId }).assetId : undefined;
  return {
    assetId: assetId?.toHexString() ?? "",
    name: params.name,
    type: params.type,
  };
}

function executeRecommendHarness(
  params: ToolParams["recommend_harness"]
): ToolResults["recommend_harness"] {
  // Simple keyword matching to recommend department template
  const desc = params.departmentDescription.toLowerCase();
  const summaries = getDepartmentTemplateSummaries();

  // Score each template against the description
  let bestMatch = summaries[0];
  let bestScore = 0;

  for (const s of summaries) {
    const keywords = [s.displayName.toLowerCase(), s.type.replace(/_/g, " ")];
    let score = 0;
    for (const kw of keywords) {
      if (desc.includes(kw)) score += 10;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = s;
    }
  }

  const template = getDepartmentTemplate(bestMatch.type as DepartmentType);
  return {
    templateType: bestMatch.type,
    displayName: bestMatch.displayName,
    assets: template?.assets.map((a) => ({ name: a.name, type: a.type })) ?? [],
  };
}

async function executeExportAsset(
  db: Db,
  params: ToolParams["export_asset"]
): Promise<ToolResults["export_asset"]> {
  const asset = await db.collection<AssetDocument>("assets").findOne({ _id: new ObjectId(params.assetId) });
  if (!asset) throw new Error("Asset not found");

  const exported = exportAsset(asset, params.target);
  return { filename: exported.filename, content: exported.content, target: exported.target };
}

async function executeExplainAsset(
  db: Db,
  params: ToolParams["explain_asset"]
): Promise<ToolResults["explain_asset"]> {
  const asset = await db.collection<AssetDocument>("assets").findOne({ _id: new ObjectId(params.assetId) });
  if (!asset) throw new Error("Asset not found");

  const explanation = [
    `**${asset.metadata.name}** is a ${asset.type} asset.`,
    `Description: ${asset.metadata.description}`,
    asset.tags.length > 0 ? `Tags: ${asset.tags.join(", ")}` : "",
    `Published: ${asset.isPublished ? "Yes" : "No"}`,
    `Content length: ${asset.content.length} characters`,
  ].filter(Boolean).join("\n");

  return { explanation, type: asset.type };
}
