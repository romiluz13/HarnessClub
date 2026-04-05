/**
 * SCIM 2.0 Directory Sync Service.
 *
 * Handles auto-provisioning and deprovisioning users via SCIM protocol.
 * IdP (Okta, Azure AD, etc.) pushes user/group changes to our SCIM endpoint.
 *
 * Per SCIM spec (RFC 7644):
 * - /Users endpoint for user CRUD
 * - /Groups endpoint for group CRUD
 * - Filter expressions for search
 * - Bulk operations for batch sync
 *
 * Per api-security-best-practices: bearer token auth for SCIM endpoint.
 */

import { ObjectId, type Db } from "mongodb";

/** SCIM user resource */
export interface ScimUser {
  /** SCIM resource ID (maps to our userId) */
  id?: string;
  /** SCIM external ID from IdP */
  externalId: string;
  /** Username (usually email) */
  userName: string;
  /** Display name */
  displayName: string;
  /** Name components */
  name: {
    givenName: string;
    familyName: string;
  };
  /** Emails */
  emails: Array<{ value: string; primary: boolean }>;
  /** Groups from IdP */
  groups?: Array<{ value: string; display: string }>;
  /** Active status */
  active: boolean;
}

/** SCIM sync status per org */
export interface ScimSyncStatus {
  orgId: ObjectId;
  lastSyncAt: Date;
  totalUsers: number;
  provisioned: number;
  deprovisioned: number;
  errors: number;
  status: "idle" | "syncing" | "error";
}

/**
 * Process a SCIM user create/update event.
 * Auto-provisions user into org based on group mappings.
 */
export async function processScimUser(
  db: Db,
  orgId: ObjectId,
  scimUser: ScimUser
): Promise<{ action: "created" | "updated" | "deactivated"; userId: ObjectId }> {
  const email = scimUser.emails.find((e) => e.primary)?.value ?? scimUser.userName;

  // Find or create user
  const existingUser = await db.collection("users").findOne({ email });

  if (existingUser) {
    // Update existing user
    const updates: Record<string, unknown> = {
      name: scimUser.displayName,
      updatedAt: new Date(),
    };

    if (!scimUser.active) {
      updates.deactivatedAt = new Date();
      updates.deactivatedBy = "scim";
    }

    await db.collection("users").updateOne(
      { _id: existingUser._id },
      { $set: updates }
    );

    return {
      action: scimUser.active ? "updated" : "deactivated",
      userId: existingUser._id,
    };
  }

  // Create new user
  const now = new Date();
  const result = await db.collection("users").insertOne({
    name: scimUser.displayName,
    email,
    image: null,
    provider: "scim",
    providerId: scimUser.externalId,
    teamMemberships: [],
    orgMemberships: [{
      orgId,
      role: "member",
      joinedAt: now,
    }],
    createdAt: now,
    updatedAt: now,
  });

  // Log the provisioning
  await db.collection("audit_logs").insertOne({
    action: "scim.user_provisioned",
    targetType: "user",
    targetId: result.insertedId,
    userId: null,
    details: {
      email,
      externalId: scimUser.externalId,
      orgId: orgId.toHexString(),
    },
    timestamp: now,
  });

  return { action: "created", userId: result.insertedId };
}

/**
 * Get SCIM sync status for an org.
 */
export async function getScimSyncStatus(
  db: Db,
  orgId: ObjectId
): Promise<ScimSyncStatus | null> {
  return db.collection<ScimSyncStatus>("scim_sync_status").findOne({ orgId });
}

/**
 * Update SCIM sync status.
 */
export async function updateSyncStatus(
  db: Db,
  orgId: ObjectId,
  stats: Partial<ScimSyncStatus>
): Promise<void> {
  await db.collection("scim_sync_status").updateOne(
    { orgId },
    { $set: { ...stats, lastSyncAt: new Date() } },
    { upsert: true }
  );
}
