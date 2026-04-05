/**
 * JSON-based parsers — plugin.json, .mcp.json / mcp.json, hooks.json
 *
 * These handle structured config files that use JSON format.
 * Each parser validates JSON structure and extracts type-specific config.
 */

import type { ParserPlugin, ParsedAsset } from "./types";
import { registerParser } from "./registry";
import { safeJsonParse, inferTags } from "./helpers";

// ─── 9. plugin.json Parser ─────────────────────────────────

const pluginJsonParser: ParserPlugin = {
  id: "plugin-json",
  name: "plugin.json (Claude Code Plugin)",
  formats: ["plugin.json"],
  sourceTools: ["claude-code"],

  detect(filename: string, content: string): number {
    const lower = filename.toLowerCase();
    if (lower === "plugin.json" || lower.endsWith("/plugin.json")) {
      // Verify it's valid JSON with expected fields
      const json = safeJsonParse(content);
      if (json && (json.name || json.version)) return 95;
      return 50;
    }
    return 0;
  },

  parse(filename: string, content: string): ParsedAsset {
    const json = safeJsonParse(content);
    if (!json) throw new Error("Invalid JSON in plugin.json");

    const name = (json.name as string) || "Unnamed Plugin";
    const description = (json.description as string) || "Plugin configuration";
    const version = (json.version as string) || undefined;
    const author = (json.author as string) || undefined;

    const tags = inferTags(content);

    return {
      format: "plugin.json",
      assetType: "plugin",
      metadata: { name, description, version, author },
      content,
      tags: [...tags, "plugin", "claude-code"],
      typeConfig: {
        pluginConfig: {
          manifest: json,
        },
      },
      sourceTool: "claude-code",
    };
  },
};

// ─── 10. .mcp.json / mcp.json Parser ───────────────────────

const mcpJsonParser: ParserPlugin = {
  id: "mcp-json",
  name: "MCP Config (.mcp.json / mcp.json)",
  formats: ["mcp.json"],
  sourceTools: ["claude-code", "cursor", "windsurf"],

  detect(filename: string, content: string): number {
    const lower = filename.toLowerCase();
    if (lower === ".mcp.json" || lower === "mcp.json" || lower.endsWith("/.mcp.json") || lower.endsWith("/mcp.json")) {
      const json = safeJsonParse(content);
      if (json && json.mcpServers) return 99;
      return 60;
    }
    // claude_desktop_config.json also contains MCP servers
    if (lower.includes("claude_desktop_config") && lower.endsWith(".json")) {
      const json = safeJsonParse(content);
      if (json && json.mcpServers) return 90;
    }
    return 0;
  },

  parse(filename: string, content: string): ParsedAsset {
    const json = safeJsonParse(content);
    if (!json) throw new Error("Invalid JSON in MCP config");

    const servers = json.mcpServers as Record<string, unknown> | undefined;
    const serverNames = servers ? Object.keys(servers) : [];
    const name = `MCP Config (${serverNames.length} server${serverNames.length !== 1 ? "s" : ""})`;
    const description = serverNames.length > 0
      ? `MCP servers: ${serverNames.slice(0, 5).join(", ")}${serverNames.length > 5 ? ` +${serverNames.length - 5} more` : ""}`
      : "MCP server configuration";

    // Detect transport types
    const transports = new Set<string>();
    if (servers) {
      for (const server of Object.values(servers)) {
        const s = server as Record<string, unknown>;
        if (s.command) transports.add("stdio");
        if (s.url && (s.url as string).includes("sse")) transports.add("sse");
        if (s.url) transports.add("http");
      }
    }

    const tags = ["mcp", ...serverNames.slice(0, 10).map((n) => n.toLowerCase())];

    return {
      format: "mcp.json",
      assetType: "mcp_config",
      metadata: { name, description },
      content,
      tags,
      typeConfig: {
        mcpConfig: {
          transport: transports.size === 1 ? [...transports][0] : "stdio",
          serverDefs: servers ? Object.entries(servers).map(([name, def]) => ({ name, ...def as Record<string, unknown> })) : [],
        },
      },
      sourceTool: "claude-code",
    };
  },
};

// ─── 11. hooks.json Parser ──────────────────────────────────

const hooksJsonParser: ParserPlugin = {
  id: "hooks-json",
  name: "hooks.json (Claude Code Hooks)",
  formats: ["hooks.json"],
  sourceTools: ["claude-code"],

  detect(filename: string, content: string): number {
    const lower = filename.toLowerCase();
    if (lower === "hooks.json" || lower.endsWith("/hooks.json") || lower === ".claude/hooks.json") {
      const json = safeJsonParse(content);
      if (json && (json.hooks || Array.isArray(json))) return 95;
      return 40;
    }
    return 0;
  },

  parse(filename: string, content: string): ParsedAsset {
    const json = safeJsonParse(content);
    if (!json) throw new Error("Invalid JSON in hooks.json");

    const hooks = (json.hooks || json) as unknown[];
    const hookCount = Array.isArray(hooks) ? hooks.length : 0;
    const name = `Claude Hooks (${hookCount} hook${hookCount !== 1 ? "s" : ""})`;

    // Extract event types from hooks
    const events = new Set<string>();
    if (Array.isArray(hooks)) {
      for (const hook of hooks) {
        const h = hook as Record<string, unknown>;
        if (h.event) events.add(h.event as string);
        if (h.type) events.add(h.type as string);
      }
    }

    return {
      format: "hooks.json",
      assetType: "hook",
      metadata: { name, description: `${hookCount} hooks for events: ${[...events].join(", ") || "unknown"}` },
      content,
      tags: ["hooks", "claude-code", ...[...events].map((e) => e.toLowerCase())],
      typeConfig: {
        hookConfig: {
          events: [...events],
          scripts: Array.isArray(hooks) ? hooks as Record<string, unknown>[] : [],
        },
      },
      sourceTool: "claude-code",
    };
  },
};

// ─── Register All JSON Parsers ──────────────────────────────

registerParser(pluginJsonParser);
registerParser(mcpJsonParser);
registerParser(hooksJsonParser);
