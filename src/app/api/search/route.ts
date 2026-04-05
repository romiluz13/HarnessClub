/**
 * GET /api/search — Search assets across user's teams.
 *
 * Query params:
 * - q: search query (required)
 * - mode: "hybrid" | "lexical" | "semantic" (default: "hybrid")
 * - type: asset type filter (e.g., "skill", "agent", "rule")
 * - limit: max results (default: 10, max: 50)
 * - tags: comma-separated tag filter
 *
 * Per api-security-best-practices: auth, input validation, typed response.
 * Per async-parallel: parallel team lookup + search prep.
 */

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { hybridSearch, autocompleteSearch } from "@/services/search-hybrid";
import type { SearchOptions } from "@/services/search";
import type { AssetType } from "@/types/asset";
import { ASSET_TYPES } from "@/types/asset";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const query = searchParams.get("q")?.trim();
  const mode = (searchParams.get("mode") || "hybrid") as SearchOptions["mode"];
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));
  const tagsParam = searchParams.get("tags");
  const tags = tagsParam ? tagsParam.split(",").map((t) => t.trim()).filter(Boolean) : undefined;
  const typeParam = searchParams.get("type");
  const assetType = typeParam && ASSET_TYPES.includes(typeParam as AssetType) ? typeParam as AssetType : undefined;
  const isAutocomplete = searchParams.get("autocomplete") === "true";

  if (!query || query.length < 1) {
    return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 });
  }

  if (query.length > 200) {
    return NextResponse.json({ error: "Query too long (max 200 chars)" }, { status: 400 });
  }

  const db = await getDb();

  // Get user's first team (for now, search within primary team)
  const user = await db.collection("users").findOne(
    { _id: new ObjectId(session.user.id) },
    { projection: { teamMemberships: 1 } }
  );

  const teamMemberships = user?.teamMemberships || [];
  if (teamMemberships.length === 0) {
    return NextResponse.json({ results: [], total: 0 });
  }

  const teamId = teamMemberships[0].teamId as ObjectId;

  // Autocomplete mode — fast prefix match
  if (isAutocomplete) {
    const suggestions = await autocompleteSearch(db, teamId, query, Math.min(limit, 8), assetType);
    return NextResponse.json({ suggestions });
  }

  // Full search
  const results = await hybridSearch(db, {
    teamId,
    query,
    mode,
    limit,
    tags,
    assetType,
  });

  return NextResponse.json({ results, total: results.length });
}
