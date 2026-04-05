/**
 * GET /api/settings/audit — Paginated audit logs with filters.
 *
 * Query params: page, limit, action (prefix filter).
 * If export=siem, returns full SIEM-formatted JSON blob.
 */

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/api-helpers";
import { getAuditLogs, exportToSiem } from "@/services/audit-service";
import type { UserDocument } from "@/types/user";

export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (!authResult.ok) return authResult.response;

  const db = await getDb();
  const userId = new ObjectId(authResult.userId);

  // Get user's team for scoping
  const user = await db.collection<UserDocument>("users").findOne({ _id: userId });
  const teamId = user?.teamMemberships?.[0]?.teamId;
  if (!teamId) {
    return NextResponse.json({ entries: [], total: 0 });
  }

  const { searchParams } = request.nextUrl;

  // SIEM export mode
  if (searchParams.get("export") === "siem") {
    const events = await exportToSiem(db, { teamId });
    return new NextResponse(JSON.stringify(events, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="audit-siem-${Date.now()}.json"`,
      },
    });
  }

  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25", 10)));
  const actionPrefix = searchParams.get("action") || "";

  // Build filter
  const filter: Record<string, unknown> = { teamId };
  if (actionPrefix) {
    filter.action = { $regex: `^${actionPrefix}`, $options: "i" };
  }

  // Count + paginated query
  const [total, entries] = await Promise.all([
    db.collection("audit_logs").countDocuments(filter),
    db.collection("audit_logs")
      .find(filter)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
  ]);

  // Actor name lookup
  const actorIds = [...new Set(entries.map((e) => e.actorId.toHexString()))];
  const actors = actorIds.length > 0
    ? await db.collection("users")
        .find({ _id: { $in: actorIds.map((id) => new ObjectId(id)) } })
        .project({ name: 1, email: 1 })
        .toArray()
    : [];
  const actorMap = new Map(actors.map((a) => [a._id.toHexString(), a.name ?? a.email ?? "Unknown"]));

  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e._id.toHexString(),
      action: e.action,
      actorName: actorMap.get(e.actorId.toHexString()) ?? "Unknown",
      targetId: e.targetId?.toHexString() ?? null,
      targetType: e.targetType ?? null,
      details: e.details ?? null,
      timestamp: e.timestamp.toISOString(),
    })),
    total,
    page,
    limit,
  });
}
