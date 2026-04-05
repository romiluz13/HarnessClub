/**
 * GET /api/skills — Fetch assets for the authenticated user's teams.
 *
 * Returns assets across all teams the user belongs to.
 * Supports pagination via ?page=1&limit=20 and ?type=skill filter.
 * Per api-security-best-practices: auth check, input validation, typed response.
 *
 * NOTE: Route path stays /api/skills for backward compatibility.
 * Will be aliased to /api/assets in Phase 15.
 */

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import type { AssetDocument, AssetType } from "@/types/asset";
import { ASSET_TYPES } from "@/types/asset";

/** Serialized asset for API response (ObjectId → string) */
interface AssetResponse {
  id: string;
  type: AssetType;
  teamId: string;
  name: string;
  description: string;
  author?: string;
  version?: string;
  tags: string[];
  installCount: number;
  viewCount: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

function serializeAsset(doc: AssetDocument): AssetResponse {
  return {
    id: doc._id.toHexString(),
    type: doc.type,
    teamId: doc.teamId.toHexString(),
    name: doc.metadata.name,
    description: doc.metadata.description,
    author: doc.metadata.author,
    version: doc.metadata.version,
    tags: doc.tags,
    installCount: doc.stats.installCount,
    viewCount: doc.stats.viewCount,
    isPublished: doc.isPublished,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const skip = (page - 1) * limit;
  const typeParam = searchParams.get("type");

  const db = await getDb();

  // Get user's team IDs
  const user = await db.collection("users").findOne(
    { _id: new ObjectId(session.user.id) },
    { projection: { teamMemberships: 1 } }
  );

  const teamIds = (user?.teamMemberships || []).map(
    (m: { teamId: ObjectId }) => m.teamId
  );

  if (teamIds.length === 0) {
    return NextResponse.json({ skills: [], total: 0, page, limit });
  }

  // Build filter with optional type
  const filter: Record<string, unknown> = { teamId: { $in: teamIds } };
  if (typeParam && ASSET_TYPES.includes(typeParam as AssetType)) {
    filter.type = typeParam;
  }

  // Fetch assets + total count in parallel
  const [assets, total] = await Promise.all([
    db.collection<AssetDocument>("assets")
      .find(filter, { projection: { content: 0, embedding: 0, searchText: 0 } })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    db.collection<AssetDocument>("assets").countDocuments(filter),
  ]);

  return NextResponse.json({
    skills: assets.map(serializeAsset),
    total,
    page,
    limit,
  });
}
