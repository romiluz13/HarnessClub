/**
 * Type-Specific Security Scanner — extends base scanner with asset-type-aware analysis.
 *
 * Per api-security-best-practices:
 * - MCP configs: validate transport, allowlist domains, detect credential exposure
 * - Hooks: detect privilege escalation, unsafe shell patterns, network exfiltration
 * - Settings bundles: detect unsafe model overrides
 *
 * Design: Composes with base scanContent() — runs type-specific checks AFTER base scan.
 */

import { scanContent, type ScanResult, type ScanFinding, type ScanSeverity } from "./security-scanner";
import type { AssetType } from "@/types/asset";

// ─── MCP Config Analysis ──────────────────────────────────

/** Known-safe MCP transport types */
const SAFE_TRANSPORTS = ["stdio", "sse", "streamable-http"];

/** Known-safe domains for MCP servers */
const ALLOWLISTED_DOMAINS = [
  "github.com", "api.github.com",
  "registry.npmjs.org",
  "api.anthropic.com",
  "api.openai.com",
  "cloud.mongodb.com",
  "localhost", "127.0.0.1",
];

function scanMcpConfig(content: string): ScanFinding[] {
  const findings: ScanFinding[] = [];

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content);
  } catch {
    findings.push({
      severity: "high",
      category: "mcp_config",
      message: "MCP config is not valid JSON",
    });
    return findings;
  }

  const servers = (parsed.mcpServers ?? parsed.servers ?? {}) as Record<string, Record<string, unknown>>;

  for (const [name, config] of Object.entries(servers)) {
    // Check transport type
    const transport = config.transport as string | undefined;
    if (transport && !SAFE_TRANSPORTS.includes(transport)) {
      findings.push({
        severity: "high",
        category: "mcp_transport",
        message: `MCP server "${name}" uses unknown transport: ${transport}`,
      });
    }

    // Check for inline credentials in command args
    const args = (config.args ?? []) as string[];
    for (const arg of args) {
      if (/--token|--api-key|--secret|--password/i.test(arg)) {
        findings.push({
          severity: "critical",
          category: "mcp_credential",
          message: `MCP server "${name}" passes credentials via command args — use env instead`,
          match: arg.slice(0, 30),
        });
      }
    }

    // Check URL against allowlist
    const url = (config.url ?? config.endpoint ?? "") as string;
    if (url) {
      try {
        const hostname = new URL(url).hostname;
        if (!ALLOWLISTED_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`))) {
          findings.push({
            severity: "medium",
            category: "mcp_domain",
            message: `MCP server "${name}" connects to non-allowlisted domain: ${hostname}`,
            match: hostname,
          });
        }
      } catch {
        findings.push({
          severity: "low",
          category: "mcp_url",
          message: `MCP server "${name}" has invalid URL: ${url.slice(0, 50)}`,
        });
      }
    }

    // Check env vars for hardcoded values (should use references)
    const env = (config.env ?? {}) as Record<string, string>;
    for (const [key, value] of Object.entries(env)) {
      if (typeof value === "string" && value.length > 20 && !/^\$\{/.test(value) && !/^process\.env/.test(value)) {
        findings.push({
          severity: "high",
          category: "mcp_env_hardcoded",
          message: `MCP server "${name}" has hardcoded env value for "${key}" — use variable reference`,
          match: `${value.slice(0, 4)}${"*".repeat(8)}`,
        });
      }
    }
  }

  return findings;
}

// ─── Hook Script Analysis ──────────────────────────────────

function scanHookContent(content: string): ScanFinding[] {
  const findings: ScanFinding[] = [];

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content);
  } catch {
    findings.push({ severity: "high", category: "hook", message: "Hook config is not valid JSON" });
    return findings;
  }

  const hooks = (parsed.hooks ?? []) as Array<Record<string, unknown>>;
  for (const hook of hooks) {
    const command = (hook.command ?? hook.script ?? "") as string;

    // Privilege escalation
    if (/sudo\s|doas\s|pkexec/i.test(command)) {
      findings.push({
        severity: "critical", category: "hook_escalation",
        message: "Hook uses privilege escalation (sudo/doas)",
        match: command.slice(0, 40),
      });
    }

    // Network exfiltration
    if (/curl\s|wget\s|nc\s|ncat\s|netcat/i.test(command)) {
      findings.push({
        severity: "high", category: "hook_network",
        message: "Hook makes network requests — potential data exfiltration",
        match: command.slice(0, 40),
      });
    }

    // File system writes outside project
    if (/>\s*\/|>>?\s*~\/|>\s*\$HOME/i.test(command)) {
      findings.push({
        severity: "medium", category: "hook_filesystem",
        message: "Hook writes outside project directory",
        match: command.slice(0, 40),
      });
    }
  }

  return findings;
}

// ─── Settings Bundle Analysis ──────────────────────────────

function scanSettingsBundle(content: string): ScanFinding[] {
  const findings: ScanFinding[] = [];
  try {
    const parsed = JSON.parse(content);
    // Check for unsafe model overrides
    if (parsed.model && /gpt-4|claude-opus/i.test(parsed.model)) {
      findings.push({
        severity: "low", category: "settings_model",
        message: `Settings override to expensive model: ${parsed.model}`,
      });
    }
    // Check for disabled safety features
    if (parsed.safety === false || parsed.contentFilter === false) {
      findings.push({
        severity: "high", category: "settings_safety",
        message: "Settings disable safety features",
      });
    }
  } catch {
    findings.push({ severity: "medium", category: "settings", message: "Settings bundle is not valid JSON" });
  }
  return findings;
}

// ─── Unified Scanner ──────────────────────────────────────

/** Scan result with type-specific info */
export interface TypedScanResult extends ScanResult {
  assetType: AssetType;
  scannedAt: Date;
}

/**
 * Scan an asset with both base patterns AND type-specific analysis.
 *
 * @param content — raw content string
 * @param assetType — determines which type-specific analyzer runs
 * @returns TypedScanResult with all findings merged
 */
export function scanAsset(content: string, assetType: AssetType): TypedScanResult {
  // Run base scanner first (secrets, injections, commands, URLs)
  const baseResult = scanContent(content);

  // Run type-specific scanner
  let typeFindings: ScanFinding[] = [];
  switch (assetType) {
    case "mcp_config":
      typeFindings = scanMcpConfig(content);
      break;
    case "hook":
      typeFindings = scanHookContent(content);
      break;
    case "settings_bundle":
      typeFindings = scanSettingsBundle(content);
      break;
    default:
      // skill, agent, rule, plugin — base scan is sufficient
      break;
  }

  // Merge findings
  const allFindings = [...baseResult.findings, ...typeFindings];

  // Recalculate counts
  const counts: Record<ScanSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of allFindings) {
    counts[f.severity]++;
  }

  return {
    safe: counts.critical === 0,
    findings: allFindings,
    counts,
    assetType,
    scannedAt: new Date(),
  };
}
