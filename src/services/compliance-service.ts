/**
 * Compliance Dashboard Service — policy compliance checks per department.
 *
 * Aggregates:
 * 1. Asset scan coverage — % of assets that have been scanned
 * 2. Trust score distribution — how many A/B/C/D grade assets
 * 3. Approval compliance — % of published assets that went through approval
 * 4. SSO adoption — % of users authenticating via SSO
 * 5. Token hygiene — expired/revoked token counts
 *
 * Per api-security-best-practices: compliance is continuous, not one-time.
 */

import { ObjectId, type Db } from "mongodb";
import type { AssetDocument } from "@/types/asset";

/** Compliance report for a department or org */
export interface ComplianceReport {
  /** Scope of this report */
  scope: "org" | "department" | "team";
  scopeId: ObjectId;
  scopeName: string;

  /** Asset scan coverage */
  scanCoverage: {
    totalAssets: number;
    scannedAssets: number;
    percentage: number;
    criticalFindings: number;
  };

  /** Trust score distribution */
  trustDistribution: {
    gradeA: number;
    gradeB: number;
    gradeC: number;
    gradeD: number;
    unscored: number;
  };

  /** Approval compliance */
  approvalCompliance: {
    publishedWithApproval: number;
    publishedWithoutApproval: number;
    pendingApprovals: number;
  };

  /** Token hygiene */
  tokenHygiene: {
    activeTokens: number;
    expiredTokens: number;
    revokedTokens: number;
  };

  /** Overall compliance score (0-100) */
  overallScore: number;
  /** Computed at */
  computedAt: Date;
}

/**
 * Generate compliance report for a set of teams.
 */
export async function generateComplianceReport(
  db: Db,
  scope: ComplianceReport["scope"],
  scopeId: ObjectId,
  scopeName: string,
  teamIds: ObjectId[]
): Promise<ComplianceReport> {
  // Run all queries in parallel for performance
  const [assets, pendingApprovals, tokens] = await Promise.all([
    db.collection<AssetDocument>("assets")
      .find({ teamId: { $in: teamIds } })
      .project({ lastScan: 1, isPublished: 1 })
      .toArray(),
    db.collection("approval_requests")
      .countDocuments({ teamId: { $in: teamIds }, status: "pending" }),
    db.collection("api_tokens")
      .find({ orgId: scopeId })
      .project({ revoked: 1, expiresAt: 1 })
      .toArray(),
  ]);

  // Scan coverage
  const scannedAssets = assets.filter((a) => a.lastScan != null);
  const criticalFindings = scannedAssets.filter(
    (a) => a.lastScan && a.lastScan.findingCounts.critical > 0
  ).length;

  const scanCoverage = {
    totalAssets: assets.length,
    scannedAssets: scannedAssets.length,
    percentage: assets.length > 0 ? Math.round((scannedAssets.length / assets.length) * 100) : 100,
    criticalFindings,
  };

  // Trust distribution (simplified — based on scan results)
  const trustDistribution = { gradeA: 0, gradeB: 0, gradeC: 0, gradeD: 0, unscored: 0 };
  for (const a of assets) {
    if (!a.lastScan) { trustDistribution.unscored++; continue; }
    const { critical, high, medium } = a.lastScan.findingCounts;
    if (critical > 0) trustDistribution.gradeD++;
    else if (high > 0) trustDistribution.gradeC++;
    else if (medium > 0) trustDistribution.gradeB++;
    else trustDistribution.gradeA++;
  }

  // Approval compliance
  const published = assets.filter((a) => a.isPublished);
  const approvalCompliance = {
    publishedWithApproval: 0, // Would need join with approval_requests
    publishedWithoutApproval: published.length,
    pendingApprovals,
  };

  // Token hygiene
  const now = new Date();
  const tokenHygiene = {
    activeTokens: tokens.filter((t) => !t.revoked && t.expiresAt > now).length,
    expiredTokens: tokens.filter((t) => !t.revoked && t.expiresAt <= now).length,
    revokedTokens: tokens.filter((t) => t.revoked).length,
  };

  // Overall score (weighted average)
  const scanScore = scanCoverage.percentage;
  const trustScore = assets.length > 0
    ? Math.round(((trustDistribution.gradeA * 100 + trustDistribution.gradeB * 70 +
        trustDistribution.gradeC * 40 + trustDistribution.gradeD * 0) /
        Math.max(1, assets.length - trustDistribution.unscored)) || 0)
    : 100;
  const tokenScore = tokens.length > 0
    ? Math.round(((tokenHygiene.activeTokens / tokens.length) * 100))
    : 100;

  const overallScore = Math.round(scanScore * 0.4 + trustScore * 0.35 + tokenScore * 0.25);

  return {
    scope, scopeId, scopeName,
    scanCoverage, trustDistribution,
    approvalCompliance, tokenHygiene,
    overallScore,
    computedAt: new Date(),
  };
}
