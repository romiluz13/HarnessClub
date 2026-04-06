/**
 * GET /api/teams/[teamId]/feed — Team activity feed.
 * POST /api/teams/[teamId]/feed — Mark feed as read.
 *
 * Query params: limit, page, category, actorId
 * Per api-security-best-practices: auth required, team membership check.
 */

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { requireAuth, getUserTeamIds } from "@/lib/api-helpers";
import { getFeed, markFeedAsRead, getUnreadCount } from "@/services/activity-feed-service";
import type { FeedCategory } from "@/services/activity-feed-service";

const VALID_CATEGORIES: FeedCategory[] = ["asset", "team", "approval", "security", "org"];

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

  const db = await getDb();
  const teamId = new ObjectId(teamIdStr);

  // Verify team membership
  const userTeams = await getUserTeamIds(db, authResult.userId);
  if (!userTeams.some((t) => t.equals(teamId))) {
    return NextResponse.json({ error: "Not a member of this team" }, { status: 403 });
  }

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "30", 10), 100);
  const page = Math.max(parseInt(url.searchParams.get("page") ?? "1", 10), 1);
  const categoryParam = url.searchParams.get("category");
  const actorIdParam = url.searchParams.get("actorId");

  const category = categoryParam && VALID_CATEGORIES.includes(categoryParam as FeedCategory)
    ? (categoryParam as FeedCategory)
    : undefined;
  const actorId = actorIdParam && ObjectId.isValid(actorIdParam)
    ? new ObjectId(actorIdParam)
    : undefined;

  const [feed, unreadCount] = await Promise.all([
    getFeed(db, teamId, { limit, page, category, actorId }),
    getUnreadCount(db, new ObjectId(authResult.userId), teamId),
  ]);

  return NextResponse.json({
    ...feed,
    unreadCount,
    page,
    limit,
  });
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

  const db = await getDb();
  const teamId = new ObjectId(teamIdStr);
  const userId = new ObjectId(authResult.userId);

  await markFeedAsRead(db, userId, teamId);

  return NextResponse.json({ success: true });
}
