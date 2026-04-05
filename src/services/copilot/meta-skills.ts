/**
 * Copilot Meta-Skills — higher-order assistants that compose tools.
 *
 * Meta-skills are multi-step workflows:
 * 1. Skill Authoring Assistant — helps write a new skill from scratch
 * 2. Agent Definition Helper — structures an agent definition
 * 3. Department Setup Wizard — recommends + provisions a department harness
 * 4. Migration Helper — converts between tool formats
 */

import type { AssetType } from "@/types/asset";
import type { DepartmentType } from "@/types/organization";
import { getDepartmentTemplate, getDepartmentTemplateSummaries } from "@/services/department-templates";

/** Step-by-step wizard state for multi-turn meta-skills */
export interface WizardState {
  skill: string;
  step: number;
  totalSteps: number;
  data: Record<string, unknown>;
  complete: boolean;
}

// ─── Skill Authoring Assistant ──────────────────────────────

/** Generate a skill template from a description */
export function generateSkillTemplate(input: {
  name: string;
  description: string;
  triggers: string[];
  guidelines: string[];
}): string {
  const lines: string[] = [];
  lines.push(`# ${input.name}`);
  lines.push("");
  lines.push(input.description);
  lines.push("");
  lines.push("## When to Use This Skill");
  lines.push("");
  lines.push("Use this skill when the user:");
  lines.push("");
  for (const trigger of input.triggers) {
    lines.push(`- ${trigger}`);
  }
  lines.push("");
  lines.push("## Guidelines");
  lines.push("");
  for (const guideline of input.guidelines) {
    lines.push(`### ${guideline}`);
    lines.push("");
    lines.push("<!-- Add detailed guidance here -->");
    lines.push("");
  }
  return lines.join("\n");
}

// ─── Agent Definition Helper ────────────────────────────────

/** Generate an agent definition from structured input */
export function generateAgentDefinition(input: {
  name: string;
  role: string;
  responsibilities: string[];
  tools: string[];
  constraints: string[];
}): string {
  const lines: string[] = [];
  lines.push(`# ${input.name}`);
  lines.push("");
  lines.push(`## Role`);
  lines.push(input.role);
  lines.push("");
  lines.push("## Responsibilities");
  for (const r of input.responsibilities) {
    lines.push(`- ${r}`);
  }
  lines.push("");
  if (input.tools.length > 0) {
    lines.push("## Tools");
    for (const t of input.tools) {
      lines.push(`- ${t}`);
    }
    lines.push("");
  }
  lines.push("## Constraints");
  for (const c of input.constraints) {
    lines.push(`- ${c}`);
  }
  return lines.join("\n");
}

// ─── Department Setup Wizard ────────────────────────────────

/** Get all available department templates with their asset previews */
export function getDepartmentOptions(): Array<{
  type: DepartmentType;
  name: string;
  description: string;
  assetPreview: string[];
}> {
  const summaries = getDepartmentTemplateSummaries();
  return summaries.map((s) => {
    const template = getDepartmentTemplate(s.type as DepartmentType);
    return {
      type: s.type as DepartmentType,
      name: s.displayName,
      description: s.description,
      assetPreview: template?.assets.map((a) => a.name) ?? [],
    };
  });
}

// ─── Migration Helper ──────────────────────────────────────

/** Asset type compatibility matrix between tools */
export const TOOL_COMPATIBILITY: Record<string, AssetType[]> = {
  "claude-code": ["skill", "agent", "rule", "plugin", "mcp_config", "hook", "settings_bundle"],
  "cursor": ["skill", "agent", "rule", "mcp_config"],
  "copilot": ["skill", "agent", "rule"],
  "windsurf": ["skill", "agent", "rule"],
  "codex": ["skill", "agent", "rule"],
};

/** Check what asset types need conversion when migrating between tools */
export function getMigrationPlan(fromTool: string, toTool: string): {
  compatible: AssetType[];
  incompatible: AssetType[];
  notes: string[];
} {
  const fromTypes = TOOL_COMPATIBILITY[fromTool] ?? [];
  const toTypes = TOOL_COMPATIBILITY[toTool] ?? [];
  const compatible = fromTypes.filter((t) => toTypes.includes(t));
  const incompatible = fromTypes.filter((t) => !toTypes.includes(t));

  const notes: string[] = [];
  if (incompatible.includes("mcp_config")) notes.push("MCP configs are only supported by Claude Code and Cursor");
  if (incompatible.includes("hook")) notes.push("Hooks are only supported by Claude Code");
  if (incompatible.includes("plugin")) notes.push("Plugin bundles are only supported by Claude Code");

  return { compatible, incompatible, notes };
}
