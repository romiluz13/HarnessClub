/**
 * GET /api/assets — List assets for authenticated user's teams.
 * POST /api/assets — Create a new asset with type validation.
 *
 * Per api-security-best-practices: auth, input validation, RBAC, typed response.
 * Per mongodb-schema-design pattern-polymorphic: type discriminator on all docs.
 */

import { NextRequest, NextResponse } from "next/server";
import { ObjectId, type Document } from "mongodb";
import { getDb } from "@/lib/db";
import { ASSET_TYPES } from "@/types/asset";
import type { AssetType, CreateAssetInput } from "@/types/asset";
import { requireAuth, getUserTeamIds, serializeAsset, getMemberRole } from "@/lib/api-helpers";
import type { AssetDocument } from "@/types/asset";
import { hasPermission } from "@/lib/rbac";
import { createAsset } from "@/services/asset-service";

async function searchAssetsPage(
  db: Awaited<ReturnType<typeof getDb>>,
  options: {
    teamIds: ObjectId[];
    query: string;
    type?: AssetType;
    skip: number;
    limit: number;
  }
) {
  const filter: Document[] = [
    { in: { path: "teamId", value: options.teamIds } },
  ];
  if (options.type) {
    filter.push({ equals: { path: "type", value: options.type } });
  }

  const searchStage = {
    index: "assets_search",
    compound: {
      must: [
        {
          text: {
            query: options.query,
            path: ["metadata.name", "metadata.description", "content", "searchText"],
            fuzzy: { maxEdits: 1 },
          },
        },
      ],
      filter,
    },
    count: { type: "total" as const },
  };

  const [assets, totalResult] = await Promise.all([
    db.collection<AssetDocument>("assets").aggregate<AssetDocument>([
      { $search: searchStage },
      { $addFields: { _searchScore: { $meta: "searchScore" } } },
      { $sort: { _searchScore: -1, updatedAt: -1 } },
      { $skip: options.skip },
      { $limit: options.limit },
      { $project: { content: 0, embedding: 0, searchText: 0, _searchScore: 0 } },
    ]).toArray(),
    db.collection("assets").aggregate([
      { $searchMeta: searchStage },
    ]).toArray(),
  ]);

  return {
    assets,
    total: totalResult[0]?.count?.total ?? 0,
  };
}

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult.response;

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const skip = (page - 1) * limit;
  const typeParam = searchParams.get("type");
  const queryParam = searchParams.get("q")?.trim();

  if (queryParam && queryParam.length > 200) {
    return NextResponse.json({ error: "Query too long (max 200 chars)" }, { status: 400 });
  }

  const db = await getDb();
  const teamIds = await getUserTeamIds(db, authResult.userId);

  if (teamIds.length === 0) {
    return NextResponse.json({ assets: [], total: 0, page, limit });
  }

  const typeFilter = typeParam && ASSET_TYPES.includes(typeParam as AssetType)
    ? typeParam as AssetType
    : undefined;

  const { assets, total } = queryParam
    ? await searchAssetsPage(db, {
        teamIds,
        query: queryParam,
        type: typeFilter,
        skip,
        limit,
      })
    : await (async () => {
        const filter: Record<string, unknown> = { teamId: { $in: teamIds } };
        if (typeFilter) {
          filter.type = typeFilter;
        }

        const [listedAssets, listedTotal] = await Promise.all([
          db.collection<AssetDocument>("assets")
            .find(filter, { projection: { content: 0, embedding: 0, searchText: 0 } })
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray(),
          db.collection<AssetDocument>("assets").countDocuments(filter),
        ]);

        return { assets: listedAssets, total: listedTotal };
      })();

  return NextResponse.json({ assets: assets.map(serializeAsset), total, page, limit });
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Required fields
  const { type, teamId, name, description, content, tags } = body;
  if (!type || !teamId || !name || !description || !content) {
    return NextResponse.json(
      { error: "Missing required fields: type, teamId, name, description, content" },
      { status: 400 }
    );
  }

  // Validate teamId format
  let teamOid: ObjectId;
  try {
    teamOid = new ObjectId(teamId as string);
  } catch {
    return NextResponse.json({ error: "Invalid teamId format" }, { status: 400 });
  }

  const db = await getDb();
  const userId = new ObjectId(authResult.userId);

  // RBAC check — user must have skill:create permission in the team
  const role = await getMemberRole(db, userId, teamOid);
  if (!role || !hasPermission(role as import("@/types/team").TeamRole, "skill:create")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  // Build input for validation
  const normalizedTags = Array.isArray(tags) ? (tags as string[]).map((t) => t.toLowerCase().trim()) : [];
  const input: CreateAssetInput = {
    type: type as AssetType,
    teamId: teamOid,
    metadata: {
      name: name as string,
      description: description as string,
      author: body.author as string | undefined,
      version: body.version as string | undefined,
    },
    content: content as string,
    tags: normalizedTags,
    createdBy: userId,
    isPublished: false,
    // Type-specific configs
    agentConfig: body.agentConfig as CreateAssetInput["agentConfig"],
    ruleConfig: body.ruleConfig as CreateAssetInput["ruleConfig"],
    pluginConfig: body.pluginConfig as CreateAssetInput["pluginConfig"],
    mcpConfig: body.mcpConfig as CreateAssetInput["mcpConfig"],
    hookConfig: body.hookConfig as CreateAssetInput["hookConfig"],
    settingsConfig: body.settingsConfig as CreateAssetInput["settingsConfig"],
  };

  const result = await createAsset(db, input);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error, errors: result.validationErrors ?? [] },
      { status: result.validationErrors ? 422 : 400 }
    );
  }

  return NextResponse.json(
    { id: result.assetId.toHexString(), type: result.type, name: result.name, releaseStatus: "draft" },
    { status: 201 }
  );
}
