/**
 * Copilot Types — tool definitions, context, conversation models.
 *
 * Architecture: The copilot is an LLM-powered assistant with tool-use.
 * It receives user context (current page, team, asset) and can call
 * platform tools (search, create, export, etc.) to complete tasks.
 *
 * Per typescript-advanced-types: discriminated unions for tool calls.
 */

import type { ObjectId } from "mongodb";
import type { AssetType } from "@/types/asset";
import type { ExportTarget } from "@/services/exporters/types";

/** Copilot tool names */
export const COPILOT_TOOLS = [
  "search_assets",
  "create_asset",
  "recommend_harness",
  "import_from_repo",
  "export_asset",
  "explain_asset",
] as const;

export type CopilotToolName = (typeof COPILOT_TOOLS)[number];

/** Tool parameter schemas */
export interface ToolParams {
  search_assets: { query: string; type?: AssetType; limit?: number };
  create_asset: { type: AssetType; name: string; description: string; content: string; tags?: string[] };
  recommend_harness: { departmentDescription: string; teamSize?: number };
  import_from_repo: { repoUrl: string; path?: string };
  export_asset: { assetId: string; target: ExportTarget };
  explain_asset: { assetId: string };
}

/** Tool result types */
export interface ToolResults {
  search_assets: { assets: Array<{ id: string; name: string; type: string; description: string; score?: number }> };
  create_asset: { assetId: string; name: string; type: string };
  recommend_harness: { templateType: string; displayName: string; assets: Array<{ name: string; type: string }> };
  import_from_repo: { imported: number; assetIds: string[] };
  export_asset: { filename: string; content: string; target: string };
  explain_asset: { explanation: string; type: string; trustGrade?: string };
}

/** Ambient context — what the user is currently looking at */
export interface CopilotContext {
  /** Current page/route */
  currentPage: string;
  /** Active team */
  teamId?: string;
  teamName?: string;
  /** Active department */
  departmentId?: string;
  departmentName?: string;
  /** Currently viewed asset */
  assetId?: string;
  assetType?: AssetType;
  assetName?: string;
  /** User role in current team */
  userRole?: string;
}

/** Single message in a copilot conversation */
export interface CopilotMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  /** Tool call info (if role === "assistant" and calling a tool) */
  toolCall?: {
    name: CopilotToolName;
    params: Record<string, unknown>;
  };
  /** Tool result (if role === "tool") */
  toolResult?: {
    name: CopilotToolName;
    result: Record<string, unknown>;
  };
  timestamp: Date;
}

/** Copilot chat request */
export interface CopilotChatRequest {
  message: string;
  context: CopilotContext;
  /** Previous messages for multi-turn context */
  history?: CopilotMessage[];
  /** Resume an existing conversation */
  conversationId?: string;
}

/** Copilot chat response */
export interface CopilotChatResponse {
  message: string;
  /** Tools that were invoked */
  toolsUsed: CopilotToolName[];
  /** Suggested follow-up actions */
  suggestions?: string[];
}
