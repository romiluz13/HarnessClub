/**
 * GET /api/marketplace/browse — Search published assets for marketplace.
 *
 * Query params: q (search text), type (asset type filter).
 * Returns only published assets from teams with marketplace enabled.
 */

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { AssetDocument } from "@/types/asset";
import { computeTrustScore } from "@/services/trust-score";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q")?.trim() ?? "";
  const typeFilter = searchParams.get("type")?.trim() ?? "";

  const db = await getDb();

  // Build filter: only published assets from marketplace-enabled teams
  const filter: Record<string, unknown> = { isPublished: true };
  if (typeFilter) filter.type = typeFilter;

  // Get teams with marketplace enabled
  const marketplaceTeams = await db.collection("teams")
    .find({ "settings.marketplaceEnabled": true })
    .project({ _id: 1 })
    .toArray();
  const teamIds = marketplaceTeams.map((t) => t._id);

  if (teamIds.length > 0) {
    filter.teamId = { $in: teamIds };
  }

  // Text search if query provided
  if (q) {
    filter.$or = [
      { "metadata.name": { $regex: q, $options: "i" } },
      { "metadata.description": { $regex: q, $options: "i" } },
      { tags: { $regex: q, $options: "i" } },
    ];
  }

  const assets = await db.collection<AssetDocument>("assets")
    .find(filter, {
      projection: {
        content: 0, embedding: 0, searchText: 0,
      },
    })
    .sort({ "stats.installCount": -1, updatedAt: -1 })
    .limit(50)
    .toArray();

  return NextResponse.json({
    items: assets.map((a) => ({
      id: a._id.toHexString(),
      type: a.type,
      name: a.metadata.name,
      description: a.metadata.description,
      author: a.metadata.author ?? null,
      tags: a.tags ?? [],
      trustScore: (() => { const ts = computeTrustScore(a); return { grade: ts.grade, overall: ts.overall }; })(),
      installCount: a.stats?.installCount ?? 0,
    })),
  });
}
