/**
 * Enterprise Governance Tests — REAL DB round-trips.
 *
 * Tests: SSO config via service + DB, API token lifecycle via service + DB,
 * audit log writing via service + DB. Zero string-literal tests.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ObjectId, type Db } from "mongodb";
import { getTestDb, closeTestDb } from "../helpers/db-setup";
import { resolveGroupMappings, upsertSsoConfig, getSsoConfig, disableSso } from "@/services/sso-service";
import { createApiToken, validateApiToken, revokeApiToken } from "@/services/api-token-service";
import { logAuditEvent, getAuditLogs, exportToSiem } from "@/services/audit-service";
import type { GroupMapping } from "@/types/sso";

let db: Db;
const orgId = new ObjectId();
const teamId = new ObjectId();
const userId = new ObjectId();
const otherUserId = new ObjectId();
const deptId = new ObjectId();

beforeAll(async () => {
  db = await getTestDb();
}, 30_000);

afterAll(async () => {
  // Clean up governance test data
  await db.collection("sso_configs").deleteMany({ orgId });
  await db.collection("api_tokens").deleteMany({ orgId });
  await db.collection("audit_logs").deleteMany({ teamId });
  await closeTestDb();
});

// ─── SSO: real DB round-trip ────────────────────────────────

describe("SSO Config — DB round-trip", () => {
  it("upserts SAML config and reads it back", async () => {
    const result = await upsertSsoConfig(db, orgId, {
      providerType: "saml",
      providerPreset: "okta",
      saml: {
        entityId: "https://sso.okta.com/app/xyz",
        ssoUrl: "https://sso.okta.com/app/xyz/sso/saml",
        certificate: "-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----",
        spEntityId: "https://agentconfig.dev/api/auth/saml",
        nameIdFormat: "email",
        attributeMapping: { email: "email" },
      },
      jitProvisioning: true,
      enforceSSO: false,
    });
    expect(result.success).toBe(true);
    expect(result.configId).toBeDefined();

    const config = await getSsoConfig(db, orgId);
    expect(config).not.toBeNull();
    expect(config!.providerType).toBe("saml");
    expect(config!.saml!.entityId).toBe("https://sso.okta.com/app/xyz");
    expect(config!.jitProvisioning).toBe(true);
    expect(config!.enabled).toBe(true);
  });

  it("disables SSO and verifies", async () => {
    await disableSso(db, orgId);
    const config = await getSsoConfig(db, orgId);
    expect(config!.enabled).toBe(false);
  });
});

describe("SSO Group Mapping Resolution", () => {
  const mappings: GroupMapping[] = [
    { idpGroup: "engineering", orgId, departmentId: deptId, role: "member" },
    { idpGroup: "engineering-leads", orgId, departmentId: deptId, role: "dept_admin" },
    { idpGroup: "admins", orgId, role: "org_admin" },
    { idpGroup: "sales", orgId, teamId, role: "member" },
  ];

  it("resolves single group match", () => {
    const resolved = resolveGroupMappings(["engineering"], mappings);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].role).toBe("member");
    expect(resolved[0].departmentId).toEqual(deptId);
  });

  it("resolves multiple group matches", () => {
    const resolved = resolveGroupMappings(["engineering", "admins"], mappings);
    expect(resolved).toHaveLength(2);
    const roles = resolved.map((r) => r.role);
    expect(roles).toContain("member");
    expect(roles).toContain("org_admin");
  });

  it("returns empty for no matches", () => {
    expect(resolveGroupMappings(["unknown-group"], mappings)).toHaveLength(0);
  });
});

// ─── API Tokens: real DB round-trip ─────────────────────────

describe("API Token Lifecycle — DB round-trip", () => {
  let rawToken: string;
  let tokenId: ObjectId;

  it("creates token in DB and returns raw token", async () => {
    const result = await createApiToken(db, {
      name: "governance-test-token",
      tokenType: "personal",
      userId,
      orgId,
      scope: "read",
      expiresInDays: 30,
    });
    expect(result.rawToken).toMatch(/^ac_[a-f0-9]{8}_/);
    expect(result.prefix).toMatch(/^ac_[a-f0-9]{8}$/);
    expect(result.tokenId).toBeInstanceOf(ObjectId);
    rawToken = result.rawToken;
    tokenId = result.tokenId;
  });

  it("validates token from DB with hash lookup", async () => {
    const token = await validateApiToken(db, rawToken);
    expect(token).not.toBeNull();
    expect(token!.name).toBe("governance-test-token");
    expect(token!.scope).toBe("read");
    expect(token!.revoked).toBe(false);
  });

  it("rejects invalid token", async () => {
    const token = await validateApiToken(db, "ac_fake1234_notreal");
    expect(token).toBeNull();
  });

  it("revokes token and validates rejection", async () => {
    const revoked = await revokeApiToken(db, tokenId, userId);
    expect(revoked).toBe(true);
    const token = await validateApiToken(db, rawToken);
    expect(token).toBeNull();
  });

  it("does not let a different user revoke someone else's token", async () => {
    const result = await createApiToken(db, {
      name: "ownership-test-token",
      tokenType: "personal",
      userId,
      orgId,
      scope: "read",
      expiresInDays: 30,
    });

    const revoked = await revokeApiToken(db, result.tokenId, otherUserId);
    expect(revoked).toBe(false);

    const token = await validateApiToken(db, result.rawToken);
    expect(token).not.toBeNull();
    expect(token!.revoked).toBe(false);
  });
});

// ─── Audit Logs: real DB round-trip ─────────────────────────

describe("Audit Logging — DB round-trip", () => {
  const targetId = new ObjectId();

  it("logs audit event and queries it back", async () => {
    await logAuditEvent(db, {
      actorId: userId,
      action: "asset:create",
      targetId,
      targetType: "skill",
      teamId,
      details: { name: "Test Skill" },
    });

    const logs = await getAuditLogs(db, { teamId, action: "asset:create" });
    expect(logs.length).toBeGreaterThanOrEqual(1);
    const found = logs.find((l) => l.targetId.equals(targetId));
    expect(found).toBeDefined();
    expect(found!.action).toBe("asset:create");
    expect(found!.details?.name).toBe("Test Skill");
  });

  it("exports audit logs in SIEM format", async () => {
    const events = await exportToSiem(db, { teamId });
    expect(events.length).toBeGreaterThanOrEqual(1);
    const found = events.find((e) => e.target === targetId.toHexString());
    expect(found).toBeDefined();
    expect(found!.source).toBe("agentconfig");
    expect(found!.severity).toBe("info");
    expect(found!.action).toBe("asset:create");
  });
});
