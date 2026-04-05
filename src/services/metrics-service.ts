/**
 * Metrics & Adoption Service — KPI tracking with trend snapshots.
 *
 * Inspired by Cabinet's goal-manager.ts — GoalMetric with floor/stretch targets.
 * Aggregates from assets, audit_logs, users, scans for team/dept/org metrics.
 *
 * Per mongodb-query-optimizer: parallel queries, indexed fields only.
 * Per mongodb-schema-design: separate snapshots collection for time series.
 */

import { ObjectId, type Db } from "mongodb";
import type { AssetDocument } from "@/types/asset";

// ─── Types ─────────────────────────────────────────────────

/** A single KPI metric with target thresholds */
export interface GoalMetric {
  key: string;
  label: string;
  current: number;
  target: number;
  floor: number;
  stretch: number;
  unit: "%" | "count" | "score";
  trend: "up" | "down" | "flat";
  trendDelta: number;
}

/** Metrics snapshot for trend storage */
export interface MetricsSnapshot {
  _id: ObjectId;
  scopeType: "team" | "department" | "org";
  scopeId: ObjectId;
  metrics: GoalMetric[];
  takenAt: Date;
}

/** Full metrics report */
export interface MetricsReport {
  scope: "team" | "department" | "org";
  scopeId: string;
  scopeName: string;
  metrics: GoalMetric[];
  trend: MetricsSnapshot[];
  computedAt: string;
}

// ─── Metric Computation ───────────────────────────────────

/**
 * Compute KPI metrics for a set of teams.
 */
export async function computeMetrics(
  db: Db,
  scopeType: "team" | "department" | "org",
  scopeId: ObjectId,
  teamIds: ObjectId[]
): Promise<GoalMetric[]> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Parallel queries
  const [assets, recentAuditCount, activeUserCount, totalMembers, exportCount] = await Promise.all([
    db.collection<AssetDocument>("assets")
      .find({ teamId: { $in: teamIds } })
      .project({ lastScan: 1, isPublished: 1, createdAt: 1, updatedAt: 1 })
      .toArray(),
    db.collection("audit_logs").countDocuments({
      teamId: { $in: teamIds },
      timestamp: { $gte: sevenDaysAgo },
    }),
    db.collection("audit_logs").aggregate([
      { $match: { teamId: { $in: teamIds }, timestamp: { $gte: thirtyDaysAgo } } },
      { $group: { _id: "$actorId" } },
      { $count: "total" },
    ]).toArray().then((r) => r[0]?.total ?? 0),
    db.collection("users").countDocuments({
      "teamMemberships.teamId": { $in: teamIds },
    }),
    db.collection("audit_logs").countDocuments({
      teamId: { $in: teamIds },
      action: "asset:export",
      timestamp: { $gte: thirtyDaysAgo },
    }),
  ]);

  // Get previous snapshot for trend comparison
  const prevSnapshot = await db.collection<MetricsSnapshot>("metrics_snapshots")
    .findOne({ scopeType, scopeId }, { sort: { takenAt: -1 } });
  const prevMap = new Map(
    (prevSnapshot?.metrics ?? []).map((m) => [m.key, m.current])
  );

  function trend(key: string, current: number): { trend: "up" | "down" | "flat"; trendDelta: number } {
    const prev = prevMap.get(key);
    if (prev === undefined) return { trend: "flat", trendDelta: 0 };
    const delta = current - prev;
    if (Math.abs(delta) < 0.5) return { trend: "flat", trendDelta: 0 };
    return { trend: delta > 0 ? "up" : "down", trendDelta: Math.round(delta * 10) / 10 };
  }

  // ── Compute each metric ──

  // 1. Scan Coverage %
  const scannedCount = assets.filter((a) => a.lastScan != null).length;
  const scanPct = assets.length > 0 ? Math.round((scannedCount / assets.length) * 100) : 100;

  // 2. Trust A/B rate %
  const trustAB = assets.filter((a) => {
    if (!a.lastScan) return false;
    return a.lastScan.findingCounts.critical === 0 && a.lastScan.findingCounts.high === 0;
  }).length;
  const trustPct = assets.length > 0 ? Math.round((trustAB / assets.length) * 100) : 100;

  // 3. Adoption rate (active users / total members)
  const adoptionPct = totalMembers > 0
    ? Math.round((activeUserCount / totalMembers) * 100) : 0;

  // 4. Export count (30d)
  // 5. Asset growth (new assets in 30d)
  const newAssets = assets.filter((a) => a.createdAt >= thirtyDaysAgo).length;

  // 6. Weekly activity (audit events per 7d)

  const metrics: GoalMetric[] = [
    {
      key: "scan_coverage",
      label: "Scan Coverage",
      current: scanPct,
      target: 90, floor: 70, stretch: 100,
      unit: "%",
      ...trend("scan_coverage", scanPct),
    },
    {
      key: "trust_ab_rate",
      label: "Trust A/B Rate",
      current: trustPct,
      target: 80, floor: 60, stretch: 95,
      unit: "%",
      ...trend("trust_ab_rate", trustPct),
    },
    {
      key: "adoption_rate",
      label: "Adoption Rate",
      current: adoptionPct,
      target: 75, floor: 50, stretch: 90,
      unit: "%",
      ...trend("adoption_rate", adoptionPct),
    },
    {
      key: "exports_30d",
      label: "Exports (30d)",
      current: exportCount,
      target: 20, floor: 5, stretch: 50,
      unit: "count",
      ...trend("exports_30d", exportCount),
    },
  ];

  return metrics;
}

// ─── Trend Snapshots ──────────────────────────────────────

/**
 * Take a metrics snapshot for trend tracking.
 * Stores current metric values with timestamp.
 */
export async function takeSnapshot(
  db: Db,
  scopeType: MetricsSnapshot["scopeType"],
  scopeId: ObjectId,
  metrics: GoalMetric[]
): Promise<ObjectId> {
  const doc: Omit<MetricsSnapshot, "_id"> = {
    scopeType,
    scopeId,
    metrics,
    takenAt: new Date(),
  };
  const result = await db.collection("metrics_snapshots").insertOne(doc);
  return result.insertedId;
}

/**
 * Get trend snapshots for sparkline rendering.
 * Returns snapshots sorted oldest → newest.
 */
export async function getTrend(
  db: Db,
  scopeType: MetricsSnapshot["scopeType"],
  scopeId: ObjectId,
  weeks: number = 8
): Promise<MetricsSnapshot[]> {
  const since = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000);
  return db.collection<MetricsSnapshot>("metrics_snapshots")
    .find({ scopeType, scopeId, takenAt: { $gte: since } })
    .sort({ takenAt: 1 })
    .limit(weeks)
    .toArray();
}

/**
 * Auto-snapshot: takes a snapshot if the most recent one is older than 7 days.
 * Called by the metrics API to ensure trend data is always fresh.
 */
export async function autoSnapshot(
  db: Db,
  scopeType: MetricsSnapshot["scopeType"],
  scopeId: ObjectId,
  metrics: GoalMetric[]
): Promise<void> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recent = await db.collection<MetricsSnapshot>("metrics_snapshots")
    .findOne(
      { scopeType, scopeId, takenAt: { $gte: sevenDaysAgo } },
      { sort: { takenAt: -1 } }
    );
  if (!recent) {
    await takeSnapshot(db, scopeType, scopeId, metrics);
  }
}

// ─── Department Comparison ────────────────────────────────

/** Department metrics summary for comparison */
export interface DepartmentMetrics {
  departmentId: string;
  departmentName: string;
  teamCount: number;
  assetCount: number;
  metrics: GoalMetric[];
}

/**
 * Compare metrics across all departments in an org.
 */
export async function compareDepartments(
  db: Db,
  orgId: ObjectId
): Promise<DepartmentMetrics[]> {
  const departments = await db.collection("departments")
    .find({ orgId })
    .project({ name: 1 })
    .toArray();

  if (departments.length === 0) return [];

  const results = await Promise.all(
    departments.map(async (dept) => {
      const teams = await db.collection("teams")
        .find({ departmentId: dept._id })
        .project({ _id: 1 })
        .toArray();
      const teamIds = teams.map((t) => t._id);

      const assetCount = teamIds.length > 0
        ? await db.collection("assets").countDocuments({ teamId: { $in: teamIds } })
        : 0;

      const metrics = teamIds.length > 0
        ? await computeMetrics(db, "department", dept._id, teamIds)
        : [];

      return {
        departmentId: dept._id.toHexString(),
        departmentName: dept.name,
        teamCount: teams.length,
        assetCount,
        metrics,
      };
    })
  );

  return results;
}

/**
 * Full metrics report — metrics + trend + auto-snapshot.
 */
export async function getMetricsReport(
  db: Db,
  scopeType: MetricsSnapshot["scopeType"],
  scopeId: ObjectId,
  scopeName: string,
  teamIds: ObjectId[]
): Promise<MetricsReport> {
  const metrics = await computeMetrics(db, scopeType, scopeId, teamIds);

  // Auto-snapshot for trend data
  await autoSnapshot(db, scopeType, scopeId, metrics);

  // Get trend data
  const trendData = await getTrend(db, scopeType, scopeId, 8);

  return {
    scope: scopeType,
    scopeId: scopeId.toHexString(),
    scopeName,
    metrics,
    trend: trendData,
    computedAt: new Date().toISOString(),
  };
}
