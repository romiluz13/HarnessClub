/**
 * GET /api/skills/:id — Fetch a single skill with full content.
 * PATCH /api/skills/:id — Update skill metadata/content.
 *
 * Auth required. User must be member of the skill's team.
 * Per api-security-best-practices: auth, ownership check, input validation.
 */

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import type { AssetDocument } from "@/types/asset";
import { buildSearchText } from "@/types/asset";

function isValidObjectId(id: string): boolean {
  return /^[a-f\d]{24}$/i.test(id);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid skill ID" }, { status: 400 });
  }

  const db = await getDb();
  const asset = await db.collection<AssetDocument>("assets").findOne(
    { _id: new ObjectId(id) },
    { projection: { embedding: 0, searchText: 0 } }
  );

  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  // Verify user is member of asset's team
  const user = await db.collection("users").findOne(
    {
      _id: new ObjectId(session.user.id),
      "teamMemberships.teamId": asset.teamId,
    },
    { projection: { _id: 1 } }
  );

  if (!user) {
    return NextResponse.json({ error: "Not a team member" }, { status: 403 });
  }

  return NextResponse.json({
    id: asset._id.toHexString(),
    type: asset.type,
    teamId: asset.teamId.toHexString(),
    name: asset.metadata.name,
    description: asset.metadata.description,
    author: asset.metadata.author,
    version: asset.metadata.version,
    tags: asset.tags,
    content: asset.content,
    installCount: asset.stats.installCount,
    viewCount: asset.stats.viewCount,
    isPublished: asset.isPublished,
    sourceUrl: asset.source?.repoUrl,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid skill ID" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const db = await getDb();

  // Verify ownership (user must have edit permission in team)
  const asset = await db.collection<AssetDocument>("assets").findOne(
    { _id: new ObjectId(id) },
    { projection: { teamId: 1, metadata: 1, content: 1, tags: 1 } }
  );

  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  const user = await db.collection("users").findOne({
    _id: new ObjectId(session.user.id),
    "teamMemberships.teamId": asset.teamId,
  });

  if (!user) {
    return NextResponse.json({ error: "Not a team member" }, { status: 403 });
  }

  // Build update
  const allowedFields: Record<string, string> = {
    name: "metadata.name",
    description: "metadata.description",
    version: "metadata.version",
    tags: "tags",
    content: "content",
    isPublished: "isPublished",
  };

  const $set: Record<string, unknown> = { updatedAt: new Date() };
  for (const [key, path] of Object.entries(allowedFields)) {
    if (key in body) {
      $set[path] = body[key];
    }
  }

  // Rebuild searchText if content/name/description/tags changed (ADR-010)
  const newName = (body.name as string) ?? asset.metadata.name;
  const newDesc = (body.description as string) ?? asset.metadata.description;
  const newContent = (body.content as string) ?? asset.content;
  const newTags = (body.tags as string[]) ?? asset.tags;
  if (body.name || body.description || body.content || body.tags) {
    $set.searchText = buildSearchText(newName, newDesc, newContent, newTags);
  }

  await db.collection("assets").updateOne(
    { _id: new ObjectId(id) },
    { $set }
  );

  return NextResponse.json({ success: true });
}
