/**
 * E2E Tests — Phase 19: Agent Goals & Adoption Metrics
 *
 * Real MongoDB, real services, zero mocks.
 * Tests: computeMetrics, snapshots, trends, department comparison, floor alerts.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ObjectId, type Db } from "mongodb";
import { getTestDb, closeTestDb } from "../helpers/db-setup";
import {
  computeMetrics,
  takeSnapshot,
  getTrend,
  autoSnapshot,
  compareDepartments,
  getMetricsReport,
} from "@/services/metrics-service";

let db: Db;
const MARKER = `metrics-${Date.now()}`;
const orgId = new ObjectId();
const deptId = new ObjectId();
const teamId = new ObjectId();
const userId = new ObjectId();

beforeAll(async () => {
  db = await getTestDb();

  // Seed: org, department, team, users, assets, audit logs
  await db.collection("users").insertOne({
    _id: userId,
    email: `metrics-user-${MARKER}@test.com`,
    name: "Metrics User",
    auth: { provider: "github", providerId: `metrics-${MARKER}` },
    teamMemberships: [{ teamId }],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.collection("departments").insertOne({
    _id: deptId,
    orgId,
    name: `Metrics Dept ${MARKER}`,
    createdAt: new Date(),
  });

  await db.collection("teams").insertOne({
    _id: teamId,
    orgId,
    departmentId: deptId,
    name: `Metrics Team ${MARKER}`,
    slug: `metrics-team-${MARKER}`,
    memberIds: [userId],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // 4 assets: 2 scanned clean, 1 scanned with findings, 1 unscanned
  const now = new Date();
  await db.collection("assets").insertMany([
    {
      _id: new ObjectId(), type: "skill", teamId,
      metadata: { name: `Clean Skill ${MARKER}`, description: "Clean" },
      content: "# Clean", tags: [], stats: { installCount: 5, viewCount: 10 },
      isPublished: true, createdBy: userId, createdAt: now, updatedAt: now,
      lastScan: { scannedAt: now, findingCounts: { critical: 0, high: 0, medium: 0, low: 0, info: 0 }, findings: [] },
    },
    {
      _id: new ObjectId(), type: "rule", teamId,
      metadata: { name: `Clean Rule ${MARKER}`, description: "Clean" },
      content: "# Clean", tags: [], stats: { installCount: 0, viewCount: 0 },
      isPublished: true, createdBy: userId, createdAt: now, updatedAt: now,
      lastScan: { scannedAt: now, findingCounts: { critical: 0, high: 0, medium: 1, low: 0, info: 0 }, findings: [] },
    },
    {
      _id: new ObjectId(), type: "agent", teamId,
      metadata: { name: `Risky Agent ${MARKER}`, description: "Risky" },
      content: "# Risky", tags: [], stats: { installCount: 0, viewCount: 0 },
      isPublished: false, createdBy: userId, createdAt: now, updatedAt: now,
      lastScan: { scannedAt: now, findingCounts: { critical: 2, high: 1, medium: 0, low: 0, info: 0 }, findings: [] },
    },
    {
      _id: new ObjectId(), type: "skill", teamId,
      metadata: { name: `Unscanned ${MARKER}`, description: "No scan" },
      content: "# No scan", tags: [], stats: { installCount: 0, viewCount: 0 },
      isPublished: false, createdBy: userId, createdAt: now, updatedAt: now,
    },
  ]);

  // Seed audit events for adoption + exports
  const recent = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  await db.collection("audit_logs").insertMany([
    { _id: new ObjectId(), actorId: userId, action: "asset:create", targetId: new ObjectId(), teamId, orgId, timestamp: recent },
    { _id: new ObjectId(), actorId: userId, action: "asset:export", targetId: new ObjectId(), teamId, orgId, timestamp: recent },
    { _id: new ObjectId(), actorId: userId, action: "asset:export", targetId: new ObjectId(), teamId, orgId, timestamp: recent },
  ]);
});

afterAll(async () => {
  await Promise.all([
    db.collection("users").deleteMany({ email: { $regex: MARKER } }),
    db.collection("departments").deleteMany({ name: { $regex: MARKER } }),
    db.collection("teams").deleteMany({ name: { $regex: MARKER } }),
    db.collection("assets").deleteMany({ "metadata.name": { $regex: MARKER } }),
    db.collection("audit_logs").deleteMany({ teamId }),
    db.collection("metrics_snapshots").deleteMany({ scopeId: { $in: [teamId, deptId, orgId] } }),
  ]);
  await closeTestDb();
});


// ─── Metrics Computation ──────────────────────────────────

describe("Metrics Computation (real DB)", () => {
  it("computes scan coverage correctly", async () => {
    const metrics = await computeMetrics(db, "team", teamId, [teamId]);
    const scan = metrics.find((m) => m.key === "scan_coverage");
    expect(scan).toBeDefined();
    expect(scan!.current).toBe(75);
    expect(scan!.unit).toBe("%");
    expect(scan!.target).toBe(90);
    expect(scan!.floor).toBe(70);
  });

  it("computes trust A/B rate correctly", async () => {
    const metrics = await computeMetrics(db, "team", teamId, [teamId]);
    const trust = metrics.find((m) => m.key === "trust_ab_rate");
    expect(trust).toBeDefined();
    // 2 of 4 assets have no critical/high findings (clean + medium-only)
    expect(trust!.current).toBe(50);
  });

  it("computes export count from audit logs", async () => {
    const metrics = await computeMetrics(db, "team", teamId, [teamId]);
    const exports = metrics.find((m) => m.key === "exports_30d");
    expect(exports).toBeDefined();
    expect(exports!.current).toBe(2);
    expect(exports!.unit).toBe("count");
  });

  it("computes adoption rate", async () => {
    const metrics = await computeMetrics(db, "team", teamId, [teamId]);
    const adoption = metrics.find((m) => m.key === "adoption_rate");
    expect(adoption).toBeDefined();
    expect(adoption!.current).toBe(100);
  });

  it("reports trend as flat on first computation", async () => {
    const metrics = await computeMetrics(db, "team", teamId, [teamId]);
    for (const m of metrics) {
      expect(m.trend).toBe("flat");
      expect(m.trendDelta).toBe(0);
    }
  });

  it("returns 100% scan coverage for empty team", async () => {
    const metrics = await computeMetrics(db, "team", new ObjectId(), [new ObjectId()]);
    const scan = metrics.find((m) => m.key === "scan_coverage");
    expect(scan!.current).toBe(100);
  });
});

describe("Snapshots & Trends (real DB)", () => {
  it("takeSnapshot stores current metrics", async () => {
    const metrics = await computeMetrics(db, "team", teamId, [teamId]);
    const snapshotId = await takeSnapshot(db, "team", teamId, metrics);
    expect(snapshotId).toBeInstanceOf(ObjectId);

    const doc = await db.collection("metrics_snapshots").findOne({ _id: snapshotId });
    expect(doc).not.toBeNull();
    expect(doc!.scopeType).toBe("team");
    expect(doc!.metrics).toHaveLength(4);
  });

  it("getTrend returns snapshots in chronological order", async () => {
    const metrics = await computeMetrics(db, "team", teamId, [teamId]);
    await takeSnapshot(db, "team", teamId, metrics);

    const trend = await getTrend(db, "team", teamId, 8);
    expect(trend.length).toBeGreaterThanOrEqual(2);
    expect(trend[0].takenAt.getTime()).toBeLessThanOrEqual(trend[1].takenAt.getTime());
  });

  it("autoSnapshot skips if recent snapshot exists", async () => {
    const before = await db.collection("metrics_snapshots").countDocuments({ scopeType: "team", scopeId: teamId });
    const metrics = await computeMetrics(db, "team", teamId, [teamId]);
    await autoSnapshot(db, "team", teamId, metrics);
    const after = await db.collection("metrics_snapshots").countDocuments({ scopeType: "team", scopeId: teamId });
    expect(after).toBe(before);
  });

  it("detects trend after metric change", async () => {
    const recent = new Date(Date.now() - 1000);
    await db.collection("audit_logs").insertMany([
      { _id: new ObjectId(), actorId: userId, action: "asset:export", targetId: new ObjectId(), teamId, orgId, timestamp: recent },
      { _id: new ObjectId(), actorId: userId, action: "asset:export", targetId: new ObjectId(), teamId, orgId, timestamp: recent },
      { _id: new ObjectId(), actorId: userId, action: "asset:export", targetId: new ObjectId(), teamId, orgId, timestamp: recent },
    ]);

    const metrics = await computeMetrics(db, "team", teamId, [teamId]);
    const exports = metrics.find((m) => m.key === "exports_30d");
    expect(exports!.current).toBe(5);
    expect(exports!.trend).toBe("up");
    expect(exports!.trendDelta).toBe(3);
  });
});

describe("Department Comparison (real DB)", () => {
  it("compareDepartments returns metrics per department", async () => {
    const results = await compareDepartments(db, orgId);
    expect(results.length).toBe(1);
    expect(results[0].departmentName).toContain("Metrics Dept");
    expect(results[0].teamCount).toBe(1);
    expect(results[0].assetCount).toBe(4);
    expect(results[0].metrics.length).toBeGreaterThanOrEqual(4);
  });

  it("returns empty for org with no departments", async () => {
    const results = await compareDepartments(db, new ObjectId());
    expect(results).toHaveLength(0);
  });
});

describe("Metrics Report (real DB)", () => {
  it("getMetricsReport returns full report with trend", async () => {
    const report = await getMetricsReport(db, "team", teamId, `Metrics Team ${MARKER}`, [teamId]);
    expect(report.scope).toBe("team");
    expect(report.scopeId).toBe(teamId.toHexString());
    expect(report.metrics).toHaveLength(4);
    expect(report.trend.length).toBeGreaterThanOrEqual(1);
    expect(report.computedAt).toBeDefined();
  });

  it("metrics identify floor breaches", async () => {
    const report = await getMetricsReport(db, "team", teamId, "Test", [teamId]);
    const trustMetric = report.metrics.find((m) => m.key === "trust_ab_rate");
    expect(trustMetric!.current).toBeLessThan(trustMetric!.floor);
  });
});
