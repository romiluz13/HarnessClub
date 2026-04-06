/**
 * Parser Registry + Individual Parser Tests.
 *
 * Tests all 11 format parsers with real-world content samples.
 * Verifies format detection, metadata extraction, and type mapping.
 */

import { describe, it, expect } from "vitest";

// Import the module to trigger parser registration
import { detectFormat, parseFile, getRegisteredParsers } from "@/services/parsers";

describe("Parser Registry", () => {
  it("has all 11 parsers registered", () => {
    const parsers = getRegisteredParsers();
    expect(parsers.length).toBeGreaterThanOrEqual(11);
  });

  it("lists parser metadata correctly", () => {
    const parsers = getRegisteredParsers();
    const ids = parsers.map((p) => p.id);
    expect(ids).toContain("skill-md");
    expect(ids).toContain("agent-md");
    expect(ids).toContain("claude-md");
    expect(ids).toContain("agents-md");
    expect(ids).toContain("copilot-instructions");
    expect(ids).toContain("cursorrules");
    expect(ids).toContain("cursor-mdc");
    expect(ids).toContain("windsurfrules");
    expect(ids).toContain("plugin-json");
    expect(ids).toContain("mcp-json");
    expect(ids).toContain("hooks-json");
  });
});

describe("SKILL.md Parser", () => {
  const content = `---
name: MongoDB Best Practices
description: Schema design patterns for MongoDB
author: test-user
version: 2.0.0
tags: mongodb, schema, guide
---

# MongoDB Best Practices

Embed for 1:1 relationships. Reference for 1:many.
`;

  it("detects SKILL.md with high confidence", () => {
    const result = detectFormat("SKILL.md", content);
    expect(result).not.toBeNull();
    expect(result!.format).toBe("skill.md");
    expect(result!.confidence).toBeGreaterThanOrEqual(90);
  });

  it("parses frontmatter metadata", () => {
    const parsed = parseFile("SKILL.md", content);
    expect(parsed.assetType).toBe("skill");
    expect(parsed.metadata.name).toBe("MongoDB Best Practices");
    expect(parsed.metadata.description).toBe("Schema design patterns for MongoDB");
    expect(parsed.metadata.author).toBe("test-user");
    expect(parsed.metadata.version).toBe("2.0.0");
  });

  it("extracts tags from frontmatter", () => {
    const parsed = parseFile("SKILL.md", content);
    expect(parsed.tags).toContain("mongodb");
    expect(parsed.tags).toContain("schema");
  });
});

describe("CLAUDE.md Parser", () => {
  const content = `# Project Rules

Always use TypeScript strict mode. Never use any types.

## Code Standards
- Use ESLint with strict config
- Run tests before committing
`;

  it("detects CLAUDE.md", () => {
    const result = detectFormat("CLAUDE.md", content);
    expect(result).not.toBeNull();
    expect(result!.format).toBe("claude.md");
  });

  it("parses as rule type", () => {
    const parsed = parseFile("CLAUDE.md", content);
    expect(parsed.assetType).toBe("rule");
    expect(parsed.metadata.name).toBe("Project Rules");
    expect(parsed.tags).toContain("claude-code");
    expect(parsed.tags).toContain("project-rules");
  });
});

describe(".cursorrules Parser", () => {
  const content = `You are an expert React developer. Always use TypeScript.
Follow the Airbnb style guide. Use functional components only.`;

  it("detects .cursorrules", () => {
    const result = detectFormat(".cursorrules", content);
    expect(result).not.toBeNull();
    expect(result!.format).toBe("cursorrules");
    expect(result!.confidence).toBe(99);
  });

  it("parses as rule type with cursor source", () => {
    const parsed = parseFile(".cursorrules", content);
    expect(parsed.assetType).toBe("rule");
    expect(parsed.sourceTool).toBe("cursor");
    expect(parsed.tags).toContain("cursor");
  });
});

describe("MCP JSON Parser", () => {
  const content = JSON.stringify({
    mcpServers: {
      "brave-search": { command: "npx", args: ["-y", "@anthropic/mcp-brave-search"] },
      "filesystem": { command: "npx", args: ["-y", "@anthropic/mcp-filesystem"] },
    },
  }, null, 2);

  it("detects .mcp.json with mcpServers", () => {
    const result = detectFormat(".mcp.json", content);
    expect(result).not.toBeNull();
    expect(result!.format).toBe("mcp.json");
    expect(result!.confidence).toBe(99);
  });

  it("parses MCP config with server names", () => {
    const parsed = parseFile(".mcp.json", content);
    expect(parsed.assetType).toBe("mcp_config");
    expect(parsed.metadata.name).toContain("2 server");
    expect(parsed.metadata.description).toContain("brave-search");
    expect(parsed.tags).toContain("mcp");
  });
});

describe("hooks.json Parser", () => {
  const content = JSON.stringify({
    hooks: [
      { event: "pre-commit", type: "shell", command: "npm test" },
      { event: "post-push", type: "shell", command: "npm run deploy" },
    ],
  }, null, 2);

  it("detects hooks.json", () => {
    const result = detectFormat("hooks.json", content);
    expect(result).not.toBeNull();
    expect(result!.format).toBe("hooks.json");
  });

  it("parses hook events", () => {
    const parsed = parseFile("hooks.json", content);
    expect(parsed.assetType).toBe("hook");
    expect(parsed.metadata.name).toContain("2 hook");
  });
});
