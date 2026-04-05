/**
 * GET /api/assets — List assets for authenticated user's teams.
 * POST /api/assets — Create a new asset with type validation.
 *
 * Per api-security-best-practices: auth, input validation, RBAC, typed response.
 * Per mongodb-schema-design pattern-polymorphic: type discriminator on all docs.
 */

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { ASSET_TYPES } from "@/types/asset";
import type { AssetType, CreateAssetInput } from "@/types/asset";
import { buildSearchText } from "@/types/asset";
import { validateAssetInput } from "@/lib/asset-validators";
import { requireAuth, getUserTeamIds, serializeAsset, getMemberRole } from "@/lib/api-helpers";
import type { AssetDocument } from "@/types/asset";
import { hasPermission } from "@/lib/rbac";
import { embedAsset } from "@/services/embedding-pipeline";
import { needsManualEmbedding, detectSearchMode } from "@/lib/search-mode";
import { logAuditEvent } from "@/services/audit-service";

export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (!authResult.ok) return authResult.response;

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const skip = (page - 1) * limit;
  const typeParam = searchParams.get("type");

  const db = await getDb();
  const teamIds = await getUserTeamIds(db, authResult.userId);

  if (teamIds.length === 0) {
    return NextResponse.json({ assets: [], total: 0, page, limit });
  }

  const filter: Record<string, unknown> = { teamId: { $in: teamIds } };
  if (typeParam && ASSET_TYPES.includes(typeParam as AssetType)) {
    filter.type = typeParam;
  }

  const [assets, total] = await Promise.all([
    db.collection<AssetDocument>("assets")
      .find(filter, { projection: { content: 0, embedding: 0, searchText: 0 } })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    db.collection<AssetDocument>("assets").countDocuments(filter),
  ]);

  return NextResponse.json({ assets: assets.map(serializeAsset), total, page, limit });
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
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

  // Application-level type validation (8.2)
  const validation = validateAssetInput(input);
  if (!validation.valid) {
    return NextResponse.json({ error: "Validation failed", errors: validation.errors }, { status: 422 });
  }

  const now = new Date();
  const searchText = buildSearchText(input.metadata.name, input.metadata.description, input.content, input.tags);

  const doc = {
    _id: new ObjectId(),
    ...input,
    searchText,
    stats: { installCount: 0, viewCount: 0 },
    createdAt: now,
    updatedAt: now,
  };

  await db.collection("assets").insertOne(doc);

  // Embed if needed (M0/local mode only — ADR-010)
  const mode = await detectSearchMode(db);
  if (needsManualEmbedding(mode)) {
    try {
      await embedAsset(db, doc._id, input.metadata.name, input.metadata.description, input.content, input.tags);
    } catch (err) {
      console.warn(`Embedding failed for asset ${doc._id}:`, err);
    }
  }

  // Audit log
  await logAuditEvent(db, {
    actorId: userId,
    action: "asset:create",
    targetId: doc._id,
    targetType: input.type,
    teamId: teamOid,
    details: { name: input.metadata.name, type: input.type },
  });

  return NextResponse.json({ id: doc._id.toHexString(), type: input.type, name: input.metadata.name }, { status: 201 });
}
