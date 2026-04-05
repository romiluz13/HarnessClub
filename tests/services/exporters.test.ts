/**
 * Export Engine Tests — all 5 exporters + registry functions.
 *
 * Tests export to: Claude Code, Cursor, Copilot, Windsurf, Codex.
 * Verifies filename conventions, content structure, and type support.
 */

import { describe, it, expect } from "vitest";
import { ObjectId } from "mongodb";
import {
  exportAsset,
  canExport,
  getAvailableTargets,
  getRegisteredExporters,
  EXPORT_TARGETS,
} from "@/services/exporters";
import type { AssetDocument } from "@/types/asset";
import { generateFingerprint } from "@/types/asset";

/** Helper to create a mock asset document */
function mockAsset(overrides: Partial<AssetDocument> = {}): AssetDocument {
  return {
    _id: new ObjectId(),
    type: "skill",
    teamId: new ObjectId(),
    metadata: { name: "Test Skill", description: "A test skill for unit tests" },
    content: "# Test Skill\n\nThis is the skill content.",
    tags: ["test", "unit"],
    searchText: "",
    stats: { installCount: 0, viewCount: 0 },
    isPublished: true,
    createdBy: new ObjectId(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as AssetDocument;
}

describe("Exporter Registry", () => {
  it("has all 5 exporters registered", () => {
    const exporters = getRegisteredExporters();
    expect(exporters.length).toBe(5);
  });

  it("covers all 5 target tools", () => {
    const exporters = getRegisteredExporters();
    const targets = new Set(exporters.map((e) => e.target));
    expect(targets.size).toBe(5);
    for (const t of EXPORT_TARGETS) {
      expect(targets.has(t)).toBe(true);
    }
  });

  it("canExport returns true for skill to all targets", () => {
    for (const target of EXPORT_TARGETS) {
      expect(canExport("skill", target)).toBe(true);
    }
  });

  it("canExport returns false for hook to copilot", () => {
    expect(canExport("hook", "copilot")).toBe(false);
  });

  it("getAvailableTargets includes claude-code for all types", () => {
    const types = ["skill", "agent", "rule", "plugin", "mcp_config", "hook", "settings_bundle"] as const;
    for (const type of types) {
      const targets = getAvailableTargets(type);
      expect(targets).toContain("claude-code");
    }
  });
});

describe("Claude Code Exporter", () => {
  it("exports skill as SKILL.md with frontmatter", () => {
    const asset = mockAsset({ type: "skill" });
    const result = exportAsset(asset, "claude-code");
    expect(result.filename).toBe("SKILL.md");
    expect(result.mimeType).toBe("text/markdown");
    expect(result.content).toContain("---");
    expect(result.content).toContain("name: Test Skill");
    expect(result.content).toContain("tags: test, unit");
  });

  it("exports agent as agents/{slug}.md", () => {
    const asset = mockAsset({ type: "agent", metadata: { name: "Code Review Agent", description: "Reviews code" } });
    const result = exportAsset(asset, "claude-code");
    expect(result.filename).toBe("agents/code-review-agent.md");
  });

  it("exports rule as CLAUDE.md", () => {
    const asset = mockAsset({ type: "rule" });
    const result = exportAsset(asset, "claude-code");
    expect(result.filename).toBe("CLAUDE.md");
    expect(result.content).toBe(asset.content);
  });

  it("exports mcp_config as .mcp.json", () => {
    const asset = mockAsset({ type: "mcp_config", content: '{"mcpServers":{}}' });
    const result = exportAsset(asset, "claude-code");
    expect(result.filename).toBe(".mcp.json");
    expect(result.mimeType).toBe("application/json");
  });

  it("exports hook as hooks.json", () => {
    const asset = mockAsset({ type: "hook", content: '{"hooks":[]}' });
    const result = exportAsset(asset, "claude-code");
    expect(result.filename).toBe("hooks.json");
  });
});

describe("Cursor Exporter", () => {
  it("exports skill as .cursor/rules/{slug}.mdc with MDC frontmatter", () => {
    const asset = mockAsset({ type: "skill" });
    const result = exportAsset(asset, "cursor");
    expect(result.filename).toBe(".cursor/rules/test-skill.mdc");
    expect(result.content).toContain("---");
    expect(result.content).toContain("description: A test skill");
    expect(result.content).toContain("alwaysApply: true");
  });

  it("exports mcp_config as .cursor/mcp.json", () => {
    const asset = mockAsset({ type: "mcp_config", content: '{"mcpServers":{}}' });
    const result = exportAsset(asset, "cursor");
    expect(result.filename).toBe(".cursor/mcp.json");
  });
});

describe("Copilot Exporter", () => {
  it("exports skill as .github/copilot-instructions.md with header", () => {
    const asset = mockAsset();
    const result = exportAsset(asset, "copilot");
    expect(result.filename).toBe(".github/copilot-instructions.md");
    expect(result.content).toContain("## Test Skill");
    expect(result.content).toContain("> A test skill");
  });
});

describe("Windsurf Exporter", () => {
  it("exports skill as .windsurfrules", () => {
    const asset = mockAsset();
    const result = exportAsset(asset, "windsurf");
    expect(result.filename).toBe(".windsurfrules");
    expect(result.mimeType).toBe("text/plain");
    expect(result.content).toContain("# Test Skill");
  });
});


describe("Codex / OpenAI Exporter", () => {
  it("exports skill as AGENTS.md with header", () => {
    const asset = mockAsset();
    const result = exportAsset(asset, "codex");
    expect(result.filename).toBe("AGENTS.md");
    expect(result.content).toContain("## Test Skill");
    expect(result.content).toContain("> A test skill");
  });
});

describe("Export error handling", () => {
  it("throws for unsupported type+target combo", () => {
    const asset = mockAsset({ type: "hook", content: '{"hooks":[]}' });
    expect(() => exportAsset(asset, "copilot")).toThrow("No exporter found");
  });
});

describe("Fingerprint generation", () => {
  it("generates consistent SHA256 for same input", () => {
    const metadata = { name: "Test", description: "A test" };
    const content = "# Test\n\nContent here.";
    const fp1 = generateFingerprint(metadata, content);
    const fp2 = generateFingerprint(metadata, content);
    expect(fp1).toBe(fp2);
    expect(fp1).toHaveLength(64); // SHA256 hex = 64 chars
  });

  it("differs when content changes", () => {
    const metadata = { name: "Test", description: "A test" };
    const fp1 = generateFingerprint(metadata, "Content v1");
    const fp2 = generateFingerprint(metadata, "Content v2");
    expect(fp1).not.toBe(fp2);
  });

  it("differs when metadata changes", () => {
    const content = "Same content";
    const fp1 = generateFingerprint({ name: "A", description: "d" }, content);
    const fp2 = generateFingerprint({ name: "B", description: "d" }, content);
    expect(fp1).not.toBe(fp2);
  });
});
