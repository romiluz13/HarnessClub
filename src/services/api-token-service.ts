/**
 * API Token Service — Personal access tokens + service account tokens.
 *
 * Per api-security-best-practices:
 * - Tokens are hashed (SHA256) before storage — raw token never stored
 * - Scoped to specific permissions (read-only, write, admin)
 * - Revocable instantly
 * - Expiration enforced
 * - Usage tracking (last used timestamp + IP)
 */

import { ObjectId, type Db } from "mongodb";
import { createHash, randomBytes } from "crypto";

/** Token scope — limits what the token can do */
export type TokenScope = "read" | "write" | "admin";

/** Token type */
export type TokenType = "personal" | "service_account";

/** API token document as stored in MongoDB */
export interface ApiTokenDocument {
  _id: ObjectId;
  /** Human-readable label */
  name: string;
  /** Token type */
  tokenType: TokenType;
  /** SHA256 hash of the raw token */
  tokenHash: string;
  /** Token prefix for identification (first 8 chars) */
  tokenPrefix: string;
  /** Owner user ID (null for service accounts owned by org) */
  userId?: ObjectId;
  /** Org that owns this token */
  orgId: ObjectId;
  /** Team scope (optional — restricts to single team) */
  teamId?: ObjectId;
  /** Permission scope */
  scope: TokenScope;
  /** Expiration date */
  expiresAt: Date;
  /** Whether token is revoked */
  revoked: boolean;
  /** Last usage tracking */
  lastUsedAt?: Date;
  lastUsedIp?: string;
  /** Usage count */
  usageCount: number;
  createdAt: Date;
}

const TOKEN_SCOPE_ORDER: Record<TokenScope, number> = {
  read: 1,
  write: 2,
  admin: 3,
};

/** Result of creating a token — includes raw token (shown only once) */
export interface TokenCreateResult {
  tokenId: ObjectId;
  /** Raw token — ONLY returned at creation time, never stored */
  rawToken: string;
  prefix: string;
  expiresAt: Date;
}

// ─── Token Lifecycle ──────────────────────────────────────

/**
 * Generate a new API token.
 * Returns the raw token — must be shown to user immediately (never stored).
 */
export async function createApiToken(
  db: Db,
  input: {
    name: string;
    tokenType: TokenType;
    userId?: ObjectId;
    orgId: ObjectId;
    teamId?: ObjectId;
    scope: TokenScope;
    /** Expiration in days (default: 90) */
    expiresInDays?: number;
  }
): Promise<TokenCreateResult> {
  // Generate 32-byte random token
  const raw = randomBytes(32).toString("hex");
  const prefix = `ac_${raw.slice(0, 8)}`;
  const fullToken = `${prefix}_${raw}`;
  const tokenHash = createHash("sha256").update(fullToken).digest("hex");

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (input.expiresInDays ?? 90));

  const doc: Omit<ApiTokenDocument, "_id"> = {
    name: input.name,
    tokenType: input.tokenType,
    tokenHash,
    tokenPrefix: prefix,
    userId: input.userId,
    orgId: input.orgId,
    teamId: input.teamId,
    scope: input.scope,
    expiresAt,
    revoked: false,
    usageCount: 0,
    createdAt: new Date(),
  };

  const result = await db.collection("api_tokens").insertOne(doc);

  return {
    tokenId: result.insertedId,
    rawToken: fullToken,
    prefix,
    expiresAt,
  };
}

/**
 * Validate an API token. Returns token info if valid, null if invalid/expired/revoked.
 */
export async function validateApiToken(
  db: Db,
  rawToken: string
): Promise<ApiTokenDocument | null> {
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  const token = await db.collection<ApiTokenDocument>("api_tokens").findOne({
    tokenHash,
    revoked: false,
    expiresAt: { $gt: new Date() },
  });

  if (token) {
    // Update usage stats (fire-and-forget)
    db.collection("api_tokens").updateOne(
      { _id: token._id },
      { $set: { lastUsedAt: new Date() }, $inc: { usageCount: 1 } }
    );
  }

  return token;
}

export function hasTokenScope(
  token: Pick<ApiTokenDocument, "scope">,
  requiredScope: TokenScope
): boolean {
  return TOKEN_SCOPE_ORDER[token.scope] >= TOKEN_SCOPE_ORDER[requiredScope];
}

/**
 * Revoke a token.
 */
export async function revokeApiToken(
  db: Db,
  tokenId: ObjectId,
  userId: ObjectId
): Promise<boolean> {
  const result = await db.collection("api_tokens").updateOne(
    { _id: tokenId, userId, revoked: false },
    { $set: { revoked: true } }
  );
  return result.modifiedCount > 0;
}

/**
 * List tokens for a user (shows prefix + metadata, never the hash).
 */
export async function listUserTokens(
  db: Db,
  userId: ObjectId
): Promise<Array<Omit<ApiTokenDocument, "tokenHash">>> {
  return db.collection<ApiTokenDocument>("api_tokens")
    .find({ userId, revoked: false }, { projection: { tokenHash: 0 } })
    .sort({ createdAt: -1 })
    .toArray();
}
