/**
 * Proactive Suggestions — generates contextual suggestions based on team state.
 *
 * Checks team health signals (scan coverage, trust grades, asset gaps)
 * and produces actionable suggestions for the copilot to surface.
 */

import { ObjectId, type Db } from "mongodb";

// ─── Types ─────────────────────────────────────────────────

export interface ProactiveSuggestion {
  id: string;
  priority: "high" | "medium" | "low";
  category: "security" | "coverage" | "adoption" | "quality";
  title: string;
  description: string;
  action?: string;
}

// ─── Suggestion Engine ────────────────────────────────────

/**
 * Generate proactive suggestions based on team state.
 * Checks: scan coverage, trust grades, empty asset types, low adoption.
 */
export async function generateProactiveSuggestions(
  db: Db,
  teamId: ObjectId
): Promise<ProactiveSuggestion[]> {
  const suggestions: ProactiveSuggestion[] = [];

  // Parallel queries
  const [assets, recentActivity] = await Promise.all([
    db.collection("assets")
      .find({ teamId })
      .project({ type: 1, lastScan: 1, isPublished: 1 })
      .toArray(),
    db.collection("audit_logs")
      .countDocuments({ teamId, timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }),
  ]);

  const totalAssets = assets.length;

  // 1. Unscanned assets
  const unscanned = assets.filter((a) => !a.lastScan);
  if (unscanned.length > 0) {
    const pct = Math.round((unscanned.length / Math.max(totalAssets, 1)) * 100);
    suggestions.push({
      id: "scan_coverage",
      priority: pct > 50 ? "high" : "medium",
      category: "security",
      title: `${unscanned.length} unscanned asset${unscanned.length > 1 ? "s" : ""}`,
      description: `${pct}% of your assets haven't been security scanned. Run scans to detect vulnerabilities.`,
      action: "Scan all unscanned assets",
    });
  }

  // 2. High-risk assets (critical/high findings)
  const risky = assets.filter((a) =>
    a.lastScan && (a.lastScan.findingCounts.critical > 0 || a.lastScan.findingCounts.high > 0)
  );
  if (risky.length > 0) {
    suggestions.push({
      id: "trust_risk",
      priority: "high",
      category: "security",
      title: `${risky.length} asset${risky.length > 1 ? "s" : ""} with critical/high findings`,
      description: "These assets have security issues that should be addressed before publishing.",
      action: "Review flagged assets",
    });
  }

  // 3. Missing asset types
  const presentTypes = new Set(assets.map((a) => a.type));
  const allTypes = ["skill", "rule", "agent", "mcp_config", "hook", "settings_bundle", "plugin"];
  const coreTypes = ["skill", "rule", "agent"];
  const missingCore = coreTypes.filter((t) => !presentTypes.has(t));
  if (missingCore.length > 0 && totalAssets > 0) {
    suggestions.push({
      id: "missing_types",
      priority: "low",
      category: "coverage",
      title: `Missing ${missingCore.join(", ")} assets`,
      description: `Your team has ${presentTypes.size} of ${allTypes.length} asset types. Adding ${missingCore[0]}s could improve coverage.`,
      action: `Create a ${missingCore[0]}`,
    });
  }

  // 4. Low activity
  if (recentActivity < 3 && totalAssets > 0) {
    suggestions.push({
      id: "low_activity",
      priority: "medium",
      category: "adoption",
      title: "Low team activity this week",
      description: `Only ${recentActivity} event${recentActivity !== 1 ? "s" : ""} in the last 7 days. Consider reviewing and updating your assets.`,
    });
  }

  // 5. No published assets
  const published = assets.filter((a) => a.isPublished);
  if (totalAssets > 0 && published.length === 0) {
    suggestions.push({
      id: "no_published",
      priority: "medium",
      category: "quality",
      title: "No published assets",
      description: "None of your assets are published. Publishing makes them available for the team to install.",
      action: "Publish your first asset",
    });
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return suggestions;
}
