/**
 * Phase 14 Tests — Copilot Agent.
 *
 * Tests: context builder, intent detection, meta-skills, migration helper.
 */

import { describe, it, expect } from "vitest";
import { buildSystemPrompt, generateSuggestions } from "@/services/copilot/context-builder";
import {
  generateSkillTemplate,
  generateAgentDefinition,
  getDepartmentOptions,
  getMigrationPlan,
  TOOL_COMPATIBILITY,
} from "@/services/copilot/meta-skills";
import type { CopilotContext } from "@/services/copilot/types";
import { COPILOT_TOOLS } from "@/services/copilot/types";

describe("Copilot Context Builder", () => {
  const baseContext: CopilotContext = {
    currentPage: "/dashboard/assets",
    teamId: "abc123",
    teamName: "Frontend Team",
    userRole: "admin",
  };

  it("builds system prompt with platform identity", () => {
    const prompt = buildSystemPrompt(baseContext);
    expect(prompt).toContain("AgentConfig Copilot");
    expect(prompt).toContain("enterprise platform");
  });

  it("includes ambient context in prompt", () => {
    const prompt = buildSystemPrompt(baseContext);
    expect(prompt).toContain("Frontend Team");
    expect(prompt).toContain("admin");
  });

  it("includes all tool descriptions", () => {
    const prompt = buildSystemPrompt(baseContext);
    for (const tool of COPILOT_TOOLS) {
      expect(prompt).toContain(tool);
    }
  });

  it("generates page-aware suggestions for asset page", () => {
    const suggestions = generateSuggestions({ ...baseContext, currentPage: "/dashboard/assets" });
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((s) => s.toLowerCase().includes("search") || s.toLowerCase().includes("create"))).toBe(true);
  });

  it("generates suggestions for asset detail page", () => {
    const suggestions = generateSuggestions({
      ...baseContext,
      currentPage: "/dashboard/assets/123",
      assetId: "123",
      assetType: "skill",
    });
    expect(suggestions.some((s) => s.toLowerCase().includes("explain") || s.toLowerCase().includes("export"))).toBe(true);
  });

  it("generates suggestions for departments page", () => {
    const suggestions = generateSuggestions({ ...baseContext, currentPage: "/dashboard/departments" });
    expect(suggestions.some((s) => s.toLowerCase().includes("harness") || s.toLowerCase().includes("recommend"))).toBe(true);
  });
});

describe("Skill Authoring Assistant", () => {
  it("generates valid skill template", () => {
    const template = generateSkillTemplate({
      name: "Code Review Helper",
      description: "Helps with code review tasks",
      triggers: ["Asks for code review", "Submits a PR"],
      guidelines: ["Clarity", "Security"],
    });
    expect(template).toContain("# Code Review Helper");
    expect(template).toContain("## When to Use This Skill");
    expect(template).toContain("Asks for code review");
    expect(template).toContain("### Clarity");
  });
});

describe("Agent Definition Helper", () => {
  it("generates valid agent definition", () => {
    const def = generateAgentDefinition({
      name: "Security Reviewer",
      role: "Reviews code for security vulnerabilities",
      responsibilities: ["Scan for secrets", "Check dependencies"],
      tools: ["security_scanner", "dependency_checker"],
      constraints: ["Never modify code directly"],
    });
    expect(def).toContain("# Security Reviewer");
    expect(def).toContain("## Role");
    expect(def).toContain("## Tools");
    expect(def).toContain("## Constraints");
    expect(def).toContain("security_scanner");
  });
});

describe("Department Setup Wizard", () => {
  it("returns all department options", () => {
    const options = getDepartmentOptions();
    expect(options.length).toBe(8);
    for (const opt of options) {
      expect(opt.name).toBeTruthy();
      expect(opt.description).toBeTruthy();
    }
  });

  it("engineering_fe has asset previews", () => {
    const options = getDepartmentOptions();
    const fe = options.find((o) => o.type === "engineering_fe");
    expect(fe).toBeDefined();
    expect(fe!.assetPreview.length).toBeGreaterThanOrEqual(2);
  });
});

describe("Migration Helper", () => {
  it("identifies compatible types between claude-code and cursor", () => {
    const plan = getMigrationPlan("claude-code", "cursor");
    expect(plan.compatible).toContain("skill");
    expect(plan.compatible).toContain("rule");
    expect(plan.compatible).toContain("mcp_config");
    expect(plan.incompatible).toContain("hook");
    expect(plan.incompatible).toContain("plugin");
  });

  it("shows all types compatible for cursor to copilot", () => {
    const plan = getMigrationPlan("cursor", "copilot");
    expect(plan.compatible).toContain("skill");
    expect(plan.incompatible).toContain("mcp_config");
  });

  it("generates migration notes for incompatible types", () => {
    const plan = getMigrationPlan("claude-code", "copilot");
    expect(plan.notes.length).toBeGreaterThan(0);
    expect(plan.notes.some((n) => n.includes("MCP") || n.includes("Hook"))).toBe(true);
  });

  it("tool compatibility covers all 5 tools", () => {
    expect(Object.keys(TOOL_COMPATIBILITY)).toHaveLength(5);
    expect(TOOL_COMPATIBILITY["claude-code"]).toHaveLength(7);
  });
});
