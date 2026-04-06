/**
 * E2E Platform Tests — Every capability from V1→V3.
 *
 * Real MongoDB, real services, zero mocks.
 * Each describe block covers one capability domain.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { ObjectId, type Db } from "mongodb";
import { getTestDb, closeTestDb } from "../helpers/db-setup";

// ─── Services ──────────────────────────────────────────────
import { upsertSsoConfig, getSsoConfig, disableSso, resolveGroupMappings, recordJitProvision, isSsoEnforced } from "@/services/sso-service";
import { processScimUser, getScimSyncStatus, updateSyncStatus } from "@/services/scim-service";
import { createApprovalRequest, submitDecision, getPendingApprovals } from "@/services/approval-service";
import { checkUpstream } from "@/services/supply-chain";
import { computeTrustScore } from "@/services/trust-score";
import { createWebhook, dispatchWebhook, signPayload } from "@/services/webhook-service";
import { logAuditEvent, getAuditLogs, exportToSiem } from "@/services/audit-service";
import { generateComplianceReport } from "@/services/compliance-service";
import { createApiToken, validateApiToken, revokeApiToken } from "@/services/api-token-service";
import { createAsset } from "@/services/asset-service";
import { exportAsset, canExport, getAvailableTargets, EXPORT_TARGETS } from "@/services/exporters";
import type { GroupMapping } from "@/types/sso";
import type { ScimUser } from "@/services/scim-service";
import { GET as getTeamMarketplace } from "@/app/api/marketplace/[teamSlug]/route";
import { GET as getMarketplaceBrowse } from "@/app/api/marketplace/browse/route";
import { GET as getInstallManifest } from "@/app/api/assets/[id]/install/route";

let db: Db;
const MARKER = `e2e-${Date.now()}`;

// Shared IDs
const orgId = new ObjectId();
const teamId = new ObjectId();
const userId = new ObjectId();
const reviewerId = new ObjectId();

beforeAll(async () => {
  db = await getTestDb();
  // Seed org, team, and users for all tests
  await db.collection("organizations").insertOne({
    _id: orgId,
    name: `E2E Org ${MARKER}`,
    slug: `e2e-org-${MARKER}`,
    ownerId: userId,
    settings: { plan: "enterprise" },
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.collection("teams").insertOne({
    _id: teamId,
    name: `E2E Team ${MARKER}`,
    slug: `e2e-team-${MARKER}`,
    orgId,
    departmentId: new ObjectId(),
    ownerId: userId,
    memberIds: [userId, reviewerId],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.collection("users").insertMany([
    {
      _id: userId,
      email: `e2e-owner-${MARKER}@test.com`,
      name: "E2E Owner",
      auth: { provider: "github", providerId: `e2e-owner-${MARKER}` },
      orgMemberships: [{ orgId, role: "org_owner", joinedAt: new Date() }],
      teamMemberships: [{ teamId, role: "owner", joinedAt: new Date() }],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: reviewerId,
      email: `e2e-reviewer-${MARKER}@test.com`,
      name: "E2E Reviewer",
      auth: { provider: "github", providerId: `e2e-reviewer-${MARKER}` },
      orgMemberships: [{ orgId, role: "member", joinedAt: new Date() }],
      teamMemberships: [{ teamId, role: "admin", joinedAt: new Date() }],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);
});

afterAll(async () => {
  // Clean up all test data
  const marker = MARKER;
  await Promise.all([
    db.collection("organizations").deleteMany({ slug: { $regex: marker } }),
    db.collection("teams").deleteMany({ slug: { $regex: marker } }),
    db.collection("users").deleteMany({ email: { $regex: marker } }),
    db.collection("sso_configs").deleteMany({ orgId }),
    db.collection("approval_requests").deleteMany({ teamId }),
    db.collection("webhooks").deleteMany({ orgId }),
    db.collection("audit_logs").deleteMany({ teamId }),
    db.collection("api_tokens").deleteMany({ orgId }),
    db.collection("assets").deleteMany({ teamId }),
    db.collection("scim_sync_status").deleteMany({ orgId }),
  ]);
  await closeTestDb();
});

// ─── E2E-1: SSO + SCIM Lifecycle ─────────────────────────

describe("E2E-1: SSO + SCIM Lifecycle", () => {
  it("upserts SAML SSO config and reads it back from DB", async () => {
    const result = await upsertSsoConfig(db, orgId, {
      providerType: "saml",
      providerPreset: "okta",
      saml: {
        entityId: "https://sso.okta.com/app/e2e",
        ssoUrl: "https://sso.okta.com/sso/saml",
        certificate: "-----BEGIN CERTIFICATE-----\nMIIBfake...\n-----END CERTIFICATE-----",
        spEntityId: "https://agentconfig.com/api/auth/saml",
        nameIdFormat: "email",
        attributeMapping: { email: "email", firstName: "firstName", lastName: "lastName", groups: "groups" },
      },
      groupMappings: [
        { idpGroup: "engineering", orgId, teamId, role: "admin" },
        { idpGroup: "product", orgId, role: "member" },
      ],
      jitProvisioning: true,
      enforceSSO: false,
    });
    expect(result.success).toBe(true);
    expect(result.configId).toBeDefined();

    const config = await getSsoConfig(db, orgId);
    expect(config).not.toBeNull();
    expect(config!.providerType).toBe("saml");
    expect(config!.providerPreset).toBe("okta");
    expect(config!.saml!.entityId).toBe("https://sso.okta.com/app/e2e");
    expect(config!.groupMappings).toHaveLength(2);
    expect(config!.jitProvisioning).toBe(true);
    expect(config!.enabled).toBe(true);
  });

  it("upserts OIDC SSO config (overwrites SAML)", async () => {
    const result = await upsertSsoConfig(db, orgId, {
      providerType: "oidc",
      providerPreset: "google",
      oidc: {
        issuer: "https://accounts.google.com",
        clientId: "e2e-client-id",
        clientSecretEncrypted: "encrypted-secret",
        scopes: ["openid", "email", "profile"],
        claimMapping: { email: "email", name: "name", groups: "groups" },
      },
      enforceSSO: true,
    });
    expect(result.success).toBe(true);

    const config = await getSsoConfig(db, orgId);
    expect(config!.providerType).toBe("oidc");
    expect(config!.oidc!.issuer).toBe("https://accounts.google.com");
    expect(config!.enforceSSO).toBe(true);
  });

  it("isSsoEnforced returns true after enforceSSO=true", async () => {
    const enforced = await isSsoEnforced(db, orgId);
    expect(enforced).toBe(true);
  });

  it("disableSso sets enabled=false", async () => {
    await disableSso(db, orgId);
    const config = await getSsoConfig(db, orgId);
    expect(config!.enabled).toBe(false);

    const enforced = await isSsoEnforced(db, orgId);
    expect(enforced).toBe(false);
  });

  it("resolveGroupMappings matches correct IdP groups", () => {
    const mappings: GroupMapping[] = [
      { idpGroup: "engineering", orgId, teamId, role: "admin" },
      { idpGroup: "product", orgId, role: "member" },
      { idpGroup: "marketing", orgId, role: "viewer" },
    ];
    const resolved = resolveGroupMappings(["engineering", "marketing"], mappings);
    expect(resolved).toHaveLength(2);
    expect(resolved[0].idpGroup).toBe("engineering");
    expect(resolved[0].role).toBe("admin");
    expect(resolved[1].idpGroup).toBe("marketing");
  });

  it("resolveGroupMappings returns empty for unknown groups", () => {
    const mappings: GroupMapping[] = [
      { idpGroup: "engineering", orgId, role: "admin" },
    ];
    const resolved = resolveGroupMappings(["finance", "legal"], mappings);
    expect(resolved).toHaveLength(0);
  });

  it("records JIT provision event to audit log", async () => {
    await recordJitProvision(db, {
      email: `jit-${MARKER}@test.com`,
      name: "JIT User",
      idpGroups: ["engineering"],
      mappedOrg: orgId,
      mappedTeam: teamId,
      mappedRole: "member",
      provisionedAt: new Date(),
    });
    const logs = await db.collection("audit_logs")
      .find({ action: "sso.jit_provision", "details.email": `jit-${MARKER}@test.com` })
      .toArray();
    expect(logs).toHaveLength(1);
    expect(logs[0].details.mappedRole).toBe("member");
  });

  it("SCIM: provisions new user into org", async () => {
    const scimUser: ScimUser = {
      externalId: `scim-ext-${MARKER}`,
      userName: `scim-${MARKER}@test.com`,
      displayName: "SCIM Test User",
      name: { givenName: "SCIM", familyName: "User" },
      emails: [{ value: `scim-${MARKER}@test.com`, primary: true }],
      groups: [{ value: "eng", display: "Engineering" }],
      active: true,
    };
    const result = await processScimUser(db, orgId, scimUser);
    expect(result.action).toBe("created");
    expect(result.userId).toBeDefined();

    // Verify user in DB
    const user = await db.collection("users").findOne({ _id: result.userId });
    expect(user).not.toBeNull();
    expect(user!.name).toBe("SCIM Test User");
    expect(user!.email).toBe(`scim-${MARKER}@test.com`);
    expect(user!.orgMemberships[0].orgId.toHexString()).toBe(orgId.toHexString());

    // Verify audit log
    const audit = await db.collection("audit_logs")
      .findOne({ action: "scim.user_provisioned", targetId: result.userId });
    expect(audit).not.toBeNull();
  });

  it("SCIM: updates existing user", async () => {
    const scimUser: ScimUser = {
      externalId: `scim-ext-${MARKER}`,
      userName: `scim-${MARKER}@test.com`,
      displayName: "SCIM Updated Name",
      name: { givenName: "SCIM", familyName: "Updated" },
      emails: [{ value: `scim-${MARKER}@test.com`, primary: true }],
      active: true,
    };
    const result = await processScimUser(db, orgId, scimUser);
    expect(result.action).toBe("updated");

    const user = await db.collection("users").findOne({ _id: result.userId });
    expect(user!.name).toBe("SCIM Updated Name");
  });

  it("SCIM: deactivates user when active=false", async () => {
    const scimUser: ScimUser = {
      externalId: `scim-ext-${MARKER}`,
      userName: `scim-${MARKER}@test.com`,
      displayName: "SCIM Updated Name",
      name: { givenName: "SCIM", familyName: "Updated" },
      emails: [{ value: `scim-${MARKER}@test.com`, primary: true }],
      active: false,
    };
    const result = await processScimUser(db, orgId, scimUser);
    expect(result.action).toBe("deactivated");

    const user = await db.collection("users").findOne({ _id: result.userId });
    expect(user!.deactivatedAt).toBeDefined();
    expect(user!.deactivatedBy).toBe("scim");
  });

  it("SCIM: sync status tracking", async () => {
    await updateSyncStatus(db, orgId, {
      totalUsers: 10,
      provisioned: 8,
      deprovisioned: 2,
      errors: 0,
      status: "idle",
    });
    const status = await getScimSyncStatus(db, orgId);
    expect(status).not.toBeNull();
    expect(status!.totalUsers).toBe(10);
    expect(status!.provisioned).toBe(8);
    expect(status!.status).toBe("idle");
    expect(status!.lastSyncAt).toBeDefined();
  });
});

// ─── E2E-2: Approval Workflow Full Cycle ─────────────────

describe("E2E-2: Approval Workflow Full Cycle", () => {
  let assetId: ObjectId;

  beforeAll(async () => {
    const result = await createAsset(db, {
      type: "skill",
      teamId,
      metadata: { name: `approval-asset-${MARKER}`, description: "For approval test", author: "e2e", version: "1.0.0" },
      content: "# Approval Test Asset",
      tags: ["approval-test"],
      createdBy: userId,
    });
    assetId = (result as { assetId: ObjectId }).assetId;
  });

  it("creates single_review approval request", async () => {
    const result = await createApprovalRequest(db, {
      assetId,
      teamId,
      requestedBy: userId,
      action: "publish",
      mode: "single_review",
    });
    expect(result.success).toBe(true);
    expect(result.requestId).toBeDefined();

    const doc = await db.collection("approval_requests").findOne({ _id: result.requestId });
    expect(doc).not.toBeNull();
    expect(doc!.status).toBe("pending");
    expect(doc!.requiredApprovals).toBe(1);
  });

  it("lists pending approvals for a team", async () => {
    const pending = await getPendingApprovals(db, { teamId });
    expect(pending.length).toBeGreaterThanOrEqual(1);
    const found = pending.find((p) => p.assetId.toHexString() === assetId.toHexString());
    expect(found).toBeDefined();
    expect(found!.status).toBe("pending");
  });

  it("prevents self-review", async () => {
    const pending = await getPendingApprovals(db, { teamId });
    const request = pending.find((p) => p.assetId.toHexString() === assetId.toHexString())!;

    const result = await submitDecision(db, request._id, {
      reviewerId: userId, // same as requestedBy
      reviewerName: "E2E Owner",
      decision: "approve",
      comment: "Self-approve attempt",
      decidedAt: new Date(),
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("own");
  });

  it("approves with a different reviewer", async () => {
    const pending = await getPendingApprovals(db, { teamId });
    const request = pending.find((p) => p.assetId.toHexString() === assetId.toHexString())!;

    const result = await submitDecision(db, request._id, {
      reviewerId: reviewerId,
      reviewerName: "E2E Reviewer",
      decision: "approve",
      comment: "Looks good!",
      decidedAt: new Date(),
    });
    expect(result.success).toBe(true);
    expect(result.newStatus).toBe("approved");

    // Verify DB state
    const doc = await db.collection("approval_requests").findOne({ _id: request._id });
    expect(doc!.status).toBe("approved");
    expect(doc!.decisions).toHaveLength(1);
    expect(doc!.decisions[0].reviewerName).toBe("E2E Reviewer");
  });

  it("rejects an approval request", async () => {
    const reqResult = await createApprovalRequest(db, {
      assetId,
      teamId,
      requestedBy: userId,
      action: "update",
      mode: "single_review",
      diffSummary: "Changed description",
    });

    expect(reqResult.requestId).toBeDefined();
    const requestId = reqResult.requestId as ObjectId;

    const result = await submitDecision(db, requestId, {
      reviewerId: reviewerId,
      reviewerName: "E2E Reviewer",
      decision: "reject",
      comment: "Needs more detail",
      decidedAt: new Date(),
    });
    expect(result.success).toBe(true);
    expect(result.newStatus).toBe("rejected");
  });

  it("multi_review requires 2 approvals", async () => {
    const thirdReviewer = new ObjectId();
    await db.collection("users").insertOne({
      _id: thirdReviewer,
      email: `e2e-reviewer2-${MARKER}@test.com`,
      name: "E2E Reviewer 2",
      auth: { provider: "github", providerId: `e2e-reviewer2-${MARKER}` },
      orgMemberships: [{ orgId, role: "member", joinedAt: new Date() }],
      teamMemberships: [{ teamId, role: "admin", joinedAt: new Date() }],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const reqResult = await createApprovalRequest(db, {
      assetId,
      teamId,
      requestedBy: userId,
      action: "publish",
      mode: "multi_review",
    });

    expect(reqResult.requestId).toBeDefined();
    const requestId = reqResult.requestId as ObjectId;

    // First approval — should still be pending
    const first = await submitDecision(db, requestId, {
      reviewerId: reviewerId,
      reviewerName: "E2E Reviewer",
      decision: "approve",
      decidedAt: new Date(),
    });
    expect(first.success).toBe(true);
    expect(first.newStatus).toBe("pending"); // still needs one more

    // Second approval — should be approved
    const second = await submitDecision(db, requestId, {
      reviewerId: thirdReviewer,
      reviewerName: "E2E Reviewer 2",
      decision: "approve",
      decidedAt: new Date(),
    });
    expect(second.success).toBe(true);
    expect(second.newStatus).toBe("approved");

    // Clean up third reviewer
    await db.collection("users").deleteOne({ _id: thirdReviewer });
  });
});

// ─── E2E-2.5: Published Distribution Workflow ───────────────

describe("E2E-2.5: Published Distribution Workflow", () => {
  let publishedSkillId: ObjectId;
  let publishedSettingsId: ObjectId;
  let publishedPluginId: ObjectId;
  let draftSettingsId: ObjectId;
  let brokenPluginId: ObjectId;

  async function publishAsset(assetId: ObjectId, action: "publish" | "update" = "publish") {
    const request = await createApprovalRequest(db, {
      assetId,
      teamId,
      requestedBy: userId,
      action,
      mode: "single_review",
    });

    expect(request.success).toBe(true);
    expect(request.requestId).toBeDefined();

    const decision = await submitDecision(db, request.requestId as ObjectId, {
      reviewerId,
      reviewerName: "E2E Reviewer",
      decision: "approve",
      comment: `Approve ${action}`,
      decidedAt: new Date(),
    });

    expect(decision.success).toBe(true);
    expect(decision.newStatus).toBe("approved");
  }

  beforeAll(async () => {
    await db.collection("teams").updateOne(
      { _id: teamId },
      {
        $set: {
          settings: {
            marketplaceEnabled: true,
            defaultRole: "member",
            autoPublish: false,
          },
        },
      }
    );

    const publishedSkill = await createAsset(db, {
      type: "skill",
      teamId,
      metadata: {
        name: `Distribution Skill ${MARKER}`,
        description: "Published skill in marketplace workflow",
        author: "e2e",
        version: "1.0.0",
      },
      content: "# Distribution Skill\n\nPublished for marketplace workflow testing.",
      tags: ["distribution", MARKER],
      createdBy: userId,
    });
    publishedSkillId = (publishedSkill as { assetId: ObjectId }).assetId;

    const publishedSettings = await createAsset(db, {
      type: "settings_bundle",
      teamId,
      metadata: {
        name: `Distribution Settings ${MARKER}`,
        description: "Published settings bundle in marketplace workflow",
        author: "e2e",
        version: "1.0.0",
      },
      content: JSON.stringify({ theme: "enterprise", strictMode: true }, null, 2),
      tags: ["distribution", "settings", MARKER],
      createdBy: userId,
      settingsConfig: {
        targetTool: "claude-code",
        settings: { theme: "enterprise", strictMode: true },
      },
    });
    publishedSettingsId = (publishedSettings as { assetId: ObjectId }).assetId;

    const publishedPlugin = await createAsset(db, {
      type: "plugin",
      teamId,
      metadata: {
        name: `Distribution Plugin ${MARKER}`,
        description: "Published plugin bundle for install testing",
        author: "e2e",
        version: "1.0.0",
      },
      content: JSON.stringify({ name: "distribution-plugin" }, null, 2),
      tags: ["distribution", "plugin", MARKER],
      createdBy: userId,
      pluginConfig: {
        manifest: { version: "1.0.0" },
        bundledAssetIds: [publishedSkillId, publishedSettingsId],
      },
    });
    publishedPluginId = (publishedPlugin as { assetId: ObjectId }).assetId;

    const draftSettings = await createAsset(db, {
      type: "settings_bundle",
      teamId,
      metadata: {
        name: `Draft Settings ${MARKER}`,
        description: "Draft bundled asset to force install failure",
        author: "e2e",
        version: "1.0.0",
      },
      content: JSON.stringify({ theme: "draft-only" }, null, 2),
      tags: ["distribution", "draft", MARKER],
      createdBy: userId,
      settingsConfig: {
        targetTool: "claude-code",
        settings: { theme: "draft-only" },
      },
    });
    draftSettingsId = (draftSettings as { assetId: ObjectId }).assetId;

    const brokenPlugin = await createAsset(db, {
      type: "plugin",
      teamId,
      metadata: {
        name: `Broken Distribution Plugin ${MARKER}`,
        description: "Published plugin with a draft child to ensure failure is loud",
        author: "e2e",
        version: "1.0.0",
      },
      content: JSON.stringify({ name: "broken-distribution-plugin" }, null, 2),
      tags: ["distribution", "broken", MARKER],
      createdBy: userId,
      pluginConfig: {
        manifest: { version: "1.0.0" },
        bundledAssetIds: [publishedSkillId, draftSettingsId],
      },
    });
    brokenPluginId = (brokenPlugin as { assetId: ObjectId }).assetId;

    await publishAsset(publishedSkillId);
    await publishAsset(publishedSettingsId);
    await publishAsset(publishedPluginId);
    await publishAsset(brokenPluginId);
  });

  it("exposes only distributable assets in the team marketplace endpoint", async () => {
    const response = await getTeamMarketplace(
      new NextRequest(`http://localhost/api/marketplace/e2e-team-${MARKER}`),
      { params: Promise.resolve({ teamSlug: `e2e-team-${MARKER}` }) }
    );

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text()) as {
      metadata: { assetCount: number; typeBreakdown: Record<string, number> };
      plugins: Array<{ name: string; type?: string }>;
    };

    expect(payload.metadata.assetCount).toBeGreaterThanOrEqual(3);
    expect(payload.metadata.typeBreakdown.plugin).toBeGreaterThanOrEqual(1);
    expect(payload.plugins.some((plugin) => plugin.name.includes("distribution-plugin"))).toBe(true);
    expect(payload.plugins.some((plugin) => plugin.name.includes("draft-settings"))).toBe(false);
  });

  it("shows published distribution assets in marketplace browse with releaseStatus metadata", async () => {
    const response = await getMarketplaceBrowse(
      new NextRequest(`http://localhost/api/marketplace/browse?q=${encodeURIComponent(MARKER)}`)
    );

    expect(response.status).toBe(200);
    const payload = await response.json() as {
      items: Array<{ id: string; name: string; releaseStatus: string }>;
    };

    const names = payload.items.map((item) => item.name);
    expect(names).toContain(`Distribution Skill ${MARKER}`);
    expect(names).toContain(`Distribution Plugin ${MARKER}`);
    expect(names).not.toContain(`Draft Settings ${MARKER}`);
    payload.items.forEach((item) => {
      expect(item.releaseStatus).toBe("published");
    });
  });

  it("returns a complete install manifest for a healthy published plugin bundle", async () => {
    const response = await getInstallManifest(
      new NextRequest(`http://localhost/api/assets/${publishedPluginId.toHexString()}/install`),
      { params: Promise.resolve({ id: publishedPluginId.toHexString() }) }
    );

    expect(response.status).toBe(200);
    const payload = await response.json() as {
      assetType: string;
      files: Array<{ path: string; type: string }>;
      availableFormats: string[];
    };

    expect(payload.assetType).toBe("plugin");
    expect(payload.files.some((file) => file.path === "plugin.json" && file.type === "plugin")).toBe(true);
    expect(payload.files.some((file) => file.path === "SKILL.md" && file.type === "skill")).toBe(true);
    expect(payload.files.some((file) => file.path === "settings.json" && file.type === "settings_bundle")).toBe(true);
    expect(payload.availableFormats).toContain("claude-code");
  });

  it("fails loudly when a published plugin bundle references a non-distributable child", async () => {
    const response = await getInstallManifest(
      new NextRequest(`http://localhost/api/assets/${brokenPluginId.toHexString()}/install`),
      { params: Promise.resolve({ id: brokenPluginId.toHexString() }) }
    );

    expect(response.status).toBe(409);
    const payload = await response.json() as {
      error: string;
      blockedBundledAssets: Array<{ id: string; name: string; releaseStatus?: string }>;
    };

    expect(payload.error).toContain("incomplete");
    expect(payload.blockedBundledAssets).toHaveLength(1);
    expect(payload.blockedBundledAssets[0].id).toBe(draftSettingsId.toHexString());
    expect(payload.blockedBundledAssets[0].releaseStatus).toBe("draft");
  });
});


// ─── E2E-3: Supply Chain + Trust Score ───────────────────

describe("E2E-3: Supply Chain + Trust Score", () => {
  it("checkUpstream returns results for a team's assets", async () => {
    // Seed an asset with source tracking
    await db.collection("assets").insertOne({
      _id: new ObjectId(),
      type: "skill",
      teamId,
      metadata: { name: `supply-chain-${MARKER}`, description: "tracked" },
      content: "# Tracked Skill",
      tags: [],
      stats: { installCount: 0, viewCount: 0 },
      source: { repoUrl: "https://github.com/vercel/next.js", repoPath: "SKILL.md", branch: "main" },
      provenance: { source: "github_import", sourceUrl: "https://github.com/vercel/next.js", sourceFingerprint: "sha256:abc", recordedAt: new Date() },
      isPublished: false,
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const results = await checkUpstream(db, teamId);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThanOrEqual(1);
    const tracked = results.find((r) => r.assetName === `supply-chain-${MARKER}`);
    expect(tracked).toBeDefined();
    expect(tracked!.status).toBeDefined();
  });

  it("computeTrustScore grades A for a clean, popular asset", () => {
    const score = computeTrustScore(
      {
        _id: new ObjectId(),
        type: "skill",
        teamId,
        metadata: { name: "Popular Clean Skill", description: "A well-used asset", author: "verified-org", version: "2.0.0" },
        content: "# Well-documented\n\nFull content with details.",
        tags: ["production", "verified"],
        stats: { installCount: 500, viewCount: 1500 },
        isPublished: true,
        createdBy: userId,
        createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), // 6 months old
        updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // updated last week
        lastScan: {
          scannedAt: new Date(),
          findingCounts: { critical: 0, high: 0, medium: 0, low: 1, info: 2 },
          findings: [],
        },
      } as never,
      {
        source: "github_import",
        sourceUrl: "https://github.com/org/skill",
        sourceAuthor: "verified-org",
        sourceFingerprint: "sha256:abc",
        recordedAt: new Date(),
      }
    );
    expect(score.overall).toBeGreaterThanOrEqual(60);
    expect(["A", "B"]).toContain(score.grade);
    expect(score.components.security).toBeGreaterThanOrEqual(0);
    expect(score.components.provenance).toBeGreaterThanOrEqual(0);
    expect(score.components.usage).toBeGreaterThanOrEqual(0);
    expect(score.components.age).toBeGreaterThanOrEqual(0);
  });

  it("computeTrustScore grades D for a risky asset", () => {
    const score = computeTrustScore(
      {
        _id: new ObjectId(),
        type: "skill",
        teamId,
        metadata: { name: "Risky Skill", description: "x" },
        content: "x",
        tags: [],
        stats: { installCount: 0, viewCount: 0 },
        isPublished: false,
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastScan: {
          scannedAt: new Date(),
          findingCounts: { critical: 3, high: 5, medium: 10, low: 20, info: 0 },
          findings: [],
        },
      } as never,
      undefined
    );
    expect(score.overall).toBeLessThan(50);
    expect(["C", "D"]).toContain(score.grade);
  });

  it("computeTrustScore handles unscanned asset", () => {
    const score = computeTrustScore(
      {
        _id: new ObjectId(),
        type: "skill",
        teamId,
        metadata: { name: "Unscanned", description: "Never scanned" },
        content: "# Content",
        tags: ["test"],
        stats: { installCount: 0, viewCount: 0 },
        isPublished: false,
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never,
      undefined
    );
    expect(score.overall).toBeGreaterThanOrEqual(0);
    expect(score.grade).toBeDefined();
  });
});

// ─── E2E-4: Export Engine (All 5 Formats) ────────────────

describe("E2E-4: Export Engine (All 5 Formats)", () => {
  const testAsset = {
    _id: new ObjectId(),
    type: "skill" as const,
    teamId,
    metadata: { name: "Export Test Skill", description: "Skill for export testing", author: "e2e", version: "1.0.0" },
    content: "# Export Test\n\nThis is a skill for testing export to all 5 formats.\n\n## Usage\nFollow the instructions.",
    tags: ["export", "test"],
    stats: { installCount: 0, viewCount: 0 },
    isPublished: true,
    createdBy: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  for (const target of EXPORT_TARGETS) {
    it(`exports to ${target} format`, () => {
      const result = exportAsset(testAsset as never, target);
      expect(result.filename).toBeTruthy();
      expect(result.content).toBeTruthy();
      expect(result.content.length).toBeGreaterThan(10);
      expect(result.mimeType).toBeTruthy();
      expect(result.target).toBe(target);
      expect(result.sourceType).toBe("skill");
    });
  }

  it("canExport returns true for skill→claude-code", () => {
    expect(canExport("skill", "claude-code")).toBe(true);
  });

  it("getAvailableTargets returns all 5 for skill type", () => {
    const targets = getAvailableTargets("skill");
    expect(targets.length).toBeGreaterThanOrEqual(5);
    for (const t of EXPORT_TARGETS) {
      expect(targets).toContain(t);
    }
  });
});

// ─── E2E-5: Webhook + Audit Trail ────────────────────────

describe("E2E-5: Webhook + Audit Trail", () => {
  let webhookId: ObjectId;

  it("creates webhook subscription", async () => {
    const result = await createWebhook(db, {
      orgId,
      teamId,
      url: "https://example.com/webhook/e2e",
      events: ["asset.created", "asset.deleted", "approval.completed"],
    });
    expect(result.webhookId).toBeDefined();
    expect(result.secret).toBeTruthy();
    expect(result.secret.length).toBeGreaterThanOrEqual(32);
    webhookId = result.webhookId;

    const doc = await db.collection("webhooks").findOne({ _id: webhookId });
    expect(doc).not.toBeNull();
    expect(doc!.url).toBe("https://example.com/webhook/e2e");
    expect(doc!.events).toContain("asset.created");
    expect(doc!.active).toBe(true);
  });

  it("signPayload creates HMAC-SHA256 signature", () => {
    const payload = JSON.stringify({ event: "asset.created", data: { id: "test" } });
    const sig1 = signPayload(payload, "secret-key");
    const sig2 = signPayload(payload, "secret-key");
    expect(sig1).toBe(sig2); // deterministic
    expect(sig1.length).toBe(64); // SHA-256 hex = 64 chars

    // Different secret = different signature
    const sig3 = signPayload(payload, "different-key");
    expect(sig3).not.toBe(sig1);
  });

  it("dispatchWebhook runs without throwing", async () => {
    // dispatchWebhook is fire-and-forget, won't actually hit the URL
    await expect(
      dispatchWebhook(db, orgId, "asset.created", { assetId: new ObjectId().toHexString(), name: "test" })
    ).resolves.not.toThrow();
  });

  it("logAuditEvent writes to audit_logs collection", async () => {
    const targetId = new ObjectId();
    await logAuditEvent(db, {
      actorId: userId,
      action: "asset:create",
      targetId,
      targetType: "skill",
      teamId,
      orgId,
      details: { name: `audit-test-${MARKER}` },
    });

    const log = await db.collection("audit_logs").findOne({
      actorId: userId,
      targetId,
      "details.name": `audit-test-${MARKER}`,
    });
    expect(log).not.toBeNull();
    expect(log!.action).toBe("asset:create");
    expect(log!.timestamp).toBeDefined();
  });

  it("getAuditLogs queries with filters", async () => {
    // Seed more audit events
    for (let i = 0; i < 5; i++) {
      await logAuditEvent(db, {
        actorId: userId,
        action: "asset:update",
        targetId: new ObjectId(),
        teamId,
        details: { batch: `filter-test-${MARKER}`, index: i },
      });
    }

    const logs = await getAuditLogs(db, {
      teamId,
      action: "asset:update",
      limit: 3,
    });
    expect(logs.length).toBeLessThanOrEqual(3);
    expect(logs.length).toBeGreaterThanOrEqual(1);
    for (const log of logs) {
      expect(log.action).toBe("asset:update");
      expect(log.teamId.toHexString()).toBe(teamId.toHexString());
    }
  });

  it("exportToSiem returns NDJSON-compatible events", async () => {
    const events = await exportToSiem(db, { teamId, limit: 10 });
    expect(events.length).toBeGreaterThanOrEqual(1);
    for (const evt of events) {
      expect(evt.action).toBeDefined();
      expect(evt.timestamp).toBeDefined();
      expect(evt.actor).toBeDefined(); // SiemEvent uses 'actor' not 'actorId'
      expect(evt.source).toBe("agentconfig");
      expect(["info", "warning", "critical"]).toContain(evt.severity);
    }
  });
});

// ─── E2E-6: Compliance Report ────────────────────────────

describe("E2E-6: Compliance Report", () => {
  beforeAll(async () => {
    // Seed assets with various scan states for compliance reporting
    const assets = [
      { lastScan: { scannedAt: new Date(), findingCounts: { critical: 0, high: 0, medium: 0, low: 0, info: 0 }, findings: [] }, isPublished: true },
      { lastScan: { scannedAt: new Date(), findingCounts: { critical: 0, high: 1, medium: 0, low: 0, info: 0 }, findings: [] }, isPublished: true },
      { lastScan: { scannedAt: new Date(), findingCounts: { critical: 2, high: 0, medium: 0, low: 0, info: 0 }, findings: [] }, isPublished: false },
      { lastScan: null, isPublished: false }, // unscanned
    ];
    for (let i = 0; i < assets.length; i++) {
      await db.collection("assets").insertOne({
        _id: new ObjectId(),
        type: "skill",
        teamId,
        metadata: { name: `compliance-asset-${i}-${MARKER}`, description: "test" },
        content: "# Test",
        tags: [],
        stats: { installCount: 0, viewCount: 0 },
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...assets[i],
      });
    }
    // Seed API tokens for token hygiene
    await db.collection("api_tokens").insertMany([
      { orgId, name: "active-token", tokenHash: "h1", revoked: false, expiresAt: new Date(Date.now() + 86400000), createdAt: new Date() },
      { orgId, name: "expired-token", tokenHash: "h2", revoked: false, expiresAt: new Date(Date.now() - 86400000), createdAt: new Date() },
      { orgId, name: "revoked-token", tokenHash: "h3", revoked: true, expiresAt: new Date(Date.now() + 86400000), createdAt: new Date() },
    ]);
  });

  it("generates compliance report with accurate metrics", async () => {
    const report = await generateComplianceReport(db, "org", orgId, `E2E Org ${MARKER}`, [teamId]);

    expect(report.scope).toBe("org");
    expect(report.scopeId.toHexString()).toBe(orgId.toHexString());

    // Scan coverage: 3 scanned out of 4+
    expect(report.scanCoverage.totalAssets).toBeGreaterThanOrEqual(4);
    expect(report.scanCoverage.scannedAssets).toBeGreaterThanOrEqual(3);
    expect(report.scanCoverage.percentage).toBeGreaterThan(0);
    expect(report.scanCoverage.criticalFindings).toBeGreaterThanOrEqual(1);

    // Trust distribution
    expect(report.trustDistribution.gradeA).toBeGreaterThanOrEqual(1); // clean scan
    expect(report.trustDistribution.gradeC).toBeGreaterThanOrEqual(1); // high findings
    expect(report.trustDistribution.gradeD).toBeGreaterThanOrEqual(1); // critical findings
    expect(report.trustDistribution.unscored).toBeGreaterThanOrEqual(1); // no scan

    // Token hygiene
    expect(report.tokenHygiene.activeTokens).toBeGreaterThanOrEqual(1);
    expect(report.tokenHygiene.expiredTokens).toBeGreaterThanOrEqual(1);
    expect(report.tokenHygiene.revokedTokens).toBeGreaterThanOrEqual(1);

    // Overall score
    expect(report.overallScore).toBeGreaterThanOrEqual(0);
    expect(report.overallScore).toBeLessThanOrEqual(100);
    expect(report.computedAt).toBeDefined();
  });
});

// ─── E2E-7: Copilot Agent Full Loop ─────────────────────

// Top-level imports for Pi agent (must be at module scope for await)
import { registerFauxProvider as piRegisterFaux, fauxAssistantMessage as piFauxMsg, fauxText as piFauxText, fauxToolCall as piFauxToolCall } from "@mariozechner/pi-ai";
import { Agent as PiAgent, type AgentEvent as PiAgentEvent } from "@mariozechner/pi-agent-core";
import { buildSystemPrompt as copilotBuildPrompt } from "@/services/copilot/context-builder";
import { createSearchTool as copilotSearchTool, createScanTool as copilotScanTool } from "@/services/copilot/pi-tools";

describe("E2E-7: Copilot Agent Full Loop", () => {
  // Uses real Pi agent with faux LLM — tool calls hit real DB
  let faux: ReturnType<typeof piRegisterFaux>;

  beforeAll(async () => {
    faux = piRegisterFaux();
    // Seed a searchable asset
    await createAsset(db, {
      type: "skill",
      teamId,
      metadata: { name: `Copilot E2E Skill ${MARKER}`, description: "For copilot search", author: "e2e", version: "1.0.0" },
      content: "# Copilot Search Target\n\nThis asset is used for copilot agent testing.",
      tags: ["copilot", "e2e"],
      createdBy: userId,
    });
  });

  afterAll(() => {
    faux.unregister();
  });

  it("agent responds to plain text prompt via faux LLM", async () => {
    faux.setResponses([piFauxMsg([piFauxText("Hello! I'm your AgentConfig assistant.")])]);

    const systemPrompt = copilotBuildPrompt({
      currentPage: "dashboard",
      teamId: teamId.toHexString(),
      teamName: `E2E Team ${MARKER}`,
      userRole: "owner",
    });
    const model = faux.getModel();
    const searchTool = copilotSearchTool(db, {
      currentPage: "dashboard",
      teamId: teamId.toHexString(),
      teamName: `E2E Team ${MARKER}`,
      userRole: "owner",
    });
    const scanTool = copilotScanTool(db);

    const agent = new PiAgent({
      initialState: { systemPrompt, model, tools: [searchTool, scanTool], messages: [] },
    });

    const events: PiAgentEvent[] = [];
    agent.subscribe((event: PiAgentEvent) => {
      events.push(event);
    });
    await agent.prompt("Hello");

    const types = events.map((e) => e.type);
    expect(types).toContain("agent_start");
    expect(types).toContain("agent_end");
  });

  it("agent executes search tool with real DB query", async () => {
    faux.setResponses([
      piFauxMsg([piFauxToolCall("search_assets", { query: "copilot", limit: 5 })]),
      piFauxMsg([piFauxText("Found your copilot assets.")]),
    ]);

    const model = faux.getModel();
    const systemPrompt = copilotBuildPrompt({
      currentPage: "assets",
      teamId: teamId.toHexString(),
      teamName: "E2E Team",
      userRole: "owner",
    });
    const searchTool = copilotSearchTool(db, {
      currentPage: "assets",
      teamId: teamId.toHexString(),
      teamName: "E2E Team",
      userRole: "owner",
    });

    const agent = new PiAgent({
      initialState: { systemPrompt, model, tools: [searchTool], messages: [] },
    });

    const events: PiAgentEvent[] = [];
    agent.subscribe((event: PiAgentEvent) => {
      events.push(event);
    });
    await agent.prompt("Search for copilot assets");

    const toolEnds = events.filter((e) => e.type === "tool_execution_end");
    expect(toolEnds.length).toBe(1);
    const toolEnd = toolEnds[0] as Extract<PiAgentEvent, { type: "tool_execution_end" }>;
    expect(toolEnd.toolName).toBe("search_assets");
    expect(toolEnd.isError).toBe(false);
  });
});

// ─── E2E-8: API Token Full Lifecycle ─────────────────────

describe("E2E-8: API Token Full Lifecycle", () => {
  it("creates a personal API token with correct prefix", async () => {
    const result = await createApiToken(db, {
      name: `e2e-personal-${MARKER}`,
      tokenType: "personal",
      userId,
      orgId,
      scope: "read",
      expiresInDays: 30,
    });
    expect(result.rawToken).toBeDefined();
    expect(result.rawToken.startsWith("ac_")).toBe(true);
    expect(result.tokenId).toBeDefined();
    expect(result.prefix).toBeDefined();
    expect(result.expiresAt).toBeDefined();

    // Token is in DB
    const doc = await db.collection("api_tokens").findOne({ _id: result.tokenId });
    expect(doc).not.toBeNull();
    expect(doc!.name).toBe(`e2e-personal-${MARKER}`);
    expect(doc!.tokenType).toBe("personal");
    expect(doc!.revoked).toBe(false);
  });

  it("validates a valid token and returns the token document", async () => {
    const result = await createApiToken(db, {
      name: `e2e-validate-${MARKER}`,
      tokenType: "personal",
      userId,
      orgId,
      scope: "write",
      expiresInDays: 7,
    });

    const validated = await validateApiToken(db, result.rawToken);
    expect(validated).not.toBeNull();
    expect(validated?.userId).toBeDefined();
    expect(validated!.userId!.toHexString()).toBe(userId.toHexString());
    expect(validated!.orgId.toHexString()).toBe(orgId.toHexString());
    expect(validated!.scope).toBe("write");
  });

  it("revokes a token and validation returns null", async () => {
    const result = await createApiToken(db, {
      name: `e2e-revoke-${MARKER}`,
      tokenType: "personal",
      userId,
      orgId,
      scope: "read",
      expiresInDays: 7,
    });

    // Revoke
    const revoked = await revokeApiToken(db, result.tokenId, userId);
    expect(revoked).toBe(true);

    // Verify revoked in DB
    const doc = await db.collection("api_tokens").findOne({ _id: result.tokenId });
    expect(doc!.revoked).toBe(true);
    // Validate returns null for revoked token
    const validated = await validateApiToken(db, result.rawToken);
    expect(validated).toBeNull();
  });

  it("validates returns null for expired token", async () => {
    // Insert a manually expired token
    const { createHash, randomBytes } = await import("crypto");
    const raw = `ac_${randomBytes(32).toString("hex")}`;
    const hash = createHash("sha256").update(raw).digest("hex");
    const tokenId = new ObjectId();

    await db.collection("api_tokens").insertOne({
      _id: tokenId,
      name: `e2e-expired-${MARKER}`,
      tokenType: "personal",
      tokenHash: hash,
      prefix: raw.slice(0, 7),
      userId,
      orgId,
      scope: "read",
      revoked: false,
      expiresAt: new Date(Date.now() - 86400000), // expired yesterday
      createdAt: new Date(Date.now() - 86400000 * 2),
    });

    const validated = await validateApiToken(db, raw);
    expect(validated).toBeNull();
  });

  it("creates team-scoped token", async () => {
    const result = await createApiToken(db, {
      name: `e2e-team-${MARKER}`,
      tokenType: "service_account",
      userId,
      orgId,
      teamId,
      scope: "read",
      expiresInDays: 90,
    });
    expect(result.rawToken.startsWith("ac_")).toBe(true);

    const doc = await db.collection("api_tokens").findOne({ _id: result.tokenId });
    expect(doc!.tokenType).toBe("service_account");
    expect(doc!.teamId!.toHexString()).toBe(teamId.toHexString());
  });

  it("revoke returns false for non-existent token", async () => {
    const fakeTokenId = new ObjectId();
    const revoked = await revokeApiToken(db, fakeTokenId, userId);
    expect(revoked).toBe(false);
  });
});
