/**
 * Copilot Context Builder — constructs the system prompt with ambient context.
 *
 * The system prompt includes:
 * 1. Platform knowledge (what AgentConfig is, what tools are available)
 * 2. User context (team, department, current page)
 * 3. Available tools description
 * 4. Behavioral guidelines
 */

import type { CopilotContext, CopilotToolName, COPILOT_TOOLS } from "./types";

/** Tool descriptions for the system prompt */
const TOOL_DESCRIPTIONS: Record<CopilotToolName, string> = {
  search_assets: "Search for assets (skills, rules, agents, plugins, configs) in the team's library. Use when the user asks to find, discover, or browse assets.",
  create_asset: "Create a new asset with the specified type, name, description, and content. Use when the user wants to write or generate a new skill, rule, or agent definition.",
  recommend_harness: "Recommend a department harness template based on team description. Use when the user asks what config to set up for their team or department.",
  import_from_repo: "Import assets from a GitHub repository. Use when the user provides a repo URL or wants to bring in external configs.",
  export_asset: "Export an asset to a specific tool format (claude-code, cursor, copilot, windsurf, codex). Use when the user wants to use an asset in their preferred tool.",
  explain_asset: "Explain what an asset does, its purpose, and its trust level. Use when the user asks about an asset or wants to understand it.",
};

/**
 * Build the system prompt for the copilot.
 */
export function buildSystemPrompt(context: CopilotContext): string {
  const parts: string[] = [];

  // Platform identity
  parts.push(`You are the AgentConfig Copilot — an AI assistant embedded in the AgentConfig platform.`);
  parts.push(`AgentConfig is an enterprise platform for managing AI coding agent configurations (skills, rules, agents, plugins, MCP configs, hooks, settings).`);
  parts.push(`You help users discover, create, import, export, and understand agent configurations.`);
  parts.push("");

  // Ambient context
  parts.push("## Current Context");
  if (context.teamName) parts.push(`- Team: ${context.teamName}`);
  if (context.departmentName) parts.push(`- Department: ${context.departmentName}`);
  if (context.assetName) parts.push(`- Viewing asset: ${context.assetName} (${context.assetType})`);
  if (context.userRole) parts.push(`- Your role: ${context.userRole}`);
  parts.push(`- Page: ${context.currentPage}`);
  parts.push("");

  // Available tools
  parts.push("## Available Tools");
  for (const [name, desc] of Object.entries(TOOL_DESCRIPTIONS)) {
    parts.push(`- **${name}**: ${desc}`);
  }
  parts.push("");

  // Behavioral guidelines
  parts.push("## Guidelines");
  parts.push("- Be concise and actionable. Don't explain what you're going to do — just do it.");
  parts.push("- Use tools proactively. If the user asks to find something, call search_assets.");
  parts.push("- When creating assets, follow the team's existing conventions (look at existing assets first).");
  parts.push("- For security-sensitive configs (MCP, hooks), always mention security implications.");
  parts.push("- Respect RBAC — don't suggest actions the user's role can't perform.");

  return parts.join("\n");
}

/**
 * Generate contextual suggestions based on current page/state.
 */
export function generateSuggestions(context: CopilotContext): string[] {
  const suggestions: string[] = [];

  switch (true) {
    case context.currentPage.includes("/assets") && !context.assetId:
      suggestions.push("Search for a specific type of asset");
      suggestions.push("Create a new skill or rule");
      suggestions.push("Import configs from GitHub");
      break;

    case !!context.assetId:
      suggestions.push(`Explain this ${context.assetType}`);
      suggestions.push("Export to Cursor or Copilot format");
      suggestions.push("Find similar assets");
      break;

    case context.currentPage.includes("/departments"):
      suggestions.push("Recommend a department harness template");
      suggestions.push("Compare department configs");
      break;

    case context.currentPage.includes("/marketplace"):
      suggestions.push("Search the marketplace");
      suggestions.push("Import a popular skill");
      break;

    default:
      suggestions.push("What can you help me with?");
      suggestions.push("Set up configs for my team");
      suggestions.push("Find popular skills");
      break;
  }

  return suggestions;
}
