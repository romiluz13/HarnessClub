/**
 * GET /api/teams — Get user's teams with member count and skill count.
 * POST /api/teams — Create a new team.
 *
 * Per api-security-best-practices: auth, input validation, typed response.
 */

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { createTeam, generateUniqueSlug, getUserTeams } from "@/services/team-service";
import type { TeamDocument } from "@/types/team";

interface TeamResponse {
  id: string;
  name: string;
  slug: string;
  ownerName: string;
  memberCount: number;
  skillCount: number;
  userRole: string;
  createdAt: string;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const userId = new ObjectId(session.user.id);

  const [teams, user] = await Promise.all([
    getUserTeams(db, userId),
    db.collection("users").findOne(
      { _id: userId },
      { projection: { teamMemberships: 1 } }
    ),
  ]);

  const memberships = user?.teamMemberships || [];
  const roleMap = new Map(
    memberships.map((m: { teamId: ObjectId; role: string }) => [
      m.teamId.toHexString(),
      m.role,
    ])
  );

  // Get asset counts per team in parallel
  const teamIds = teams.map((t) => t._id);
  const assetCounts =
    teamIds.length > 0
      ? await db
          .collection("assets")
          .aggregate<{ _id: ObjectId; count: number }>([
            { $match: { teamId: { $in: teamIds } } },
            { $group: { _id: "$teamId", count: { $sum: 1 } } },
          ])
          .toArray()
      : [];

  const assetCountMap = new Map(
    assetCounts.map((s) => [s._id.toHexString(), s.count])
  );

  const response: TeamResponse[] = teams.map((t: TeamDocument) => ({
    id: t._id.toHexString(),
    name: t.name,
    slug: t.slug,
    ownerName: t.owner.name,
    memberCount: t.memberIds.length,
    skillCount: assetCountMap.get(t._id.toHexString()) || 0,
    userRole: String(roleMap.get(t._id.toHexString()) ?? "viewer"),
    createdAt: t.createdAt.toISOString(),
  }));

  return NextResponse.json({ teams: response });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !session.user.name || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.name || typeof body.name !== "string" || body.name.trim().length < 2) {
    return NextResponse.json(
      { error: "Team name is required (min 2 characters)" },
      { status: 400 }
    );
  }

  const name = body.name.trim().slice(0, 100);
  const db = await getDb();
  const slug = await generateUniqueSlug(db, name);
  const userId = new ObjectId(session.user.id);

  const team = await createTeam(db, {
    name,
    slug,
    owner: {
      userId,
      name: session.user.name,
      email: session.user.email,
    },
  });

  return NextResponse.json(
    {
      id: team._id.toHexString(),
      name: team.name,
      slug: team.slug,
    },
    { status: 201 }
  );
}
