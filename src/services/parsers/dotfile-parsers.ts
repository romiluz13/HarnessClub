/**
 * Dotfile parsers — .cursorrules, .cursor/rules/*.mdc, .windsurfrules
 *
 * These handle AI tool config files that use dotfile conventions.
 * .cursorrules and .windsurfrules are plain text/markdown.
 * .cursor/rules/*.mdc uses MDC format (frontmatter + content).
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

// ─── 6. .cursorrules Parser ─────────────────────────────────

const cursorrulesParser: ParserPlugin = {
  id: "cursorrules",
  name: ".cursorrules (Cursor)",
  formats: ["cursorrules"],
  sourceTools: ["cursor"],

  detect(filename: string): number {
    const lower = filename.toLowerCase();
    if (lower === ".cursorrules" || lower.endsWith("/.cursorrules")) return 99;
    return 0;
  },

  parse(filename: string, content: string): ParsedAsset {
    const name = "Cursor Rules";
    const description = extractFirstParagraph(content);
    const tags = inferTags(content);

    return {
      format: "cursorrules",
      assetType: "rule",
      metadata: { name, description },
      content,
      tags: [...tags, "cursor", "project-rules"],
      typeConfig: { ruleConfig: { scope: "project", targetTool: "cursor" } },
      sourceTool: "cursor",
    };
  },
};

// ─── 7. .cursor/rules/*.mdc Parser ──────────────────────────

const cursorMdcParser: ParserPlugin = {
  id: "cursor-mdc",
  name: ".cursor/rules/*.mdc (Cursor Rules)",
  formats: ["cursor-mdc"],
  sourceTools: ["cursor"],

  detect(filename: string): number {
    const lower = filename.toLowerCase();
    // .cursor/rules/something.mdc
    if (/\.cursor\/rules\/[^/]+\.mdc$/i.test(lower)) return 99;
    // Any .mdc file
    if (lower.endsWith(".mdc")) return 70;
    return 0;
  },

  parse(filename: string, content: string): ParsedAsset {
    // MDC format: frontmatter (---) + content, similar to markdown
    const fm = extractFrontmatter(content);
    const name = fm?.frontmatter.description || fm?.frontmatter.name
      || extractFirstHeading(content) || nameFromFilename(filename);
    const description = fm?.frontmatter.description || extractFirstParagraph(content);
    const tags = inferTags(content, fm?.frontmatter.tags);

    // MDC frontmatter may contain globs for file matching
    const typeConfig: Record<string, unknown> = {
      ruleConfig: {
        scope: "project",
        targetTool: "cursor",
      },
    };
    if (fm?.frontmatter.globs) {
      (typeConfig.ruleConfig as Record<string, unknown>).globs = fm.frontmatter.globs;
    }

    return {
      format: "cursor-mdc",
      assetType: "rule",
      metadata: { name, description },
      content,
      tags: [...tags, "cursor", "mdc-rules"],
      typeConfig,
      sourceTool: "cursor",
    };
  },
};

// ─── 8. .windsurfrules Parser ───────────────────────────────

const windsurfrulesParser: ParserPlugin = {
  id: "windsurfrules",
  name: ".windsurfrules (Windsurf)",
  formats: ["windsurfrules"],
  sourceTools: ["windsurf"],

  detect(filename: string): number {
    const lower = filename.toLowerCase();
    if (lower === ".windsurfrules" || lower.endsWith("/.windsurfrules")) return 99;
    return 0;
  },

  parse(filename: string, content: string): ParsedAsset {
    const name = "Windsurf Rules";
    const description = extractFirstParagraph(content);
    const tags = inferTags(content);

    return {
      format: "windsurfrules",
      assetType: "rule",
      metadata: { name, description },
      content,
      tags: [...tags, "windsurf", "project-rules"],
      typeConfig: { ruleConfig: { scope: "project", targetTool: "windsurf" } },
      sourceTool: "windsurf",
    };
  },
};

// ─── Register All Dotfile Parsers ───────────────────────────

registerParser(cursorrulesParser);
registerParser(cursorMdcParser);
registerParser(windsurfrulesParser);
