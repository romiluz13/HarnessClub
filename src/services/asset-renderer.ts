/**
 * Asset Renderer Service — type-aware rendering for live previews.
 *
 * Pure functions that transform raw asset content into structured
 * preview data per asset type. No external markdown dependencies.
 *
 * Per typescript-advanced-types: discriminated union for render outputs.
 */

import type { AssetType } from "@/types/asset";

// ─── Types ─────────────────────────────────────────────────

export type RenderFormat = "markdown" | "json" | "yaml" | "code";

export interface RenderResult {
  format: RenderFormat;
  title: string;
  sections: RenderSection[];
  warnings: string[];
}

export interface RenderSection {
  label: string;
  content: string;
  language?: string;
  collapsible?: boolean;
}

/** MCP config validation result */
export interface MCPValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  detectedTransport: "sse" | "stdio" | "streamable-http" | "unknown";
  serverCount: number;
  servers: Array<{ name: string; transport: string; command?: string; url?: string }>;
}

// ─── Asset Type → Render Format mapping ───────────────────

const TYPE_FORMAT: Record<AssetType, RenderFormat> = {
  skill: "markdown",
  rule: "markdown",
  agent: "markdown",
  plugin: "json",
  mcp_config: "json",
  hook: "json",
  settings_bundle: "json",
};

// ─── Renderers ────────────────────────────────────────────

/**
 * Render an asset's content for live preview.
 */
export function renderAssetPreview(
  content: string,
  type: AssetType,
  name: string
): RenderResult {
  const format = TYPE_FORMAT[type];
  const warnings: string[] = [];

  switch (type) {
    case "skill":
    case "rule":
    case "agent":
      return renderMarkdown(content, name, type, format);
    case "mcp_config":
      return renderMCPConfig(content, name, warnings);
    case "hook":
      return renderJSON(content, name, "Hook Configuration", warnings);
    case "plugin":
      return renderJSON(content, name, "Plugin Manifest", warnings);
    case "settings_bundle":
      return renderJSON(content, name, "Settings Bundle", warnings);
    default:
      return { format: "code", title: name, sections: [{ label: "Content", content }], warnings: [] };
  }
}

function renderMarkdown(content: string, name: string, type: AssetType, format: RenderFormat): RenderResult {
  const sections: RenderSection[] = [];

  // Extract frontmatter
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (fmMatch) {
    sections.push({
      label: "Frontmatter",
      content: fmMatch[1].trim(),
      language: "yaml",
      collapsible: true,
    });
    sections.push({ label: "Content", content: fmMatch[2].trim(), language: "markdown" });
  } else {
    sections.push({ label: "Content", content, language: "markdown" });
  }

  // Extract code blocks for separate rendering
  const codeBlocks = content.match(/```(\w+)?\n[\s\S]*?```/g) ?? [];
  if (codeBlocks.length > 0) {
    sections.push({
      label: `Code Blocks (${codeBlocks.length})`,
      content: codeBlocks.join("\n\n"),
      collapsible: true,
    });
  }

  return { format, title: name, sections, warnings: [] };
}

function renderJSON(content: string, name: string, label: string, warnings: string[]): RenderResult {
  const sections: RenderSection[] = [];

  try {
    const parsed = JSON.parse(content);
    sections.push({
      label,
      content: JSON.stringify(parsed, null, 2),
      language: "json",
    });

    // Show top-level keys as summary
    const keys = Object.keys(parsed);
    if (keys.length > 0) {
      sections.push({
        label: `Structure (${keys.length} keys)`,
        content: keys.map((k) => `• ${k}: ${typeof parsed[k]}`).join("\n"),
        collapsible: true,
      });
    }
  } catch {
    warnings.push("Invalid JSON — cannot parse content");
    sections.push({ label, content, language: "text" });
  }

  return { format: "json", title: name, sections, warnings };
}

function renderMCPConfig(content: string, name: string, warnings: string[]): RenderResult {
  const sections: RenderSection[] = [];

  try {
    const parsed = JSON.parse(content);
    sections.push({
      label: "MCP Configuration",
      content: JSON.stringify(parsed, null, 2),
      language: "json",
    });

    // Validate and extract server info
    const validation = validateMCPConfig(content);
    if (validation.servers.length > 0) {
      sections.push({
        label: `Servers (${validation.serverCount})`,
        content: validation.servers.map((s) =>
          `• ${s.name}: ${s.transport}${s.url ? ` → ${s.url}` : ""}${s.command ? ` (${s.command})` : ""}`
        ).join("\n"),
      });
    }

    warnings.push(...validation.warnings);
    if (!validation.valid) warnings.push(...validation.errors);
  } catch {
    warnings.push("Invalid JSON in MCP config");
    sections.push({ label: "Raw Content", content, language: "text" });
  }

  return { format: "json", title: name, sections, warnings };
}

// ─── MCP Config Validator ─────────────────────────────────

/**
 * Validate an MCP config JSON string.
 * Checks: valid JSON, server entries, transport types, required fields.
 */
export function validateMCPConfig(content: string): MCPValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const servers: MCPValidation["servers"] = [];

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { valid: false, errors: ["Invalid JSON"], warnings: [], detectedTransport: "unknown", serverCount: 0, servers: [] };
  }

  const serversObj = (parsed.mcpServers ?? parsed.servers ?? parsed) as Record<string, unknown>;

  if (typeof serversObj !== "object" || serversObj === null) {
    return { valid: false, errors: ["Expected an object with server definitions"], warnings: [], detectedTransport: "unknown", serverCount: 0, servers: [] };
  }

  let detectedTransport: MCPValidation["detectedTransport"] = "unknown";

  for (const [name, config] of Object.entries(serversObj)) {
    if (typeof config !== "object" || config === null) {
      errors.push(`Server "${name}": expected object configuration`);
      continue;
    }

    const cfg = config as Record<string, unknown>;
    const transport = (cfg.transport as string) ?? (cfg.command ? "stdio" : cfg.url ? "sse" : "unknown");

    const server: MCPValidation["servers"][0] = {
      name,
      transport,
      command: cfg.command as string | undefined,
      url: cfg.url as string | undefined,
    };

    if (transport === "stdio") {
      if (!cfg.command) errors.push(`Server "${name}": stdio transport requires "command" field`);
      detectedTransport = "stdio";
    } else if (transport === "sse" || transport === "streamable-http") {
      if (!cfg.url) errors.push(`Server "${name}": ${transport} transport requires "url" field`);
      else {
        try {
          const url = new URL(cfg.url as string);
          if (url.protocol !== "https:" && url.protocol !== "http:") {
            warnings.push(`Server "${name}": URL should use http(s) protocol`);
          }
        } catch {
          errors.push(`Server "${name}": invalid URL "${cfg.url}"`);
        }
      }
      detectedTransport = transport as "sse" | "streamable-http";
    }

    servers.push(server);
  }

  if (servers.length === 0) {
    warnings.push("No server definitions found");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    detectedTransport,
    serverCount: servers.length,
    servers,
  };
}
