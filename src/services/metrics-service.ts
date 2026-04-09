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

interface MetricsComputationInput {
  assets: Array<Pick<AssetDocument, "lastScan" | "isPublished">>;
  activeUserCount: number;
  totalMembers: number;
  exportCount: number;
  previousMetrics?: GoalMetric[];
}

function buildMetrics(
  input: MetricsComputationInput
): GoalMetric[] {
  const prevMap = new Map(
    (input.previousMetrics ?? []).map((metric) => [metric.key, metric.current])
  );

  function trend(key: string, current: number): { trend: "up" | "down" | "flat"; trendDelta: number } {
    const prev = prevMap.get(key);
    if (prev === undefined) return { trend: "flat", trendDelta: 0 };
    const delta = current - prev;
    if (Math.abs(delta) < 0.5) return { trend: "flat", trendDelta: 0 };
    return { trend: delta > 0 ? "up" : "down", trendDelta: Math.round(delta * 10) / 10 };
  }

  const scannedCount = input.assets.filter((asset) => asset.lastScan != null).length;
  const scanPct = input.assets.length > 0 ? Math.round((scannedCount / input.assets.length) * 100) : 100;

  const trustAB = input.assets.filter((asset) => {
    if (!asset.lastScan) return false;
    return asset.lastScan.findingCounts.critical === 0 && asset.lastScan.findingCounts.high === 0;
  }).length;
  const trustPct = input.assets.length > 0 ? Math.round((trustAB / input.assets.length) * 100) : 100;

  const adoptionPct = input.totalMembers > 0
    ? Math.round((input.activeUserCount / input.totalMembers) * 100)
    : 0;

  return [
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
      current: input.exportCount,
      target: 20, floor: 5, stretch: 50,
      unit: "count",
      ...trend("exports_30d", input.exportCount),
    },
  ];
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

  // Parallel queries
  const [assets, activeUserCount, totalMembers, exportCount] = await Promise.all([
    db.collection<AssetDocument>("assets")
      .find({ teamId: { $in: teamIds } })
      .project({ lastScan: 1, isPublished: 1, createdAt: 1, updatedAt: 1 })
      .toArray() as Promise<Array<Pick<AssetDocument, "lastScan" | "isPublished">>>,
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

  return buildMetrics({
    assets,
    activeUserCount,
    totalMembers,
    exportCount,
    previousMetrics: prevSnapshot?.metrics,
  });
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
  const deptIds = departments.map((department) => department._id as ObjectId);
  const teams = await db.collection("teams")
    .find({ orgId, departmentId: { $in: deptIds } })
    .project({ _id: 1, departmentId: 1 })
    .toArray();
  const allTeamIds = teams.map((team) => team._id as ObjectId);

  if (allTeamIds.length === 0) {
    return departments.map((department) => ({
      departmentId: department._id.toHexString(),
      departmentName: department.name,
      teamCount: 0,
      assetCount: 0,
      metrics: [],
    }));
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [assets, recentAuditLogs, users, snapshots] = await Promise.all([
    db.collection<AssetDocument>("assets")
      .find({ teamId: { $in: allTeamIds } })
      .project({ teamId: 1, lastScan: 1, isPublished: 1 })
      .toArray(),
    db.collection("audit_logs")
      .find({ teamId: { $in: allTeamIds }, timestamp: { $gte: thirtyDaysAgo } })
      .project({ actorId: 1, teamId: 1, action: 1 })
      .toArray(),
    db.collection("users")
      .find({ "teamMemberships.teamId": { $in: allTeamIds } })
      .project({ teamMemberships: 1 })
      .toArray(),
    db.collection<MetricsSnapshot>("metrics_snapshots")
      .find({ scopeType: "department", scopeId: { $in: deptIds } })
      .sort({ takenAt: -1 })
      .toArray(),
  ]);

  const deptTeamIds = new Map<string, ObjectId[]>();
  for (const team of teams) {
    const departmentId = (team.departmentId as ObjectId).toHexString();
    const existing = deptTeamIds.get(departmentId) ?? [];
    existing.push(team._id as ObjectId);
    deptTeamIds.set(departmentId, existing);
  }

  const assetsByTeamId = new Map<string, Array<Pick<AssetDocument, "lastScan" | "isPublished">>>();
  for (const asset of assets) {
    const key = asset.teamId.toHexString();
    const existing = assetsByTeamId.get(key) ?? [];
    existing.push({ lastScan: asset.lastScan, isPublished: asset.isPublished });
    assetsByTeamId.set(key, existing);
  }

  const logsByTeamId = new Map<string, Array<{ actorId: ObjectId; action: string }>>();
  for (const log of recentAuditLogs) {
    const key = (log.teamId as ObjectId).toHexString();
    const existing = logsByTeamId.get(key) ?? [];
    existing.push({ actorId: log.actorId as ObjectId, action: String(log.action) });
    logsByTeamId.set(key, existing);
  }

  const latestSnapshotByDeptId = new Map<string, MetricsSnapshot>();
  for (const snapshot of snapshots) {
    const key = snapshot.scopeId.toHexString();
    if (!latestSnapshotByDeptId.has(key)) {
      latestSnapshotByDeptId.set(key, snapshot);
    }
  }

  return departments.map((department) => {
    const departmentId = department._id.toHexString();
    const teamIds = deptTeamIds.get(departmentId) ?? [];
    const teamIdSet = new Set(teamIds.map((teamId) => teamId.toHexString()));

    const departmentAssets = teamIds.flatMap((teamId) => assetsByTeamId.get(teamId.toHexString()) ?? []);
    const departmentLogs = teamIds.flatMap((teamId) => logsByTeamId.get(teamId.toHexString()) ?? []);
    const activeUsers = new Set(departmentLogs.map((log) => log.actorId.toHexString()));
    const exportCount = departmentLogs.filter((log) => log.action === "asset:export").length;
    const totalMembers = users.filter((user) =>
      (user.teamMemberships as Array<{ teamId: ObjectId }> | undefined)?.some((membership) =>
        teamIdSet.has(membership.teamId.toHexString())
      )
    ).length;

    return {
      departmentId,
      departmentName: department.name,
      teamCount: teamIds.length,
      assetCount: departmentAssets.length,
      metrics: buildMetrics({
        assets: departmentAssets,
        activeUserCount: activeUsers.size,
        totalMembers,
        exportCount,
        previousMetrics: latestSnapshotByDeptId.get(departmentId)?.metrics,
      }),
    };
  });
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
