/**
 * Action Block Parser — extracts structured action blocks from copilot text.
 *
 * Inspired by Cabinet's heartbeat.ts output block parsing.
 * Action blocks are fenced sections in copilot responses that trigger
 * platform operations without tool calling (useful for chained actions).
 *
 * Format:
 *   ```action:ACTION_TYPE
 *   key: value
 *   key: value
 *   ```
 *
 * Supported actions: ASSET_CREATE, SEARCH, EXPORT, SCAN, SUGGEST
 */

// ─── Types ─────────────────────────────────────────────────

export type ActionType = "ASSET_CREATE" | "SEARCH" | "EXPORT" | "SCAN" | "SUGGEST";

export interface ActionBlock {
  type: ActionType;
  params: Record<string, string>;
  raw: string;
}

export interface ParsedResponse {
  text: string;
  actions: ActionBlock[];
}

// ─── Parser ────────────────────────────────────────────────

const ACTION_PATTERN = /```action:(ASSET_CREATE|SEARCH|EXPORT|SCAN|SUGGEST)\n([\s\S]*?)```/g;

/**
 * Parse action blocks from copilot response text.
 * Returns the cleaned text (actions stripped) plus extracted actions.
 */
export function parseActionBlocks(text: string): ParsedResponse {
  const actions: ActionBlock[] = [];
  let cleaned = text;

  let match: RegExpExecArray | null;
  // Reset regex state
  ACTION_PATTERN.lastIndex = 0;

  while ((match = ACTION_PATTERN.exec(text)) !== null) {
    const type = match[1] as ActionType;
    const body = match[2].trim();
    const params: Record<string, string> = {};

    // Parse key: value pairs
    for (const line of body.split("\n")) {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim();
        const value = line.slice(colonIdx + 1).trim();
        if (key && value) params[key] = value;
      }
    }

    actions.push({ type, params, raw: match[0] });
    cleaned = cleaned.replace(match[0], "").trim();
  }

  return { text: cleaned, actions };
}

/**
 * Build an action block string for the copilot to emit.
 * Used by the system prompt to teach the copilot the format.
 */
export function formatActionBlock(type: ActionType, params: Record<string, string>): string {
  const lines = Object.entries(params).map(([k, v]) => `${k}: ${v}`);
  return "```action:" + type + "\n" + lines.join("\n") + "\n```";
}

/**
 * Validate that an action block has the required parameters.
 */
export function validateAction(action: ActionBlock): { valid: boolean; missing: string[] } {
  const required: Record<ActionType, string[]> = {
    ASSET_CREATE: ["type", "name", "content"],
    SEARCH: ["query"],
    EXPORT: ["assetId", "target"],
    SCAN: ["assetId"],
    SUGGEST: [],
  };

  const needed = required[action.type] ?? [];
  const missing = needed.filter((k) => !action.params[k]);
  return { valid: missing.length === 0, missing };
}
