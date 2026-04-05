/**
 * Application-level asset type validators.
 *
 * MongoDB $jsonSchema does NOT support conditional validation (oneOf/if-then-else).
 * Per mongodb-schema-design fundamental-schema-validation:
 *   "Validate structure at DB level, business rules in application."
 *
 * These validators enforce per-type business rules BEFORE insertion:
 * - Type-specific config fields must only appear on matching types
 * - Required type-specific fields are validated (e.g., mcpConfig.transport)
 * - Cross-field invariants are checked
 */

import type { AssetType, CreateAssetInput } from "@/types/asset";

/** Validation error with field path and message */
export interface ValidationError {
  field: string;
  message: string;
}

/** Validation result — either valid or a list of errors */
export type ValidationResult =
  | { valid: true }
  | { valid: false; errors: ValidationError[] };

/** Config field names that are type-specific */
const TYPE_CONFIG_FIELDS: Record<string, AssetType> = {
  agentConfig: "agent",
  ruleConfig: "rule",
  pluginConfig: "plugin",
  mcpConfig: "mcp_config",
  hookConfig: "hook",
  settingsConfig: "settings_bundle",
};

/**
 * Validate a CreateAssetInput before database insertion.
 * Checks:
 * 1. Type-specific config fields only appear on matching asset type
 * 2. Required sub-fields within type-specific configs
 * 3. Shared field constraints beyond what $jsonSchema enforces
 */
export function validateAssetInput(input: CreateAssetInput): ValidationResult {
  const errors: ValidationError[] = [];

  // 1. Validate type is in allowed set
  const validTypes: AssetType[] = [
    "skill", "agent", "rule", "plugin", "mcp_config", "hook", "settings_bundle",
  ];
  if (!validTypes.includes(input.type)) {
    errors.push({ field: "type", message: `Invalid asset type: ${input.type}` });
    return { valid: false, errors };
  }

  // 2. Reject config fields that don't match this type
  for (const [configField, expectedType] of Object.entries(TYPE_CONFIG_FIELDS)) {
    const value = input[configField as keyof CreateAssetInput];
    if (value !== undefined && value !== null && input.type !== expectedType) {
      errors.push({
        field: configField,
        message: `${configField} is only valid on type "${expectedType}", not "${input.type}"`,
      });
    }
  }

  // 3. Per-type required field validation
  switch (input.type) {
    case "agent":
      // agentConfig is optional but if present, model should be a string
      if (input.agentConfig?.model !== undefined && typeof input.agentConfig.model !== "string") {
        errors.push({ field: "agentConfig.model", message: "model must be a string" });
      }
      break;

    case "mcp_config":
      // mcpConfig.transport is recommended
      if (input.mcpConfig && !input.mcpConfig.transport) {
        errors.push({ field: "mcpConfig.transport", message: "transport is required for mcp_config assets (stdio, sse, or http)" });
      }
      break;

    case "hook":
      // hookConfig.events should have at least one event
      if (input.hookConfig && (!input.hookConfig.events || input.hookConfig.events.length === 0)) {
        errors.push({ field: "hookConfig.events", message: "at least one event is required for hook assets" });
      }
      break;

    case "settings_bundle":
      // settingsConfig.targetTool is recommended
      if (input.settingsConfig && !input.settingsConfig.targetTool) {
        errors.push({ field: "settingsConfig.targetTool", message: "targetTool is recommended for settings_bundle assets" });
      }
      break;

    case "plugin":
      // Plugin manifest version should be valid semver if provided
      if (input.pluginConfig?.manifest?.version) {
        const semverPattern = /^[0-9]+\.[0-9]+\.[0-9]+/;
        if (!semverPattern.test(input.pluginConfig.manifest.version)) {
          errors.push({ field: "pluginConfig.manifest.version", message: "version must be valid semver (e.g., 1.0.0)" });
        }
      }
      // Bundled assets should have reasonable limit
      if (input.pluginConfig?.bundledAssetIds && input.pluginConfig.bundledAssetIds.length > 200) {
        errors.push({ field: "pluginConfig.bundledAssetIds", message: "plugin can bundle at most 200 assets" });
      }
      break;

    // skill, rule — no additional required fields beyond base
    default:
      break;
  }

  // 4. Shared field constraints
  if (input.metadata.name.length > 200) {
    errors.push({ field: "metadata.name", message: "name must be ≤200 characters" });
  }
  if (input.metadata.description.length > 2000) {
    errors.push({ field: "metadata.description", message: "description must be ≤2000 characters" });
  }
  if (input.tags.length > 50) {
    errors.push({ field: "tags", message: "maximum 50 tags allowed" });
  }
  // Validate tags are lowercase (convention)
  const nonLowercaseTags = input.tags.filter((t) => t !== t.toLowerCase());
  if (nonLowercaseTags.length > 0) {
    errors.push({ field: "tags", message: `tags must be lowercase: ${nonLowercaseTags.join(", ")}` });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true };
}
