/**
 * GET    /api/teams/[teamId]/members — List team members with roles.
 * POST   /api/teams/[teamId]/members — Add a member (by email).
 * PATCH  /api/teams/[teamId]/members — Update member role.
 * DELETE is handled via POST with action: "remove".
 *
 * RBAC: admin/owner can manage, member can only view.
 */

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { requireAuth, getMemberRole } from "@/lib/api-helpers";
import { canManageRole, hasPermission, isValidRole } from "@/lib/rbac";
import { addTeamMember, removeTeamMember, updateMemberRole } from "@/services/team-service";
import { logAuditEvent } from "@/services/audit-service";
import type { TeamDocument } from "@/types/team";
import type { TeamRole } from "@/types/team";
import type { UserDocument } from "@/types/user";

type RouteParams = { params: Promise<{ teamId: string }> };

const ASSIGNABLE_ROLES: TeamRole[] = ["viewer", "member", "admin"];

async function getTeamAndValidate(db: Awaited<ReturnType<typeof getDb>>, teamId: string, authUserId: string) {
  if (!/^[0-9a-f]{24}$/i.test(teamId)) return { error: "Invalid team ID", status: 400 };
  const team = await db.collection<TeamDocument>("teams").findOne({ _id: new ObjectId(teamId) });
  if (!team) return { error: "Team not found", status: 404 };
  const actorId = new ObjectId(authUserId);
  const actorRole = await getMemberRole(db, actorId, team._id);
  if (!actorRole) return { error: "Not a team member", status: 403 };
  return { team, actorId, actorRole };
}

async function getTargetRole(
  db: Awaited<ReturnType<typeof getDb>>,
  userId: ObjectId,
  teamId: ObjectId
): Promise<TeamRole | null> {
  return getMemberRole(db, userId, teamId);
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult.response;

  const { teamId } = await params;
  const db = await getDb();
  const check = await getTeamAndValidate(db, teamId, authResult.userId);
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const { team, actorId, actorRole } = check;
  const memberIds = team.memberIds ?? [];

  // Fetch user docs for all members
  const users = memberIds.length > 0
    ? await db.collection<UserDocument>("users")
        .find({ _id: { $in: memberIds } })
        .project({ name: 1, email: 1, image: 1, teamMemberships: 1 })
        .toArray()
    : [];

  const members = users.map((u) => {
    const membership = (u.teamMemberships ?? []).find(
      (m: { teamId: ObjectId }) => m.teamId.toHexString() === teamId
    );
    return {
      id: u._id.toHexString(),
      name: u.name ?? u.email,
      email: u.email,
      image: u.image ?? null,
      role: membership?.role ?? "member",
      joinedAt: membership?.joinedAt?.toISOString() ?? null,
    };
  });

  return NextResponse.json({
    members,
    total: members.length,
    currentUserId: actorId.toHexString(),
    currentUserRole: actorRole,
    canManageMembers: hasPermission(actorRole, "team:manage_members"),
  });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult.response;

  const { teamId } = await params;
  const db = await getDb();
  const check = await getTeamAndValidate(db, teamId, authResult.userId);
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const { actorId, actorRole } = check;
  let body: { email?: string; userId?: string; role?: string; action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const teamOid = new ObjectId(teamId);

  // Handle remove action
  if (body.action === "remove" && body.userId) {
    if (!ObjectId.isValid(body.userId)) {
      return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
    }
    const targetId = new ObjectId(body.userId);
    if (targetId.equals(actorId)) {
      return NextResponse.json({ error: "Use a dedicated leave-team flow for self-removal" }, { status: 400 });
    }
    const targetRole = await getTargetRole(db, targetId, teamOid);
    if (!targetRole) {
      return NextResponse.json({ error: "Target user is not a team member" }, { status: 404 });
    }
    if (targetRole === "owner") {
      return NextResponse.json({ error: "Owner removal is not supported from this route" }, { status: 400 });
    }
    if (!canManageRole(actorRole, targetRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    await removeTeamMember(db, teamOid, targetId);
    await logAuditEvent(db, {
      actorId, action: "team:member_remove", targetId, targetType: "user", teamId: teamOid,
      details: { userId: body.userId },
    });
    return NextResponse.json({ success: true, message: "Member removed" });
  }

  // Add member
  if (!body.email || typeof body.email !== "string") {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const requestedRole = body.role ?? "member";
  if (!isValidRole(requestedRole) || !ASSIGNABLE_ROLES.includes(requestedRole)) {
    return NextResponse.json({ error: `role must be one of: ${ASSIGNABLE_ROLES.join(", ")}` }, { status: 400 });
  }
  if (!canManageRole(actorRole, requestedRole)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const targetUser = await db.collection<UserDocument>("users").findOne({ email: body.email });
  if (!targetUser) {
    return NextResponse.json({ error: "User not found. They must sign up first." }, { status: 404 });
  }

  // Check if already a member
  const team = check.team;
  if (team.memberIds.some((id) => id.toHexString() === targetUser._id.toHexString())) {
    return NextResponse.json({ error: "User is already a member" }, { status: 409 });
  }

  const role = requestedRole;
  await addTeamMember(db, teamOid, targetUser._id, role);

  await logAuditEvent(db, {
    actorId, action: "team:member_add", targetId: targetUser._id, targetType: "user", teamId: teamOid,
    details: { email: body.email, role },
  });

  return NextResponse.json({ success: true, memberId: targetUser._id.toHexString() }, { status: 201 });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult.response;

  const { teamId } = await params;
  const db = await getDb();
  const check = await getTeamAndValidate(db, teamId, authResult.userId);
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });
  const { actorId, actorRole } = check;

  let body: { userId: string; role: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.userId || !body.role) {
    return NextResponse.json({ error: "userId and role are required" }, { status: 400 });
  }
  if (!ObjectId.isValid(body.userId)) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  }
  if (!isValidRole(body.role) || !ASSIGNABLE_ROLES.includes(body.role)) {
    return NextResponse.json({ error: `role must be one of: ${ASSIGNABLE_ROLES.join(", ")}` }, { status: 400 });
  }

  const targetId = new ObjectId(body.userId);
  if (targetId.equals(actorId)) {
    return NextResponse.json({ error: "Use a dedicated self-role flow for your own account" }, { status: 400 });
  }

  const targetRole = await getTargetRole(db, targetId, new ObjectId(teamId));
  if (!targetRole) {
    return NextResponse.json({ error: "Target user is not a team member" }, { status: 404 });
  }
  if (targetRole === "owner") {
    return NextResponse.json({ error: "Owner role changes are not supported from this route" }, { status: 400 });
  }
  if (!hasPermission(actorRole, "team:manage_members")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }
  if (!canManageRole(actorRole, targetRole) || !canManageRole(actorRole, body.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  await updateMemberRole(db, new ObjectId(teamId), targetId, body.role);

  await logAuditEvent(db, {
    actorId,
    action: "team:member_role_change",
    targetId,
    targetType: "user",
    teamId: new ObjectId(teamId),
    details: { newRole: body.role },
  });

  return NextResponse.json({ success: true, message: "Role updated" });
}
