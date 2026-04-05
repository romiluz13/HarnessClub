/**
 * Auth Guard — Protect server actions and API routes.
 *
 * Per server-auth-actions: authenticate EVERY server action.
 * Per api-security-best-practices: fail closed, validate on every request.
 *
 * Usage in server actions:
 *   const user = await requireAuth();
 *   // user is guaranteed to be authenticated
 *
 * Usage with RBAC:
 *   const { user, role } = await requireTeamRole(teamId, "member");
 *   // user has at least "member" role in the team
 */

import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { isRoleAtLeast, hasPermission } from "@/lib/rbac";
import type { TeamRole } from "@/types/team";
import type { Permission } from "@/lib/rbac";
import { ObjectId } from "mongodb";

/** Authenticated user info */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

/**
 * Require authentication. Throws if not authenticated.
 * Use at the top of every server action and API route.
 */
export async function requireAuth(): Promise<AuthUser> {
  const session = await auth();

  if (!session?.user?.id || !session.user.email) {
    throw new Error("Authentication required");
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name || session.user.email,
  };
}

/**
 * Require a specific team role. Throws if user doesn't have the minimum role.
 * Verifies user is a team member with sufficient privileges.
 */
export async function requireTeamRole(
  teamId: string | ObjectId,
  minimumRole: TeamRole
): Promise<{ user: AuthUser; role: TeamRole }> {
  const user = await requireAuth();
  const db = await getDb();

  const objectId =
    typeof teamId === "string" ? new ObjectId(teamId) : teamId;

  const userDoc = await db.collection("users").findOne(
    {
      _id: new ObjectId(user.id),
      "teamMemberships.teamId": objectId,
    },
    {
      projection: { "teamMemberships.$": 1 },
    }
  );

  if (!userDoc?.teamMemberships?.[0]) {
    throw new Error("Not a member of this team");
  }

  const role = userDoc.teamMemberships[0].role as TeamRole;

  if (!isRoleAtLeast(role, minimumRole)) {
    throw new Error(
      `Insufficient permissions. Required: ${minimumRole}, have: ${role}`
    );
  }

  return { user, role };
}

/**
 * Require a specific permission in a team context.
 * More granular than requireTeamRole — checks exact permission.
 */
export async function requirePermission(
  teamId: string | ObjectId,
  permission: Permission
): Promise<{ user: AuthUser; role: TeamRole }> {
  const user = await requireAuth();
  const db = await getDb();

  const objectId =
    typeof teamId === "string" ? new ObjectId(teamId) : teamId;

  const userDoc = await db.collection("users").findOne(
    {
      _id: new ObjectId(user.id),
      "teamMemberships.teamId": objectId,
    },
    {
      projection: { "teamMemberships.$": 1 },
    }
  );

  if (!userDoc?.teamMemberships?.[0]) {
    throw new Error("Not a member of this team");
  }

  const role = userDoc.teamMemberships[0].role as TeamRole;

  if (!hasPermission(role, permission)) {
    throw new Error(`Missing permission: ${permission}`);
  }

  return { user, role };
}
