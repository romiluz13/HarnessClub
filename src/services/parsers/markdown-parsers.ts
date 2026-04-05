/**
 * Markdown-based parsers — SKILL.md, agents/*.md, CLAUDE.md, AGENTS.md, copilot-instructions.md
 *
 * These handle agent config files that use markdown with optional YAML frontmatter.
 * Each parser has a detect() that matches filenames and a parse() that extracts metadata.
 */

import type { ParserPlugin, ParsedAsset } from "./types";
import { registerParser } from "./registry";
import {
  extractFrontmatter,
  extractFirstHeading,
  extractFirstParagraph,
  inferTags,
  nameFromFilename,
} from "./helpers";

// ─── 1. SKILL.md Parser ─────────────────────────────────────

const skillMdParser: ParserPlugin = {
  id: "skill-md",
  name: "SKILL.md (Claude Code Skills)",
  formats: ["skill.md"],
  sourceTools: ["claude-code"],

  detect(filename: string, content: string): number {
    const lower = filename.toLowerCase();
    if (lower === "skill.md" || lower.endsWith("/skill.md")) return 95;
    // YAML frontmatter with "description:" is a strong signal
    if (lower.endsWith(".md") && content.startsWith("---") && /^description:/m.test(content)) return 40;
    return 0;
  },

  parse(filename: string, content: string): ParsedAsset {
    const fm = extractFrontmatter(content);
    const name = fm?.frontmatter.name || extractFirstHeading(content) || nameFromFilename(filename);
    const description = fm?.frontmatter.description || extractFirstParagraph(content);
    const tags = inferTags(content, fm?.frontmatter.tags);

    return {
      format: "skill.md",
      assetType: "skill",
      metadata: {
        name,
        description,
        author: fm?.frontmatter.author,
        version: fm?.frontmatter.version,
        license: fm?.frontmatter.license,
      },
      content,
      tags,
      sourceTool: "claude-code",
    };
  },
};

// ─── 2. Agent .md Parser ────────────────────────────────────

const agentMdParser: ParserPlugin = {
  id: "agent-md",
  name: "agents/*.md (Claude Code Agents)",
  formats: ["agent.md"],
  sourceTools: ["claude-code"],

  detect(filename: string): number {
    const lower = filename.toLowerCase();
    if (/agents?\/[^/]+\.md$/i.test(lower)) return 90;
    if (lower.includes("agent") && lower.endsWith(".md")) return 60;
    return 0;
  },

  parse(filename: string, content: string): ParsedAsset {
    const fm = extractFrontmatter(content);
    const name = fm?.frontmatter.name || extractFirstHeading(content) || nameFromFilename(filename);
    const description = fm?.frontmatter.description || extractFirstParagraph(content);
    const tags = inferTags(content, fm?.frontmatter.tags);

    // Try to extract agent config from frontmatter
    const agentConfig: Record<string, unknown> = {};
    if (fm?.frontmatter.model) agentConfig.model = fm.frontmatter.model;
    if (fm?.frontmatter.tools) {
      agentConfig.tools = fm.frontmatter.tools.replace(/[\[\]]/g, "").split(",").map((t: string) => t.trim());
    }

    return {
      format: "agent.md",
      assetType: "agent",
      metadata: { name, description, author: fm?.frontmatter.author, version: fm?.frontmatter.version },
      content,
      tags: [...tags, "agent"],
      typeConfig: Object.keys(agentConfig).length > 0 ? { agentConfig } : undefined,
      sourceTool: "claude-code",
    };
  },
};

// ─── 3. CLAUDE.md Parser ────────────────────────────────────

const claudeMdParser: ParserPlugin = {
  id: "claude-md",
  name: "CLAUDE.md (Project Rules)",
  formats: ["claude.md"],
  sourceTools: ["claude-code"],

  detect(filename: string): number {
    const lower = filename.toLowerCase();
    if (lower === "claude.md" || lower.endsWith("/claude.md")) return 95;
    if (lower === ".claude/settings.md") return 80;
    return 0;
  },

  parse(filename: string, content: string): ParsedAsset {
    const name = extractFirstHeading(content) || "Project Rules (CLAUDE.md)";
    const description = extractFirstParagraph(content);
    const tags = inferTags(content);

    return {
      format: "claude.md",
      assetType: "rule",
      metadata: { name, description },
      content,
      tags: [...tags, "claude-code", "project-rules"],
      typeConfig: { ruleConfig: { scope: "project", targetTool: "claude-code" } },
      sourceTool: "claude-code",
    };
  },
};

// ─── 4. AGENTS.md Parser (Codex/OpenAI) ─────────────────────

const agentsMdParser: ParserPlugin = {
  id: "agents-md",
  name: "AGENTS.md (Codex/OpenAI)",
  formats: ["agents.md"],
  sourceTools: ["codex", "openai"],

  detect(filename: string): number {
    const lower = filename.toLowerCase();
    if (lower === "agents.md" || lower.endsWith("/agents.md")) return 90;
    return 0;
  },

  parse(filename: string, content: string): ParsedAsset {
    const name = extractFirstHeading(content) || "Agent Instructions (AGENTS.md)";
    const description = extractFirstParagraph(content);
    const tags = inferTags(content);

    return {
      format: "agents.md",
      assetType: "rule",
      metadata: { name, description },
      content,
      tags: [...tags, "codex", "project-rules"],
      typeConfig: { ruleConfig: { scope: "project", targetTool: "codex" } },
      sourceTool: "codex",
    };
  },
};

// ─── 5. copilot-instructions.md Parser ──────────────────────

const copilotInstructionsParser: ParserPlugin = {
  id: "copilot-instructions",
  name: "copilot-instructions.md (GitHub Copilot)",
  formats: ["copilot-instructions"],
  sourceTools: ["github-copilot"],

  detect(filename: string): number {
    const lower = filename.toLowerCase();
    if (lower.includes("copilot-instructions") || lower.includes("copilot_instructions")) return 95;
    if (lower === ".github/copilot-instructions.md") return 99;
    return 0;
  },

  parse(filename: string, content: string): ParsedAsset {
    const name = extractFirstHeading(content) || "Copilot Instructions";
    const description = extractFirstParagraph(content);
    const tags = inferTags(content);

    return {
      format: "copilot-instructions",
      assetType: "rule",
      metadata: { name, description },
      content,
      tags: [...tags, "github-copilot", "project-rules"],
      typeConfig: { ruleConfig: { scope: "project", targetTool: "github-copilot" } },
      sourceTool: "github-copilot",
    };
  },
};

// ─── Register All Markdown Parsers ──────────────────────────

registerParser(skillMdParser);
registerParser(agentMdParser);
registerParser(claudeMdParser);
registerParser(agentsMdParser);
registerParser(copilotInstructionsParser);
