/**
 * E2E Tests — Phase 21: Live Asset Preview + Rich Rendering
 *
 * Tests: asset renderers, MCP config validation, export preview.
 * Mix of pure function tests and real DB tests.
 */

import { describe, it, expect } from "vitest";
import {
  renderAssetPreview,
  validateMCPConfig,
} from "@/services/asset-renderer";

// ─── Markdown Rendering ───────────────────────────────────

describe("Asset Renderer — Markdown", () => {
  it("renders skill content as markdown", () => {
    const result = renderAssetPreview("# My Skill\n\nDo great things.", "skill", "My Skill");
    expect(result.format).toBe("markdown");
    expect(result.title).toBe("My Skill");
    expect(result.sections.length).toBeGreaterThanOrEqual(1);
    expect(result.sections[0].content).toContain("My Skill");
  });

  it("extracts frontmatter from markdown", () => {
    const content = "---\nname: Test\nversion: 1.0\n---\n\n# Content here";
    const result = renderAssetPreview(content, "skill", "Test");
    const fmSection = result.sections.find((s) => s.label === "Frontmatter");
    expect(fmSection).toBeDefined();
    expect(fmSection!.content).toContain("name: Test");
    expect(fmSection!.language).toBe("yaml");
    expect(fmSection!.collapsible).toBe(true);
  });

  it("renders rule content as markdown", () => {
    const result = renderAssetPreview("# Security Rule\n\nAlways validate.", "rule", "Security Rule");
    expect(result.format).toBe("markdown");
  });

  it("renders agent content as markdown", () => {
    const result = renderAssetPreview("# Agent Config\n\nRun tasks.", "agent", "Agent Config");
    expect(result.format).toBe("markdown");
  });

  it("extracts code blocks from content", () => {
    const content = "# Skill\n\n```typescript\nconst x = 1;\n```\n\nMore text.\n\n```python\nprint('hello')\n```";
    const result = renderAssetPreview(content, "skill", "Code Skill");
    const codeSection = result.sections.find((s) => s.label.startsWith("Code Blocks"));
    expect(codeSection).toBeDefined();
    expect(codeSection!.content).toContain("const x = 1");
    expect(codeSection!.collapsible).toBe(true);
  });
});

// ─── JSON Rendering ───────────────────────────────────────

describe("Asset Renderer — JSON", () => {
  it("renders hook config as JSON", () => {
    const content = JSON.stringify({ name: "pre-commit", events: ["save"] }, null, 2);
    const result = renderAssetPreview(content, "hook", "Pre-commit Hook");
    expect(result.format).toBe("json");
    expect(result.sections.length).toBeGreaterThanOrEqual(1);
  });

  it("renders settings bundle as JSON tree", () => {
    const content = JSON.stringify({ theme: "dark", editor: { tabSize: 2 } });
    const result = renderAssetPreview(content, "settings_bundle", "My Settings");
    expect(result.format).toBe("json");
    const structSection = result.sections.find((s) => s.label.startsWith("Structure"));
    expect(structSection).toBeDefined();
    expect(structSection!.content).toContain("theme");
  });

  it("shows warning for invalid JSON", () => {
    const result = renderAssetPreview("not json", "hook", "Bad Hook");
    expect(result.warnings).toContain("Invalid JSON — cannot parse content");
  });
});

// ─── MCP Config Validation ────────────────────────────────

describe("MCP Config Validator", () => {
  it("validates a valid stdio MCP config", () => {
    const config = JSON.stringify({
      mcpServers: {
        "file-search": { command: "npx", args: ["-y", "mcp-file-search"] },
      },
    });
    const result = validateMCPConfig(config);
    expect(result.valid).toBe(true);
    expect(result.serverCount).toBe(1);
    expect(result.detectedTransport).toBe("stdio");
    expect(result.servers[0].name).toBe("file-search");
  });

  it("validates a valid SSE MCP config", () => {
    const config = JSON.stringify({
      mcpServers: {
        "remote-api": { url: "https://api.example.com/mcp", transport: "sse" },
      },
    });
    const result = validateMCPConfig(config);
    expect(result.valid).toBe(true);
    expect(result.detectedTransport).toBe("sse");
  });

  it("detects missing command for stdio", () => {
    const config = JSON.stringify({
      mcpServers: {
        broken: { transport: "stdio" },
      },
    });
    const result = validateMCPConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("requires \"command\"");
  });

  it("detects missing url for SSE", () => {
    const config = JSON.stringify({
      mcpServers: {
        broken: { transport: "sse" },
      },
    });
    const result = validateMCPConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("requires \"url\"");
  });

  it("detects invalid URL", () => {
    const config = JSON.stringify({
      mcpServers: {
        broken: { url: "not-a-url", transport: "sse" },
      },
    });
    const result = validateMCPConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("invalid URL");
  });

  it("handles invalid JSON", () => {
    const result = validateMCPConfig("not json");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Invalid JSON");
  });

  it("warns about empty server list", () => {
    const result = validateMCPConfig("{}");
    expect(result.warnings).toContain("No server definitions found");
  });

  it("validates multiple servers", () => {
    const config = JSON.stringify({
      mcpServers: {
        local: { command: "node", args: ["server.js"] },
        remote: { url: "https://api.example.com/mcp", transport: "sse" },
      },
    });
    const result = validateMCPConfig(config);
    expect(result.valid).toBe(true);
    expect(result.serverCount).toBe(2);
  });
});
