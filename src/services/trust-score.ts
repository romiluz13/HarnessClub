/**
 * Trust Score Engine — composite reputation metric for assets.
 *
 * Trust Score = weighted formula of:
 * 1. Security scan result (30%) — clean scan = high trust
 * 2. Provenance signal (25%) — verified source > unknown origin
 * 3. Usage metrics (15%) — installs/views as social proof
 * 4. Asset age (10%) — older + maintained = more trusted
 * 5. Author reputation (10%) — org-verified author > anonymous
 * 6. Update recency (10%) — recently updated = maintained
 *
 * Per api-security-best-practices: trust is defense-in-depth metric,
 * not a binary gate. Used for visual indicators + approval thresholds.
 */

import type { AssetDocument } from "@/types/asset";

/** Trust grade — A (highest) through D (lowest) */
export type TrustGrade = "A" | "B" | "C" | "D";

/** Provenance source — how was this asset created/imported */
export type ProvenanceSource =
  | "manual"           // Typed in directly
  | "github_import"    // Imported from GitHub repo
  | "url_import"       // Imported from URL
  | "template"         // Generated from department template
  | "marketplace"      // Installed from marketplace
  | "fork"             // Forked from another asset
  | "unknown";         // Legacy or untracked

/** Provenance record — chain of custody for an asset */
export interface ProvenanceRecord {
  source: ProvenanceSource;
  /** Original source URL (e.g., GitHub repo URL) */
  sourceUrl?: string;
  /** Original author/org if known */
  sourceAuthor?: string;
  /** SHA of the source at time of import */
  sourceFingerprint?: string;
  /** Who imported/created this */
  importedBy?: string;
  /** When this provenance was recorded */
  recordedAt: Date;
}

/** Full trust score breakdown */
export interface TrustScore {
  /** Overall score 0-100 */
  overall: number;
  /** Visual grade */
  grade: TrustGrade;
  /** Component scores */
  components: {
    security: number;
    provenance: number;
    usage: number;
    age: number;
    author: number;
    recency: number;
  };
  /** Computed at */
  computedAt: Date;
}

// ─── Score Computation ──────────────────────────────────────

const WEIGHTS = {
  security: 0.30,
  provenance: 0.25,
  usage: 0.15,
  age: 0.10,
  author: 0.10,
  recency: 0.10,
};

function scoreGrade(score: number): TrustGrade {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  return "D";
}

function securityScore(asset: AssetDocument): number {
  if (!asset.lastScan) return 50; // No scan = neutral
  if (asset.lastScan.findingCounts.critical > 0) return 0;
  if (asset.lastScan.findingCounts.high > 0) return 20;
  if (asset.lastScan.findingCounts.medium > 0) return 60;
  if (asset.lastScan.findingCounts.low > 0) return 80;
  return 100; // Clean scan
}

function provenanceScore(provenance?: ProvenanceRecord): number {
  if (!provenance) return 20; // Unknown
  const scores: Record<ProvenanceSource, number> = {
    template: 100,        // Org-generated template = highest trust
    marketplace: 80,      // From curated marketplace
    github_import: 70,    // Verifiable source
    fork: 60,             // Derived from known asset
    url_import: 40,       // URL = less verifiable
    manual: 30,           // Manually typed = least provenance
    unknown: 20,          // Legacy
  };
  let score = scores[provenance.source] ?? 20;
  if (provenance.sourceFingerprint) score = Math.min(100, score + 10);
  if (provenance.sourceUrl) score = Math.min(100, score + 5);
  return score;
}

function usageScore(stats: AssetDocument["stats"]): number {
  const total = stats.installCount + stats.viewCount;
  if (total >= 1000) return 100;
  if (total >= 100) return 80;
  if (total >= 10) return 50;
  return 20;
}

function ageScore(createdAt: Date): number {
  const daysOld = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysOld >= 180) return 100; // 6+ months
  if (daysOld >= 30) return 70;
  if (daysOld >= 7) return 40;
  return 20; // Very new
}

function authorScore(asset: AssetDocument): number {
  // Future: check author verification status, org membership
  // For now: published = more trusted (org approved)
  return asset.isPublished ? 80 : 40;
}

function recencyScore(updatedAt: Date): number {
  const daysSinceUpdate = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceUpdate <= 7) return 100;
  if (daysSinceUpdate <= 30) return 80;
  if (daysSinceUpdate <= 90) return 60;
  if (daysSinceUpdate <= 365) return 40;
  return 20; // Stale
}

/**
 * Compute trust score for an asset.
 */
export function computeTrustScore(
  asset: AssetDocument,
  provenance?: ProvenanceRecord
): TrustScore {
  const components = {
    security: securityScore(asset),
    provenance: provenanceScore(provenance),
    usage: usageScore(asset.stats),
    age: ageScore(asset.createdAt),
    author: authorScore(asset),
    recency: recencyScore(asset.updatedAt),
  };

  const overall = Math.round(
    components.security * WEIGHTS.security +
    components.provenance * WEIGHTS.provenance +
    components.usage * WEIGHTS.usage +
    components.age * WEIGHTS.age +
    components.author * WEIGHTS.author +
    components.recency * WEIGHTS.recency
  );

  return {
    overall,
    grade: scoreGrade(overall),
    components,
    computedAt: new Date(),
  };
}
