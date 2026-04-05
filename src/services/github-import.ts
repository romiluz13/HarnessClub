/**
 * GitHub asset import service — V2 with parser registry.
 *
 * Scans repos for ALL 11 known config formats via parser registry.
 * Supports single file import and batch repo scanning.
 *
 * Per ADR-010: Uses dual-mode embedding (autoEmbed M10+ / manual M0).
 * Per Phase 9: Parser registry handles format detection + parsing.
 */

import { ObjectId, type Db } from "mongodb";
import type { AssetType } from "@/types/asset";
import { buildSearchText } from "@/types/asset";
import { embedAsset } from "@/services/embedding-pipeline";
import { detectSearchMode, needsManualEmbedding } from "@/lib/search-mode";
import { parseFile } from "@/services/parsers";
import type { ParsedAsset } from "@/services/parsers";
import { scanContent } from "@/services/security-scanner";

export interface ImportResult {
  assetId: ObjectId;
  name: string;
  type: AssetType;
  format?: string;
  success: boolean;
  error?: string;
  /** Security scan warnings (if any) */
  securityWarnings?: string[];
  /** @deprecated Use assetId */
  skillId?: ObjectId;
}

export interface GitHubImportOptions {
  repoUrl: string;
  ref?: string;
  teamId: ObjectId;
  importedBy: ObjectId;
  /** Override the detected asset type */
  assetType?: AssetType;
  /** Import a specific file path instead of scanning */
  filePath?: string;
}

export interface ImportResult {
  assetId: ObjectId;
  name: string;
  type: AssetType;
  format?: string;
  success: boolean;
  error?: string;
  /** @deprecated Use assetId */
  skillId?: ObjectId;
}

/** All file patterns to scan in a repo — ordered by priority */
const SCAN_PATTERNS = [
  "SKILL.md",
  "AGENTS.md",
  "CLAUDE.md",
  ".cursorrules",
  ".windsurfrules",
  ".github/copilot-instructions.md",
  ".mcp.json",
  "mcp.json",
  "hooks.json",
  "plugin.json",
  ".claude-plugin/marketplace.json",
  // Cursor MDC rules — check a few common names
  ".cursor/rules/rules.mdc",
  ".cursor/rules/main.mdc",
];

/**
 * Import a single asset from a GitHub repository.
 * Uses parser registry (Phase 9) for format detection + parsing.
 */
export async function importFromGitHub(
  db: Db,
  options: GitHubImportOptions
): Promise<ImportResult> {
  const { repoUrl, ref = "main", teamId, importedBy, assetType, filePath } = options;
  const repo = extractRepoPath(repoUrl);

  if (!repo) {
    return { assetId: new ObjectId(), name: "", type: "skill", success: false, error: "Invalid GitHub URL" };
  }

  // Fetch content — either specific file or scan patterns
  let content: string | null = null;
  let foundFile = "";

  if (filePath) {
    // Import a specific file
    content = await fetchGitHubFile(repo, ref, filePath);
    if (content) foundFile = filePath;
  } else {
    // Scan all known patterns
    for (const pattern of SCAN_PATTERNS) {
      content = await fetchGitHubFile(repo, ref, pattern);
      if (content) {
        foundFile = pattern;
        break;
      }
    }
  }

  if (!content || !foundFile) {
    return {
      assetId: new ObjectId(),
      name: "",
      type: "skill",
      success: false,
      error: "No asset file found in repository",
    };
  }

  // Use parser registry for format detection + parsing (Phase 9)
  return createAssetFromParsed(db, repo, ref, foundFile, content, teamId, importedBy, assetType);
}

/**
 * Batch scan a GitHub repo and import ALL detected config files.
 * Returns results for each found file.
 */
export async function batchImportFromGitHub(
  db: Db,
  options: Omit<GitHubImportOptions, "filePath">
): Promise<ImportResult[]> {
  const { repoUrl, ref = "main", teamId, importedBy } = options;
  const repo = extractRepoPath(repoUrl);

  if (!repo) {
    return [{ assetId: new ObjectId(), name: "", type: "skill", success: false, error: "Invalid GitHub URL" }];
  }

  // Fetch all patterns in parallel (fast — most will 404)
  const fetches = SCAN_PATTERNS.map(async (pattern) => {
    const content = await fetchGitHubFile(repo, ref, pattern);
    return content ? { pattern, content } : null;
  });

  const results = await Promise.all(fetches);
  const found = results.filter((r): r is { pattern: string; content: string } => r !== null);

  if (found.length === 0) {
    return [{ assetId: new ObjectId(), name: "", type: "skill", success: false, error: "No config files found in repository" }];
  }

  // Import each found file
  const importResults: ImportResult[] = [];
  for (const { pattern, content } of found) {
    const result = await createAssetFromParsed(db, repo, ref, pattern, content, teamId, importedBy);
    importResults.push(result);
  }

  return importResults;
}

/** Fetch a single file from GitHub raw content */
async function fetchGitHubFile(repo: string, ref: string, path: string): Promise<string | null> {
  try {
    const rawUrl = `https://raw.githubusercontent.com/${repo}/${ref}/${path}`;
    const response = await fetch(rawUrl, {
      headers: { "User-Agent": "AgentConfig/2.0" },
    });
    if (response.ok) return response.text();
    return null;
  } catch {
    return null;
  }
}

/** Create an asset document from parser output */
async function createAssetFromParsed(
  db: Db,
  repo: string,
  ref: string,
  foundFile: string,
  content: string,
  teamId: ObjectId,
  importedBy: ObjectId,
  overrideType?: AssetType
): Promise<ImportResult> {
  // Security scan BEFORE parsing/importing
  const scan = scanContent(content);
  if (!scan.safe) {
    const criticals = scan.findings.filter((f) => f.severity === "critical");
    return {
      assetId: new ObjectId(),
      name: foundFile,
      type: "skill",
      success: false,
      error: `Security scan blocked import: ${criticals.map((f) => f.message).join("; ")}`,
    };
  }

  // Use parser registry for format detection + parsing
  let parsed: ParsedAsset;
  try {
    parsed = parseFile(foundFile, content);
  } catch {
    parsed = {
      format: "skill.md",
      assetType: "skill",
      metadata: { name: foundFile, description: `Imported from ${repo}` },
      content,
      tags: [],
      sourceTool: "unknown",
    };
  }

  // Collect non-critical warnings
  const securityWarnings = scan.findings
    .filter((f) => f.severity !== "critical")
    .map((f) => `[${f.severity}] ${f.message} (line ${f.line})`);

  const assetType = overrideType ?? parsed.assetType;
  const { name, description } = parsed.metadata;
  const tags = parsed.tags;
  const searchText = buildSearchText(name, description, content, tags);

  const now = new Date();
  const doc = {
    _id: new ObjectId(),
    type: assetType,
    teamId,
    metadata: {
      name,
      description,
      author: parsed.metadata.author ?? repo.split("/")[0],
      version: parsed.metadata.version ?? "1.0.0",
      license: parsed.metadata.license,
    },
    content,
    tags,
    searchText,
    source: {
      repoUrl: `https://github.com/${repo}`,
      path: foundFile,
      commitHash: ref,
      lastSyncedAt: now,
    },
    stats: { installCount: 0, viewCount: 0 },
    isPublished: false,
    createdAt: now,
    updatedAt: now,
    createdBy: importedBy,
    // Spread type-specific config
    ...(parsed.typeConfig || {}),
  };

  await db.collection("assets").insertOne(doc);

  // Embed if manual mode (M0/local) — ADR-010
  const mode = await detectSearchMode(db);
  if (needsManualEmbedding(mode)) {
    try {
      await embedAsset(db, doc._id, name, description, content, tags);
    } catch (err) {
      console.warn(`Embedding failed for asset ${name}:`, err);
    }
  }

  const assetId = doc._id;
  return {
    assetId, skillId: assetId, name, type: assetType, format: parsed.format,
    success: true,
    securityWarnings: securityWarnings.length > 0 ? securityWarnings : undefined,
  };
}

/** Extract "owner/repo" from various GitHub URL formats */
function extractRepoPath(url: string): string | null {
  const patterns = [
    /github\.com[/:]([^/]+\/[^/.]+)/,
    /^([a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+)$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1].replace(/\.git$/, "");
  }
  return null;
}
