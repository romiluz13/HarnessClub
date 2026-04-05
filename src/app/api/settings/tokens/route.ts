/**
 * GET   /api/settings/tokens — List user's API tokens.
 * POST  /api/settings/tokens — Create a new token.
 * PATCH /api/settings/tokens — Revoke a token.
 *
 * Calls real api-token-service for DB operations.
 */

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/api-helpers";
import { createApiToken, revokeApiToken, listUserTokens } from "@/services/api-token-service";
import { logAuditEvent } from "@/services/audit-service";
import type { UserDocument } from "@/types/user";

export async function GET() {
  const authResult = await requireAuth();
  if (!authResult.ok) return authResult.response;

  const db = await getDb();
  const userId = new ObjectId(authResult.userId);

  // Get user's org
  const user = await db.collection<UserDocument>("users").findOne({ _id: userId });
  const orgId = user?.orgMemberships?.[0]?.orgId;
  if (!orgId) {
    return NextResponse.json({ tokens: [] });
  }

  const tokens = await listUserTokens(db, userId);

  return NextResponse.json({
    tokens: tokens.map((t) => ({
      id: t._id.toHexString(),
      name: t.name,
      prefix: t.tokenPrefix,
      scope: t.scope,
      createdAt: t.createdAt.toISOString(),
      expiresAt: t.expiresAt?.toISOString() ?? null,
      revoked: t.revoked,
    })),
  });
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (!authResult.ok) return authResult.response;

  let body: { name: string; scope?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const db = await getDb();
  const userId = new ObjectId(authResult.userId);
  const user = await db.collection<UserDocument>("users").findOne({ _id: userId });
  const orgId = user?.orgMemberships?.[0]?.orgId;
  if (!orgId) {
    return NextResponse.json({ error: "No organization found" }, { status: 400 });
  }

  const validScopes = ["read", "write", "admin"];
  const scope = validScopes.includes(body.scope ?? "") ? body.scope! : "read";

  const result = await createApiToken(db, {
    name: body.name.trim(),
    tokenType: "personal",
    userId,
    orgId,
    scope: scope as "read" | "write" | "admin",
    expiresInDays: 90,
  });

  await logAuditEvent(db, {
    actorId: userId,
    action: "auth:token_create",
    targetId: result.tokenId,

    teamId: user?.teamMemberships?.[0]?.teamId ?? orgId,
    details: { name: body.name.trim(), scope },
  });

  return NextResponse.json({
    tokenId: result.tokenId.toHexString(),
    rawToken: result.rawToken,
    prefix: result.prefix,
  }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const authResult = await requireAuth();
  if (!authResult.ok) return authResult.response;

  let body: { tokenId: string; action: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.action !== "revoke" || !body.tokenId) {
    return NextResponse.json({ error: "action=revoke and tokenId are required" }, { status: 400 });
  }

  const db = await getDb();
  const userId = new ObjectId(authResult.userId);
  if (!ObjectId.isValid(body.tokenId)) {
    return NextResponse.json({ error: "Invalid tokenId" }, { status: 400 });
  }
  const tokenId = new ObjectId(body.tokenId);

  const revoked = await revokeApiToken(db, tokenId, userId);
  if (!revoked) {
    return NextResponse.json({ error: "Token not found or already revoked" }, { status: 404 });
  }

  await logAuditEvent(db, {
    actorId: userId,
    action: "auth:token_revoke",
    targetId: tokenId,
    targetType: "api_token",
    teamId: userId, // best effort
    details: {},
  });

  return NextResponse.json({ success: true });
}
