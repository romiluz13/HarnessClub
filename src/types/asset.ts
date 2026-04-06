/**
 * Asset document types — polymorphic collection with type discriminator.
 *
 * Per mongodb-schema-design pattern-polymorphic:
 * - Single `assets` collection for all 7 asset types
 * - `type` field as discriminator (equality filter first in indexes)
 * - Shared fields on all documents (teamId, metadata, content, tags, etc.)
 * - Type-specific fields as optional (validated per-type via $jsonSchema oneOf)
 *
 * Per fundamental-embed-vs-reference:
 * - Metadata, content, embedding embedded (always accessed together)
 * - teamId is a reference (1:many team→assets)
 *
 * Per ADR-010: searchText field replaces explicit embedding[] for autoEmbed.
 * Manual embedding[] kept as fallback for M0/local.
 */

import type { ObjectId } from "mongodb";
import { createHash } from "crypto";

/** All supported asset types (discriminator values) */
export const ASSET_TYPES = [
  "skill",
  "agent",
  "rule",
  "plugin",
  "mcp_config",
  "hook",
  "settings_bundle",
] as const;

export type AssetType = (typeof ASSET_TYPES)[number];

export const RELEASE_STATUSES = [
  "draft",
  "pending_review",
  "approved",
  "published",
  "archived",
] as const;

export type ReleaseStatus = (typeof RELEASE_STATUSES)[number];

export function getDraftReleaseStatus(): ReleaseStatus {
  return "draft";
}

export function isPublishedReleaseStatus(status: ReleaseStatus): boolean {
  return status === "published";
}

export function getEffectiveReleaseStatus(
  asset: Pick<AssetBase, "isPublished"> & Partial<Pick<AssetBase, "releaseStatus">>
): ReleaseStatus {
  if (asset.releaseStatus) {
    return asset.releaseStatus;
  }

  return asset.isPublished ? "published" : getDraftReleaseStatus();
}

export function isAssetPublishedForDistribution(
  asset: Pick<AssetBase, "isPublished"> & Partial<Pick<AssetBase, "releaseStatus">>
): boolean {
  return asset.isPublished && isPublishedReleaseStatus(getEffectiveReleaseStatus(asset));
}

/** Shared metadata present on every asset */
export interface AssetMetadata {
  /** Asset display name */
  name: string;
  /** Short description */
  description: string;
  /** Author or maintainer */
  author?: string;
  /** Semantic version string */
  version?: string;
  /** License identifier (e.g., "MIT", "Apache-2.0") */
  license?: string;
}

/** Upstream source tracking for update detection (ADR-008) */
export interface AssetSource {
  /** Git repository URL */
  repoUrl: string;
  /** Asset path within repo */
  path: string;
  /** Git commit hash at import */
  commitHash: string;
  /** Last upstream sync */
  lastSyncedAt: Date;
}

/** Shared fields present on EVERY asset document */
export interface AssetBase {
  _id: ObjectId;
  /** Discriminator — determines which type-specific fields apply */
  type: AssetType;
  /** Team that owns this asset (reference to teams collection) */
  teamId: ObjectId;
  /** Parsed metadata */
  metadata: AssetMetadata;
  /** Raw content (markdown text, JSON string, etc.) */
  content: string;
  /** Searchable tags (lowercase, deduplicated) */
  tags: string[];
  /**
   * Pre-computed search text for autoEmbed (ADR-010).
   * Format: "Name: X\nDescription: Y\nTags: Z\nContent: ..."
   * Used by autoEmbed index OR manual Voyage fallback.
   */
  searchText: string;
  /** Version history (managed by version-service) */
  versions?: import("@/services/version-service").AssetVersion[];
  /** Current version number */
  currentVersionNumber?: number;
  /** Manual Voyage embedding vector — fallback for M0/local (ADR-010) */
  embedding?: number[];
  /** Upstream source for update tracking */
  source?: AssetSource;
  /** Pre-computed counters per pattern-computed */
  stats: { installCount: number; viewCount: number };
  /** Whether this asset is published to the team's marketplace */
  isPublished: boolean;
  /** Explicit release state used for approval/publish/install governance */
  releaseStatus: ReleaseStatus;
  /** Latest security scan result (Phase 12) */
  lastScan?: {
    safe: boolean;
    findingCounts: { critical: number; high: number; medium: number; low: number };
    scannedAt: Date;
  };
  /** Provenance — chain of custody (Phase 12) */
  provenance?: {
    source: string;
    sourceUrl?: string;
    sourceAuthor?: string;
    sourceFingerprint?: string;
    importedBy?: string;
    recordedAt: Date;
  };
  /** User who added this asset */
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Type-Specific Extensions ────────────────────────────────

/** skill — teaches agent a capability (SKILL.md) */
export interface SkillAsset extends AssetBase {
  type: "skill";
}

/** agent — defines agent behavior/tools/model */
export interface AgentAsset extends AssetBase {
  type: "agent";
  agentConfig?: {
    model?: string;
    tools?: string[];
    allowedTools?: string[];
    memory?: boolean;
  };
}

/** rule — constrains agent behavior (CLAUDE.md, .cursorrules) */
export interface RuleAsset extends AssetBase {
  type: "rule";
  ruleConfig?: {
    scope?: "project" | "user" | "organization";
    targetTool?: string;
  };
}

/** Plugin manifest — describes a plugin bundle for marketplace distribution */
export interface PluginManifest {
  /** Semver version of this plugin bundle */
  version: string;
  /** Minimum tool version required (e.g., "claude-code@1.0.0") */
  compatibility?: string[];
  /** Other plugin names this depends on */
  dependencies?: string[];
  /** SHA256 of canonicalized metadata for change detection */
  fingerprint?: string;
  /** Changelog entries keyed by version */
  changelog?: Record<string, string>;
}

/** plugin — bundle of agent configs */
export interface PluginAsset extends AssetBase {
  type: "plugin";
  pluginConfig?: {
    /** Plugin manifest with versioning and compatibility */
    manifest?: PluginManifest;
    /** References to assets bundled in this plugin */
    bundledAssetIds?: ObjectId[];
  };
}

/** mcp_config — connects agent to external tools */
export interface McpConfigAsset extends AssetBase {
  type: "mcp_config";
  mcpConfig?: {
    transport?: "stdio" | "sse" | "http";
    serverDefs?: Record<string, unknown>[];
  };
}

/** hook — runs code on agent events */
export interface HookAsset extends AssetBase {
  type: "hook";
  hookConfig?: {
    events?: string[];
    scripts?: Record<string, unknown>[];
  };
}

/** settings_bundle — tool settings presets */
export interface SettingsBundleAsset extends AssetBase {
  type: "settings_bundle";
  settingsConfig?: {
    targetTool?: string;
    settings?: Record<string, unknown>;
  };
}

/** Discriminated union — TypeScript narrows on `type` field */
export type AssetDocument =
  | SkillAsset
  | AgentAsset
  | RuleAsset
  | PluginAsset
  | McpConfigAsset
  | HookAsset
  | SettingsBundleAsset;

/** Input for creating a new asset (without server-generated fields) */
export interface CreateAssetInput {
  type: AssetType;
  teamId: ObjectId;
  metadata: AssetMetadata;
  content: string;
  tags: string[];
  source?: AssetSource;
  isPublished?: boolean;
  releaseStatus?: ReleaseStatus;
  createdBy: ObjectId;
  /** Type-specific config — validated at runtime per type */
  agentConfig?: AgentAsset["agentConfig"];
  ruleConfig?: RuleAsset["ruleConfig"];
  pluginConfig?: PluginAsset["pluginConfig"];
  mcpConfig?: McpConfigAsset["mcpConfig"];
  hookConfig?: HookAsset["hookConfig"];
  settingsConfig?: SettingsBundleAsset["settingsConfig"];
}

/**
 * Build the searchText field for an asset.
 * Used by autoEmbed (ADR-010) and manual Voyage fallback.
 */
export function buildSearchText(
  name: string,
  description: string,
  content: string,
  tags: string[]
): string {
  const parts = [
    `Name: ${name}`,
    `Description: ${description}`,
    tags.length > 0 ? `Tags: ${tags.join(", ")}` : "",
    `Content:\n${content}`,
  ].filter(Boolean);
  return parts.join("\n\n");
}


/**
 * Generate a capability fingerprint (SHA256) for change detection.
 * Used by version management to detect if upstream has changed.
 */
export function generateFingerprint(metadata: AssetMetadata, content: string): string {
  const canonical = JSON.stringify({
    name: metadata.name,
    description: metadata.description,
    version: metadata.version ?? "",
    content: content.trim(),
  });
  return createHash("sha256").update(canonical).digest("hex");
}
