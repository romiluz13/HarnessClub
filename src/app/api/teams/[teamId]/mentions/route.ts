/**
 * GET /api/teams/[teamId]/mentions — Get user's mentions.
 * POST /api/teams/[teamId]/mentions — Create an @mention.
 *
 * Per api-security-best-practices: auth required.
 */

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/api-helpers";
import {
  createMention,
  getMentions,
  markMentionRead,
  getUnreadMentionCount,
} from "@/services/activity-feed-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult.response;

  const { teamId: teamIdStr } = await params;
  if (!ObjectId.isValid(teamIdStr)) {
    return NextResponse.json({ error: "Invalid teamId" }, { status: 400 });
  }

  const url = new URL(request.url);
  const unreadOnly = url.searchParams.get("unreadOnly") === "true";
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10), 50);

  const db = await getDb();
  const userId = new ObjectId(authResult.userId);

  const [mentions, unreadCount] = await Promise.all([
    getMentions(db, userId, { unreadOnly, limit }),
    getUnreadMentionCount(db, userId),
  ]);

  return NextResponse.json({ mentions, unreadCount });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult.response;

  const { teamId: teamIdStr } = await params;
  if (!ObjectId.isValid(teamIdStr)) {
    return NextResponse.json({ error: "Invalid teamId" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { mentionedUserId, assetId, comment } = body;
  if (!mentionedUserId || typeof mentionedUserId !== "string" || !ObjectId.isValid(mentionedUserId)) {
    return NextResponse.json({ error: "mentionedUserId is required (valid ObjectId)" }, { status: 400 });
  }
  if (typeof comment !== "string" || comment.trim().length === 0) {
    return NextResponse.json({ error: "comment is required" }, { status: 400 });
  }

  const db = await getDb();
  const teamId = new ObjectId(teamIdStr);

  // Mark a mention as read if action=markRead
  if (body.action === "markRead" && body.mentionId && ObjectId.isValid(body.mentionId as string)) {
    const result = await markMentionRead(
      db,
      new ObjectId(body.mentionId as string),
      new ObjectId(authResult.userId)
    );
    return NextResponse.json({ success: result });
  }

  const mentionId = await createMention(db, {
    mentionedUserId: new ObjectId(mentionedUserId),
    mentionedBy: new ObjectId(authResult.userId),
    teamId,
    assetId: assetId && ObjectId.isValid(assetId as string) ? new ObjectId(assetId as string) : undefined,
    comment: comment.trim(),
  });

  return NextResponse.json({ mentionId: mentionId.toHexString() }, { status: 201 });
}
