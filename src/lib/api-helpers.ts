/**
 * Shared API route helpers.
 *
 * Per api-security-best-practices: DRY auth + team membership checks.
 * Used by /api/skills and /api/assets routes.
 */

import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import type { Db } from "mongodb";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import type { AssetDocument, AssetType, ReleaseStatus } from "@/types/asset";
import { computeTrustScore } from "@/services/trust-score";
import { getEffectiveReleaseStatus } from "@/types/asset";
import { validateApiToken } from "@/services/api-token-service";
import type { OrgRole, TeamRole } from "@/types/team";
import { hasOrgPermission, type Permission } from "@/lib/rbac";

/** Serialized asset for API response (ObjectId → string) */
export interface AssetResponse {
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
  releaseStatus: ReleaseStatus;
  trustScore?: { overall: number; grade: string } | null;
  createdAt: string;
  updatedAt: string;
}

/** Convert MongoDB AssetDocument to JSON-safe API response */
export function serializeAsset(doc: AssetDocument): AssetResponse {
  return {
    id: doc._id.toHexString(),
    type: doc.type,
    teamId: doc.teamId.toHexString(),
    name: doc.metadata.name,
    description: doc.metadata.description,
    author: doc.metadata.author,
    version: doc.metadata.version,
    tags: doc.tags,
    installCount: doc.stats?.installCount ?? 0,
    viewCount: doc.stats?.viewCount ?? 0,
    isPublished: doc.isPublished,
    releaseStatus: getEffectiveReleaseStatus(doc),
    trustScore: (() => { const ts = computeTrustScore(doc); return { overall: ts.overall, grade: ts.grade }; })(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/** Auth check result — either session with user ID or error response */
export type AuthResult =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

/** Check authentication — returns userId or 401 response */
export async function requireAuth(request?: Pick<Request, "headers">): Promise<AuthResult> {
  const authHeader = await (async () => {
    if (request) {
      return request.headers.get("authorization");
    }

    try {
      const headerStore = await headers();
      return headerStore.get("authorization");
    } catch {
      return null;
    }
  })();

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) {
      return { ok: false, response: NextResponse.json({ error: "Bearer token required" }, { status: 401 }) };
    }

    const db = await getDb();
    const tokenDoc = await validateApiToken(db, token);
    if (!tokenDoc) {
      return { ok: false, response: NextResponse.json({ error: "Invalid or expired API token" }, { status: 401 }) };
    }
    if (!tokenDoc.userId) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Personal API token required for this route" }, { status: 403 }),
      };
    }

    return { ok: true, userId: tokenDoc.userId.toHexString() };
  }

  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { ok: true, userId: session.user.id };
}

/** Get team IDs the user belongs to */
export async function getUserTeamIds(db: Db, userId: string): Promise<ObjectId[]> {
  const user = await db.collection("users").findOne(
    { _id: new ObjectId(userId) },
    { projection: { teamMemberships: 1 } }
  );
  return (user?.teamMemberships || []).map((m: { teamId: ObjectId }) => m.teamId);
}

/** Check if user is a member of a specific team */
export async function isTeamMember(db: Db, userId: string, teamId: ObjectId): Promise<boolean> {
  const user = await db.collection("users").findOne(
    {
      _id: new ObjectId(userId),
      "teamMemberships.teamId": teamId,
    },
    { projection: { _id: 1 } }
  );
  return user !== null;
}

/** Get the user's role in a specific team, or null if not a member */
export async function getMemberRole(
  db: Db,
  userId: ObjectId,
  teamId: ObjectId
): Promise<TeamRole | null> {
  const user = await db.collection("users").findOne(
    {
      _id: userId,
      "teamMemberships.teamId": teamId,
    },
    { projection: { "teamMemberships.$": 1 } }
  );
  if (!user?.teamMemberships?.[0]) return null;
  return user.teamMemberships[0].role as TeamRole;
}

/** Get the user's org role in a specific organization, or null if not a member */
export async function getOrgRole(
  db: Db,
  userId: ObjectId,
  orgId: ObjectId
): Promise<OrgRole | null> {
  const user = await db.collection("users").findOne(
    {
      _id: userId,
      "orgMemberships.orgId": orgId,
    },
    { projection: { "orgMemberships.$": 1 } }
  );
  if (!user?.orgMemberships?.[0]) return null;
  return user.orgMemberships[0].role as OrgRole;
}

export async function requireOrgPermission(
  db: Db,
  userId: ObjectId,
  orgId: ObjectId,
  permission: Permission
): Promise<OrgRole | null> {
  const role = await getOrgRole(db, userId, orgId);
  if (!role || !hasOrgPermission(role, permission)) {
    return null;
  }
  return role;
}
