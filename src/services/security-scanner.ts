/**
 * Security Scanner — detects dangerous patterns in imported content.
 *
 * Per api-security-best-practices: validate ALL user-supplied content.
 * Scans for:
 * 1. API keys and secrets (critical — block import)
 * 2. Prompt injection patterns (high — warn + flag)
 * 3. Dangerous shell commands (medium — warn)
 * 4. Suspicious URLs (low — warn)
 *
 * Design: Pure functions, no side effects, no network calls.
 * Fast enough to run synchronously on every import.
 */

/** Severity levels — determines import behavior */
export type ScanSeverity = "critical" | "high" | "medium" | "low";

/** A single finding from the scanner */
export interface ScanFinding {
  severity: ScanSeverity;
  category: string;
  message: string;
  /** Line number (1-based) where the finding was detected */
  line?: number;
  /** The matched pattern (redacted for secrets) */
  match?: string;
}

/** Result of scanning content */
export interface ScanResult {
  /** Whether the content is safe to import */
  safe: boolean;
  /** List of findings (empty = clean) */
  findings: ScanFinding[];
  /** Count by severity */
  counts: Record<ScanSeverity, number>;
}

/** Pattern definition for scanning */
interface ScanPattern {
  severity: ScanSeverity;
  category: string;
  message: string;
  regex: RegExp;
  /** If true, redact the match in findings */
  redact?: boolean;
}

// ─── Pattern Definitions ────────────────────────────────────

const PATTERNS: ScanPattern[] = [
  // === CRITICAL: API Keys & Secrets (block import) ===
  { severity: "critical", category: "secret", message: "AWS access key detected",
    regex: /AKIA[0-9A-Z]{16}/g, redact: true },
  { severity: "critical", category: "secret", message: "Generic API key assignment",
    regex: /(api[_-]?key|apikey|secret[_-]?key|access[_-]?token)\s*[:=]\s*["'][a-zA-Z0-9_\-/.]{20,}["']/gi, redact: true },
  { severity: "critical", category: "secret", message: "Private key detected",
    regex: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g, redact: true },
  { severity: "critical", category: "secret", message: "GitHub personal access token",
    regex: /gh[ps]_[a-zA-Z0-9]{36,}/g, redact: true },
  { severity: "critical", category: "secret", message: "OpenAI API key detected",
    regex: /sk-[a-zA-Z0-9]{20,}/g, redact: true },
  { severity: "critical", category: "secret", message: "Anthropic API key detected",
    regex: /sk-ant-[a-zA-Z0-9_-]{20,}/g, redact: true },
  { severity: "critical", category: "secret", message: "MongoDB connection string with credentials",
    regex: /mongodb(\+srv)?:\/\/[^:]+:[^@]+@/g, redact: true },
  { severity: "critical", category: "secret", message: "Generic bearer token",
    regex: /Bearer\s+[a-zA-Z0-9_\-/.]{30,}/g, redact: true },

  // === HIGH: Prompt Injection Patterns ===
  { severity: "high", category: "injection", message: "Prompt injection: 'ignore previous instructions'",
    regex: /ignore\s+(all\s+)?previous\s+(instructions|rules|prompts)/gi },
  { severity: "high", category: "injection", message: "Prompt injection: system prompt override",
    regex: /system\s*prompt\s*[:=]/gi },
  { severity: "high", category: "injection", message: "Prompt injection: role hijacking",
    regex: /you\s+are\s+now\s+(a|an|the)\s/gi },
  { severity: "high", category: "injection", message: "Encoded content (possible obfuscation)",
    regex: /\\x[0-9a-f]{2}|\\u[0-9a-f]{4}/gi },
  { severity: "high", category: "injection", message: "Base64 encoded block (>100 chars)",
    regex: /[A-Za-z0-9+/]{100,}={0,2}/g },

  // === MEDIUM: Dangerous Shell Commands ===
  { severity: "medium", category: "command", message: "Destructive command: rm -rf",
    regex: /rm\s+-rf?\s+\//g },
  { severity: "medium", category: "command", message: "Curl to shell pipe",
    regex: /curl\s+[^\n]*\|\s*(bash|sh|zsh)/g },
  { severity: "medium", category: "command", message: "wget to shell pipe",
    regex: /wget\s+[^\n]*\|\s*(bash|sh|zsh)/g },
  { severity: "medium", category: "command", message: "Environment variable exfiltration",
    regex: /\$\{?(ENV|HOME|PATH|AWS_|OPENAI_|ANTHROPIC_)/g },
  { severity: "medium", category: "command", message: "chmod 777 (world-writable)",
    regex: /chmod\s+777/g },

  // === LOW: Suspicious URLs ===
  { severity: "low", category: "url", message: "Suspicious URL: raw IP address",
    regex: /https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g },
  { severity: "low", category: "url", message: "Suspicious URL: non-standard port",
    regex: /https?:\/\/[^/]+:\d{4,5}/g },
  { severity: "low", category: "url", message: "Data URI (possible payload embedding)",
    regex: /data:[a-z]+\/[a-z]+;base64,/g },
];

/**
 * Scan content for security issues.
 *
 * @param content - The raw text content to scan
 * @returns ScanResult with findings and safety determination
 *
 * Safety rules:
 * - ANY critical finding → safe=false (blocks import)
 * - High/medium/low → safe=true but findings are attached
 */
export function scanContent(content: string): ScanResult {
  const findings: ScanFinding[] = [];
  const lines = content.split("\n");

  for (const pattern of PATTERNS) {
    // Reset regex lastIndex for global patterns
    pattern.regex.lastIndex = 0;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      pattern.regex.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = pattern.regex.exec(line)) !== null) {
        findings.push({
          severity: pattern.severity,
          category: pattern.category,
          message: pattern.message,
          line: lineIdx + 1,
          match: pattern.redact ? `${match[0].slice(0, 4)}${"*".repeat(8)}` : match[0].slice(0, 50),
        });
      }
    }
  }

  const counts: Record<ScanSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const finding of findings) {
    counts[finding.severity]++;
  }

  return {
    safe: counts.critical === 0,
    findings,
    counts,
  };
}
