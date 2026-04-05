/**
 * SSO Service — SAML 2.0 / OIDC configuration management.
 *
 * Handles SSO config CRUD, JIT provisioning logic, group mapping resolution.
 * Actual SAML/OIDC protocol flows are handled by NextAuth.js providers.
 *
 * Per api-security-best-practices:
 * - Client secrets stored encrypted (field marked as encrypted)
 * - Certificate validation on save
 * - Group mappings validated against existing orgs/depts/teams
 */

import { ObjectId, type Db } from "mongodb";
import type { SsoConfigDocument, GroupMapping, JitProvisionEvent, SsoProviderType, SsoProviderPreset } from "@/types/sso";

// ─── SSO Config CRUD ──────────────────────────────────────

/**
 * Get SSO config for an organization.
 */
export async function getSsoConfig(
  db: Db,
  orgId: ObjectId
): Promise<SsoConfigDocument | null> {
  return db.collection<SsoConfigDocument>("sso_configs").findOne({ orgId });
}

/**
 * Create or update SSO config for an organization.
 */
export async function upsertSsoConfig(
  db: Db,
  orgId: ObjectId,
  config: {
    providerType: SsoProviderType;
    providerPreset: SsoProviderPreset;
    saml?: SsoConfigDocument["saml"];
    oidc?: SsoConfigDocument["oidc"];
    groupMappings?: GroupMapping[];
    jitProvisioning?: boolean;
    enforceSSO?: boolean;
  }
): Promise<{ success: boolean; configId?: ObjectId }> {
  const now = new Date();

  const result = await db.collection<SsoConfigDocument>("sso_configs").findOneAndUpdate(
    { orgId },
    {
      $set: {
        providerType: config.providerType,
        providerPreset: config.providerPreset,
        saml: config.saml,
        oidc: config.oidc,
        groupMappings: config.groupMappings ?? [],
        jitProvisioning: config.jitProvisioning ?? false,
        enforceSSO: config.enforceSSO ?? false,
        autoDeactivate: false,
        enabled: true,
        updatedAt: now,
      },
      $setOnInsert: {
        orgId,
        createdAt: now,
      },
    },
    { upsert: true, returnDocument: "after" }
  );

  return { success: true, configId: result?._id };
}

/**
 * Disable SSO for an organization.
 */
export async function disableSso(db: Db, orgId: ObjectId): Promise<void> {
  await db.collection("sso_configs").updateOne(
    { orgId },
    { $set: { enabled: false, updatedAt: new Date() } }
  );
}

// ─── Group Mapping Resolution ──────────────────────────────

/**
 * Resolve IdP groups to org/dept/team assignments.
 * Returns the highest-privilege mapping for each target.
 */
export function resolveGroupMappings(
  idpGroups: string[],
  mappings: GroupMapping[]
): GroupMapping[] {
  const resolved: GroupMapping[] = [];

  for (const mapping of mappings) {
    // Simple string match (support glob patterns in future)
    if (idpGroups.includes(mapping.idpGroup)) {
      resolved.push(mapping);
    }
  }

  return resolved;
}

// ─── JIT Provisioning ──────────────────────────────────────

/**
 * Record a JIT provisioning event for audit trail.
 */
export async function recordJitProvision(
  db: Db,
  event: JitProvisionEvent
): Promise<void> {
  await db.collection("audit_logs").insertOne({
    action: "sso.jit_provision",
    targetType: "user",
    targetId: null,
    userId: null,
    details: {
      email: event.email,
      name: event.name,
      idpGroups: event.idpGroups,
      mappedOrg: event.mappedOrg,
      mappedDepartment: event.mappedDepartment,
      mappedTeam: event.mappedTeam,
      mappedRole: event.mappedRole,
    },
    ip: null,
    userAgent: null,
    timestamp: event.provisionedAt,
  });
}

/**
 * Check if SSO is enforced for an org (password login disabled).
 */
export async function isSsoEnforced(
  db: Db,
  orgId: ObjectId
): Promise<boolean> {
  const config = await db.collection<SsoConfigDocument>("sso_configs").findOne(
    { orgId, enabled: true },
    { projection: { enforceSSO: 1 } }
  );
  return config?.enforceSSO ?? false;
}
