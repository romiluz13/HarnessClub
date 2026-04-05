/**
 * POST /api/v1/tokens — Create a new API token.
 * GET /api/v1/tokens — List user's tokens (metadata only, no secrets).
 * DELETE not supported via API tool — use PATCH to revoke.
 *
 * Per api-security-best-practices: auth required, raw token shown once.
 */

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/api-helpers";
import { createApiToken, listUserTokens, type TokenScope, type TokenType } from "@/services/api-token-service";

const VALID_SCOPES: TokenScope[] = ["read", "write", "admin"];
const VALID_TYPES: TokenType[] = ["personal", "service_account"];

export async function GET() {
  const authResult = await requireAuth();
  if (!authResult.ok) return authResult.response;

  const db = await getDb();
  const userId = new ObjectId(authResult.userId);
  const tokens = await listUserTokens(db, userId);

  return NextResponse.json({
    tokens: tokens.map((t) => ({
      id: t._id.toHexString(),
      name: t.name,
      prefix: t.tokenPrefix,
      scope: t.scope,
      tokenType: t.tokenType,
      lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
      usageCount: t.usageCount,
      expiresAt: t.expiresAt.toISOString(),
      createdAt: t.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (!authResult.ok) return authResult.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, scope, tokenType, orgId, teamId, expiresInDays } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!scope || !VALID_SCOPES.includes(scope as TokenScope)) {
    return NextResponse.json({ error: `scope must be: ${VALID_SCOPES.join(", ")}` }, { status: 400 });
  }
  if (!orgId || typeof orgId !== "string") {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }

  const db = await getDb();
  const userId = new ObjectId(authResult.userId);

  const result = await createApiToken(db, {
    name: name as string,
    tokenType: VALID_TYPES.includes(tokenType as TokenType) ? (tokenType as TokenType) : "personal",
    userId,
    orgId: new ObjectId(orgId as string),
    teamId: teamId ? new ObjectId(teamId as string) : undefined,
    scope: scope as TokenScope,
    expiresInDays: typeof expiresInDays === "number" ? expiresInDays : 90,
  });

  return NextResponse.json(
    {
      tokenId: result.tokenId.toHexString(),
      rawToken: result.rawToken,
      prefix: result.prefix,
      expiresAt: result.expiresAt.toISOString(),
      message: "Token created. Save the rawToken — it will not be shown again.",
    },
    { status: 201 }
  );
}
