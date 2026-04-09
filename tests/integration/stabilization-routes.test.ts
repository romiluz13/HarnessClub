import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ObjectId, type Db } from "mongodb";
import { closeTestDb, getTestDb } from "../helpers/db-setup";
import { createApiToken } from "@/services/api-token-service";

const MARKER = `_stabilization_${Date.now()}`;

const orgId = new ObjectId();
const teamId = new ObjectId();
const ownerId = new ObjectId();
const adminId = new ObjectId();
const memberId = new ObjectId();
const outsiderId = new ObjectId();
const foreignOrgId = new ObjectId();
const foreignUserId = new ObjectId();
const assetId = new ObjectId();

let db: Db;
let currentUserId = ownerId;

async function loadRoute<TModule>(modulePath: string): Promise<TModule> {
  vi.resetModules();

  vi.doMock("@/lib/db", () => ({
    getDb: async () => db,
  }));

  vi.doMock("@/lib/api-helpers", () => {
    return {
      requireAuth: async () => ({ ok: true, userId: currentUserId.toHexString() }),
      getUserTeamIds: async (_db: Db, userId: string) => {
        const user = await db.collection("users").findOne(
          { _id: new ObjectId(userId) },
          { projection: { teamMemberships: 1 } }
        );
        return (user?.teamMemberships ?? []).map((membership: { teamId: ObjectId }) => membership.teamId);
      },
      getMemberRole: async (_db: Db, userId: ObjectId, lookupTeamId: ObjectId) => {
        const user = await db.collection("users").findOne(
          { _id: userId, "teamMemberships.teamId": lookupTeamId },
          { projection: { "teamMemberships.$": 1 } }
        );
        return user?.teamMemberships?.[0]?.role ?? null;
      },
      getOrgRole: async (_db: Db, userId: ObjectId, lookupOrgId: ObjectId) => {
        const user = await db.collection("users").findOne(
          { _id: userId, "orgMemberships.orgId": lookupOrgId },
          { projection: { "orgMemberships.$": 1 } }
        );
        return user?.orgMemberships?.[0]?.role ?? null;
      },
      requireOrgPermission: async (_db: Db, userId: ObjectId, lookupOrgId: ObjectId, permission: string) => {
        const user = await db.collection("users").findOne(
          { _id: userId, "orgMemberships.orgId": lookupOrgId },
          { projection: { "orgMemberships.$": 1 } }
        );
        const role = user?.orgMemberships?.[0]?.role ?? null;
        if (!role) return null;
        if (permission === "analytics:read") {
          return role === "dept_admin" || role === "org_admin" || role === "org_owner" ? role : null;
        }
        return role;
      },
      serializeAsset: (doc: {
        _id: ObjectId;
        type: string;
        teamId: ObjectId;
        metadata: { name: string; description: string; author?: string; version?: string };
        tags: string[];
        stats?: { installCount?: number; viewCount?: number };
        isPublished: boolean;
        releaseStatus?: string;
        createdAt: Date;
        updatedAt: Date;
      }) => ({
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
        releaseStatus: doc.releaseStatus ?? (doc.isPublished ? "published" : "draft"),
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
      }),
    };
  });

  return import(modulePath) as Promise<TModule>;
}

beforeAll(async () => {
  db = await getTestDb();

  await db.collection("organizations").insertOne({
    _id: orgId,
    name: `Stabilization Org ${MARKER}`,
    slug: `stabilization-org-${MARKER}`,
    plan: "enterprise",
    owner: {
      userId: ownerId,
      name: "Owner User",
      email: `owner-${MARKER}@test.com`,
    },
    settings: {
      marketplaceEnabled: true,
      crossDeptApprovalRequired: false,
      defaultDeptType: "engineering_fe",
      ssoEnabled: false,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.collection("organizations").insertOne({
    _id: foreignOrgId,
    name: `Foreign Org ${MARKER}`,
    slug: `foreign-org-${MARKER}`,
    plan: "enterprise",
    owner: {
      userId: foreignUserId,
      name: "Foreign Owner",
      email: `foreign-${MARKER}@test.com`,
    },
    settings: {
      marketplaceEnabled: true,
      crossDeptApprovalRequired: false,
      defaultDeptType: "engineering_fe",
      ssoEnabled: false,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.collection("teams").insertOne({
    _id: teamId,
    name: `Stabilization Team ${MARKER}`,
    slug: `stabilization-team-${MARKER}`,
    owner: {
      userId: ownerId,
      name: "Owner User",
      email: `owner-${MARKER}@test.com`,
    },
    memberIds: [ownerId, adminId, memberId],
    settings: {
      marketplaceEnabled: true,
      defaultRole: "member",
      autoPublish: false,
    },
    orgId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.collection("users").insertMany([
    {
      _id: ownerId,
      email: `owner-${MARKER}@test.com`,
      name: "Owner User",
      auth: { provider: "github", providerId: `owner-${MARKER}` },
      orgMemberships: [{ orgId, role: "org_owner", joinedAt: new Date() }],
      teamMemberships: [{ teamId, role: "owner", joinedAt: new Date() }],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: adminId,
      email: `admin-${MARKER}@test.com`,
      name: "Admin User",
      auth: { provider: "github", providerId: `admin-${MARKER}` },
      orgMemberships: [{ orgId, role: "org_admin", joinedAt: new Date() }],
      teamMemberships: [{ teamId, role: "admin", joinedAt: new Date() }],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: memberId,
      email: `member-${MARKER}@test.com`,
      name: "Member User",
      auth: { provider: "github", providerId: `member-${MARKER}` },
      orgMemberships: [{ orgId, role: "member", joinedAt: new Date() }],
      teamMemberships: [{ teamId, role: "member", joinedAt: new Date() }],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: outsiderId,
      email: `outsider-${MARKER}@test.com`,
      name: "Outsider User",
      auth: { provider: "github", providerId: `outsider-${MARKER}` },
      orgMemberships: [],
      teamMemberships: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: foreignUserId,
      email: `foreign-${MARKER}@test.com`,
      name: "Foreign Owner",
      auth: { provider: "github", providerId: `foreign-${MARKER}` },
      orgMemberships: [{ orgId: foreignOrgId, role: "org_owner", joinedAt: new Date() }],
      teamMemberships: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);
}, 30_000);

beforeEach(async () => {
  currentUserId = ownerId;

  await Promise.all([
    db.collection("sso_configs").deleteMany({ orgId }),
    db.collection("api_tokens").deleteMany({ orgId: { $in: [orgId, foreignOrgId] } }),
    db.collection("webhooks").deleteMany({ orgId: { $in: [orgId, foreignOrgId] } }),
    db.collection("scim_sync_status").deleteMany({ orgId }),
    db.collection("approval_requests").deleteMany({ teamId }),
    db.collection("assets").deleteMany({
      $or: [
        { _id: assetId },
        { "metadata.name": { $regex: MARKER } },
      ],
    }),
    db.collection("users").deleteMany({
      email: { $in: [`scim-read-${MARKER}@test.com`, `scim-write-${MARKER}@test.com`] },
    }),
  ]);

  await db.collection("assets").insertOne({
    _id: assetId,
    type: "skill",
    teamId,
    metadata: {
      name: `Stabilization Skill ${MARKER}`,
      description: "Route hardening fixture",
      version: "1.0.0",
    },
    content: "# Base content\n\nInitial route fixture.",
    tags: ["stabilization", "routes"],
    searchText: "Name: Stabilization Skill\n\nDescription: Route hardening fixture\n\nTags: stabilization, routes\n\nContent:\n# Base content",
    stats: { installCount: 0, viewCount: 0 },
    isPublished: false,
    createdBy: ownerId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.collection("users").updateOne(
    { _id: adminId, "teamMemberships.teamId": teamId },
    { $set: { "teamMemberships.$.role": "admin" } }
  );
  await db.collection("users").updateOne(
    { _id: memberId, "teamMemberships.teamId": teamId },
    { $set: { "teamMemberships.$.role": "member" } }
  );
});

afterEach(() => {
  vi.resetModules();
});

afterAll(async () => {
  await Promise.all([
    db.collection("approval_requests").deleteMany({ teamId }),
    db.collection("sso_configs").deleteMany({ orgId }),
    db.collection("api_tokens").deleteMany({ orgId: { $in: [orgId, foreignOrgId] } }),
    db.collection("webhooks").deleteMany({ orgId: { $in: [orgId, foreignOrgId] } }),
    db.collection("scim_sync_status").deleteMany({ orgId }),
    db.collection("assets").deleteMany({
      $or: [
        { _id: assetId },
        { "metadata.name": { $regex: MARKER } },
      ],
    }),
    db.collection("teams").deleteMany({ _id: teamId }),
    db.collection("organizations").deleteMany({ _id: { $in: [orgId, foreignOrgId] } }),
    db.collection("users").deleteMany({ email: { $regex: MARKER } }),
  ]);
  await closeTestDb();
});

describe("SSO route contract", () => {
  it("accepts PUT payloads from the dashboard shape and returns editable config on GET", async () => {
    currentUserId = adminId;
    const route = await loadRoute<typeof import("@/app/api/orgs/[orgId]/sso/route")>("@/app/api/orgs/[orgId]/sso/route");

    const putRequest = new NextRequest(`http://localhost/api/orgs/${orgId.toHexString()}/sso`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        providerType: "oidc",
        providerPreset: "google",
        jitProvisioning: true,
        enforceSSO: true,
        oidc: {
          issuer: "https://accounts.google.com",
          clientId: "client-id-1",
          clientSecret: "client-secret-1",
        },
      }),
    });

    const putResponse = await route.PUT(putRequest, { params: Promise.resolve({ orgId: orgId.toHexString() }) });
    expect(putResponse.status).toBe(200);

    const getResponse = await route.GET(
      new NextRequest(`http://localhost/api/orgs/${orgId.toHexString()}/sso`),
      { params: Promise.resolve({ orgId: orgId.toHexString() }) }
    );
    expect(getResponse.status).toBe(200);

    const payload = await getResponse.json();
    expect(payload.sso.providerType).toBe("oidc");
    expect(payload.sso.providerPreset).toBe("google");
    expect(payload.sso.oidc.issuer).toBe("https://accounts.google.com");
    expect(payload.sso.oidc.clientId).toBe("client-id-1");
    expect(payload.sso.oidc.hasClientSecret).toBe(true);
    expect(payload.sso.enforceSSO).toBe(true);

    const storedConfig = await db.collection("sso_configs").findOne({ orgId });
    expect(storedConfig?.oidc?.clientSecretEncrypted).toBeDefined();
    expect(storedConfig?.oidc?.clientSecretEncrypted).not.toBe("client-secret-1");
  });
});

describe("SCIM scope hardening", () => {
  it("rejects read-only tokens and accepts write tokens", async () => {
    const readToken = await createApiToken(db, {
      name: `scim-read-${MARKER}`,
      tokenType: "service_account",
      orgId,
      scope: "read",
      expiresInDays: 30,
    });
    const writeToken = await createApiToken(db, {
      name: `scim-write-${MARKER}`,
      tokenType: "service_account",
      orgId,
      scope: "write",
      expiresInDays: 30,
    });

    const route = await loadRoute<typeof import("@/app/api/orgs/[orgId]/scim/users/route")>("@/app/api/orgs/[orgId]/scim/users/route");
    const payload = {
      externalId: `scim-ext-${MARKER}`,
      userName: `scim-read-${MARKER}@test.com`,
      displayName: "SCIM Read Blocked",
      name: { givenName: "SCIM", familyName: "Blocked" },
      emails: [{ value: `scim-read-${MARKER}@test.com`, primary: true }],
      active: true,
    };

    const deniedResponse = await route.POST(
      new NextRequest(`http://localhost/api/orgs/${orgId.toHexString()}/scim/users`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${readToken.rawToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      }),
      { params: Promise.resolve({ orgId: orgId.toHexString() }) }
    );
    expect(deniedResponse.status).toBe(403);

    const allowedResponse = await route.POST(
      new NextRequest(`http://localhost/api/orgs/${orgId.toHexString()}/scim/users`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${writeToken.rawToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          ...payload,
          externalId: `scim-write-${MARKER}`,
          userName: `scim-write-${MARKER}@test.com`,
          displayName: "SCIM Write Allowed",
          emails: [{ value: `scim-write-${MARKER}@test.com`, primary: true }],
        }),
      }),
      { params: Promise.resolve({ orgId: orgId.toHexString() }) }
    );
    expect(allowedResponse.status).toBe(201);
  });
});

describe("Org analytics protection", () => {
  it("blocks non-members from org metrics and compliance routes", async () => {
    currentUserId = outsiderId;

    const metricsRoute = await loadRoute<typeof import("@/app/api/orgs/[orgId]/metrics/route")>("@/app/api/orgs/[orgId]/metrics/route");
    const departmentsRoute = await loadRoute<typeof import("@/app/api/orgs/[orgId]/metrics/departments/route")>("@/app/api/orgs/[orgId]/metrics/departments/route");
    const complianceRoute = await loadRoute<typeof import("@/app/api/orgs/[orgId]/compliance/route")>("@/app/api/orgs/[orgId]/compliance/route");

    const metricsResponse = await metricsRoute.GET(
      new NextRequest(`http://localhost/api/orgs/${orgId.toHexString()}/metrics`),
      { params: Promise.resolve({ orgId: orgId.toHexString() }) }
    );
    expect(metricsResponse.status).toBe(403);

    const departmentsResponse = await departmentsRoute.GET(
      new NextRequest(`http://localhost/api/orgs/${orgId.toHexString()}/metrics/departments`),
      { params: Promise.resolve({ orgId: orgId.toHexString() }) }
    );
    expect(departmentsResponse.status).toBe(403);

    const complianceResponse = await complianceRoute.GET(
      new NextRequest(`http://localhost/api/orgs/${orgId.toHexString()}/compliance`),
      { params: Promise.resolve({ orgId: orgId.toHexString() }) }
    );
    expect(complianceResponse.status).toBe(403);
  });
});

describe("Asset mutation hardening", () => {
  it("allows members to update content and records a version", async () => {
    currentUserId = memberId;
    const route = await loadRoute<typeof import("@/app/api/assets/[id]/route")>("@/app/api/assets/[id]/route");

    const patchRequest = new NextRequest(`http://localhost/api/assets/${assetId.toHexString()}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content: "# Updated content\n\nChanged through the route.",
        changeReason: "Tighten route behavior",
      }),
    });

    const response = await route.PATCH(patchRequest, { params: Promise.resolve({ id: assetId.toHexString() }) });
    expect(response.status).toBe(200);

    const asset = await db.collection("assets").findOne({ _id: assetId });
    expect(asset?.content).toContain("Updated content");
    expect(asset?.versions).toHaveLength(1);
    expect(asset?.versions?.[0].changeReason).toBe("Tighten route behavior");
  });

  it("blocks members from publishing assets directly", async () => {
    currentUserId = memberId;
    const route = await loadRoute<typeof import("@/app/api/assets/[id]/route")>("@/app/api/assets/[id]/route");

    const patchRequest = new NextRequest(`http://localhost/api/assets/${assetId.toHexString()}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isPublished: true }),
    });

    const response = await route.PATCH(patchRequest, { params: Promise.resolve({ id: assetId.toHexString() }) });
    expect(response.status).toBe(403);
  });
});

describe("Import and webhook hardening", () => {
  it("blocks importing from loopback URLs before fetch", async () => {
    currentUserId = memberId;
    const route = await loadRoute<typeof import("@/app/api/assets/import/route")>("@/app/api/assets/import/route");

    const response = await route.POST(
      new NextRequest("http://localhost/api/assets/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          teamId: teamId.toHexString(),
          url: "http://127.0.0.1/secrets.md",
        }),
      })
    );

    expect(response.status).toBe(422);
    const payload = await response.json();
    expect(payload.error).toContain("not allowed");
  });

  it("prevents deleting a webhook from another organization", async () => {
    const foreignWebhookId = new ObjectId();
    await db.collection("webhooks").insertOne({
      _id: foreignWebhookId,
      orgId: foreignOrgId,
      url: "https://example.com/foreign-webhook",
      events: ["asset.created"],
      secret: "test-secret",
      active: true,
      stats: { totalDeliveries: 0, successfulDeliveries: 0, failedDeliveries: 0 },
      createdAt: new Date(),
    });

    currentUserId = adminId;
    const route = await loadRoute<typeof import("@/app/api/settings/webhooks/route")>("@/app/api/settings/webhooks/route");
    const response = await route.PATCH(
      new NextRequest("http://localhost/api/settings/webhooks", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ webhookId: foreignWebhookId.toHexString(), action: "delete" }),
      })
    );

    expect(response.status).toBe(404);
    const storedWebhook = await db.collection("webhooks").findOne({ _id: foreignWebhookId });
    expect(storedWebhook).not.toBeNull();
  });
});

describe("Team member management hardening", () => {
  it("blocks regular members from inviting or removing users", async () => {
    currentUserId = memberId;
    const route = await loadRoute<typeof import("@/app/api/teams/[teamId]/members/route")>("@/app/api/teams/[teamId]/members/route");

    const inviteResponse = await route.POST(
      new NextRequest(`http://localhost/api/teams/${teamId.toHexString()}/members`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: `outsider-${MARKER}@test.com`, role: "member" }),
      }),
      { params: Promise.resolve({ teamId: teamId.toHexString() }) }
    );
    expect(inviteResponse.status).toBe(403);

    const removeResponse = await route.POST(
      new NextRequest(`http://localhost/api/teams/${teamId.toHexString()}/members`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "remove", userId: adminId.toHexString() }),
      }),
      { params: Promise.resolve({ teamId: teamId.toHexString() }) }
    );
    expect(removeResponse.status).toBe(403);
  });

  it("blocks admins from promoting members to admin peers", async () => {
    currentUserId = adminId;
    const route = await loadRoute<typeof import("@/app/api/teams/[teamId]/members/route")>("@/app/api/teams/[teamId]/members/route");

    const response = await route.PATCH(
      new NextRequest(`http://localhost/api/teams/${teamId.toHexString()}/members`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: memberId.toHexString(), role: "admin" }),
      }),
      { params: Promise.resolve({ teamId: teamId.toHexString() }) }
    );

    expect(response.status).toBe(403);
  });

  it("allows owners to promote members to admin but rejects generic owner transfer", async () => {
    currentUserId = ownerId;
    const route = await loadRoute<typeof import("@/app/api/teams/[teamId]/members/route")>("@/app/api/teams/[teamId]/members/route");

    const promoteResponse = await route.PATCH(
      new NextRequest(`http://localhost/api/teams/${teamId.toHexString()}/members`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: memberId.toHexString(), role: "admin" }),
      }),
      { params: Promise.resolve({ teamId: teamId.toHexString() }) }
    );
    expect(promoteResponse.status).toBe(200);

    const promotedUser = await db.collection("users").findOne({ _id: memberId });
    const promotedMembership = promotedUser?.teamMemberships?.find(
      (membership: { teamId: ObjectId }) => membership.teamId.equals(teamId)
    );
    expect(promotedMembership?.role).toBe("admin");

    const ownerTransferResponse = await route.PATCH(
      new NextRequest(`http://localhost/api/teams/${teamId.toHexString()}/members`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: memberId.toHexString(), role: "owner" }),
      }),
      { params: Promise.resolve({ teamId: teamId.toHexString() }) }
    );
    expect(ownerTransferResponse.status).toBe(400);
  });
});

describe("Version history protection", () => {
  it("blocks non-members from reading asset versions", async () => {
    currentUserId = outsiderId;
    const route = await loadRoute<typeof import("@/app/api/assets/[id]/versions/route")>("@/app/api/assets/[id]/versions/route");

    const response = await route.GET(
      new NextRequest(`http://localhost/api/assets/${assetId.toHexString()}/versions`),
      { params: Promise.resolve({ id: assetId.toHexString() }) }
    );

    expect(response.status).toBe(403);
  });

  it("rolls back a published asset into draft state and withdraws pending approvals", async () => {
    await db.collection("assets").updateOne(
      { _id: assetId },
      {
        $set: {
          content: "# Published content\n\nCurrent version.",
          isPublished: true,
          releaseStatus: "published",
          currentVersionNumber: 2,
          versions: [
            {
              versionId: new ObjectId(),
              versionNumber: 1,
              content: "# Version one\n\nOriginal content.",
              metadata: {
                name: `Stabilization Skill ${MARKER}`,
                description: "Route hardening fixture",
                version: "1.0.0",
              },
              tags: ["stabilization", "routes"],
              createdBy: ownerId,
              createdAt: new Date(),
              changeReason: "Initial version",
            },
            {
              versionId: new ObjectId(),
              versionNumber: 2,
              content: "# Published content\n\nCurrent version.",
              metadata: {
                name: `Stabilization Skill ${MARKER}`,
                description: "Route hardening fixture",
                version: "1.0.1",
              },
              tags: ["stabilization", "routes"],
              createdBy: ownerId,
              createdAt: new Date(),
              changeReason: "Published revision",
            },
          ],
        },
      }
    );

    const pendingRequestId = new ObjectId();
    await db.collection("approval_requests").insertOne({
      _id: pendingRequestId,
      assetId,
      teamId,
      requestedBy: ownerId,
      action: "update",
      assetVersionNumber: 2,
      status: "pending",
      requiredApprovals: 1,
      decisions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    currentUserId = adminId;
    const route = await loadRoute<typeof import("@/app/api/assets/[id]/versions/rollback/route")>("@/app/api/assets/[id]/versions/rollback/route");
    const response = await route.POST(
      new NextRequest(`http://localhost/api/assets/${assetId.toHexString()}/versions/rollback`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetVersion: 1 }),
      }),
      { params: Promise.resolve({ id: assetId.toHexString() }) }
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      success: true,
      newVersionNumber: 3,
      releaseStatus: "draft",
      releaseStateChanged: true,
      invalidatedApprovalCount: 1,
    });

    const rolledBackAsset = await db.collection("assets").findOne({ _id: assetId });
    expect(rolledBackAsset?.content).toContain("Version one");
    expect(rolledBackAsset?.releaseStatus).toBe("draft");
    expect(rolledBackAsset?.isPublished).toBe(false);

    const withdrawnRequest = await db.collection("approval_requests").findOne({ _id: pendingRequestId });
    expect(withdrawnRequest?.status).toBe("withdrawn");
  });
});

describe("Approval review protection", () => {
  it("blocks members from reviewing approval requests and allows admins", async () => {
    const requestId = new ObjectId();
    await db.collection("approval_requests").insertOne({
      _id: requestId,
      assetId,
      teamId,
      requestedBy: ownerId,
      action: "publish",
      assetVersionNumber: 0,
      status: "pending",
      requiredApprovals: 1,
      decisions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    currentUserId = memberId;
    const approvalsRoute = await loadRoute<typeof import("@/app/api/approvals/route")>("@/app/api/approvals/route");
    const memberListResponse = await approvalsRoute.GET(
      new NextRequest(`http://localhost/api/approvals?teamId=${teamId.toHexString()}&assetId=${assetId.toHexString()}`)
    );
    expect(memberListResponse.status).toBe(200);
    const memberListPayload = await memberListResponse.json();
    expect(memberListPayload.approvals[0].canReview).toBe(false);
    expect(memberListPayload.approvals[0].requestedByCurrentUser).toBe(false);
    expect(memberListPayload.approvals[0].reviewedByCurrentUser).toBe(false);

    const route = await loadRoute<typeof import("@/app/api/approvals/[requestId]/review/route")>("@/app/api/approvals/[requestId]/review/route");

    const memberResponse = await route.POST(
      new NextRequest(`http://localhost/api/approvals/${requestId.toHexString()}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision: "approve" }),
      }),
      { params: Promise.resolve({ requestId: requestId.toHexString() }) }
    );
    expect(memberResponse.status).toBe(403);

    currentUserId = adminId;
    const adminListRoute = await loadRoute<typeof import("@/app/api/approvals/route")>("@/app/api/approvals/route");
    const adminListResponse = await adminListRoute.GET(
      new NextRequest(`http://localhost/api/approvals?teamId=${teamId.toHexString()}&assetId=${assetId.toHexString()}`)
    );
    expect(adminListResponse.status).toBe(200);
    const adminListPayload = await adminListResponse.json();
    expect(adminListPayload.approvals[0].canReview).toBe(true);
    expect(adminListPayload.approvals[0].requestedByCurrentUser).toBe(false);
    expect(adminListPayload.approvals[0].reviewedByCurrentUser).toBe(false);

    const adminRoute = await loadRoute<typeof import("@/app/api/approvals/[requestId]/review/route")>("@/app/api/approvals/[requestId]/review/route");
    const adminResponse = await adminRoute.POST(
      new NextRequest(`http://localhost/api/approvals/${requestId.toHexString()}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision: "approve" }),
      }),
      { params: Promise.resolve({ requestId: requestId.toHexString() }) }
    );
    expect(adminResponse.status).toBe(200);

    const approvalRequest = await db.collection("approval_requests").findOne({ _id: requestId });
    expect(approvalRequest?.status).toBe("approved");
    expect(approvalRequest?.decisions).toHaveLength(1);
  });
});

describe("Approval evidence workflow", () => {
  it("accepts Harness Lab evidence and filters approvals by asset/status", async () => {
    currentUserId = ownerId;
    const route = await loadRoute<typeof import("@/app/api/approvals/route")>("@/app/api/approvals/route");

    const postResponse = await route.POST(
      new NextRequest("http://localhost/api/approvals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assetId: assetId.toHexString(),
          teamId: teamId.toHexString(),
          action: "publish",
          mode: "single_review",
          evidence: {
            source: "harness_lab",
            summary: "Harness Lab evidence includes 2 saved runs and a comparison.",
            runIds: ["conv-a", "conv-b"],
            comparedRunIds: ["conv-a", "conv-b"],
            manifestProvenance: {
              fingerprint: "sha256:3333333333333333333333333333333333333333333333333333333333333333",
              algorithm: "sha256",
              computedAt: "2026-04-09T00:00:00.000Z",
              assetVersionNumber: 5,
              blockCount: 2,
            },
            evalIds: ["sales-smoke", "sales-approval"],
            evalNames: ["Lead Qualification Smoke Test", "Release Readiness Review"],
            recentEvalProofs: [
              { evalName: "Lead Qualification Smoke Test", status: "passed", runId: "conv-b" },
              { evalName: "Release Readiness Review", status: "needs_review", runId: "conv-a" },
            ],
            toolNames: ["recommend_harness", "search_assets"],
            mcpServers: ["filesystem"],
            operatorNotes: ["Harness has declared runtime surface and no obvious bundle-health blockers."],
            evalSignals: {
              evalCount: 2,
              passedCount: 1,
              failedCount: 0,
              needsReviewCount: 1,
              notRunCount: 0,
            },
            runtimeSignals: {
              runCount: 2,
              toolCount: 2,
              mcpServerCount: 1,
              missingBlockCount: 0,
              unpublishedBlockCount: 1,
              compared: true,
            },
          },
        }),
      })
    );

    expect(postResponse.status).toBe(201);

    const createdRequest = await db.collection("approval_requests").findOne({ assetId, status: "pending" });
    expect(createdRequest?.evidence?.summary).toBe("Harness Lab evidence includes 2 saved runs and a comparison.");
    expect(createdRequest?.evidence?.runIds).toEqual(["conv-a", "conv-b"]);
    expect(createdRequest?.evidence?.manifestProvenance).toEqual({
      fingerprint: "sha256:3333333333333333333333333333333333333333333333333333333333333333",
      algorithm: "sha256",
      computedAt: "2026-04-09T00:00:00.000Z",
      assetVersionNumber: 5,
      blockCount: 2,
    });
    expect(createdRequest?.evidence?.evalIds).toEqual(["sales-smoke", "sales-approval"]);
    expect(createdRequest?.evidence?.evalNames).toEqual(["Lead Qualification Smoke Test", "Release Readiness Review"]);
    expect(createdRequest?.evidence?.recentEvalProofs).toEqual([
      { evalName: "Lead Qualification Smoke Test", status: "passed", runId: "conv-b" },
      { evalName: "Release Readiness Review", status: "needs_review", runId: "conv-a" },
    ]);
    expect(createdRequest?.evidence?.evalSignals).toEqual({
      evalCount: 2,
      passedCount: 1,
      failedCount: 0,
      needsReviewCount: 1,
      notRunCount: 0,
    });
    expect(createdRequest?.evidence?.runtimeSignals?.compared).toBe(true);

    const otherAssetId = new ObjectId();
    await db.collection("assets").insertOne({
      _id: otherAssetId,
      type: "skill",
      teamId,
      metadata: {
        name: `Other Skill ${MARKER}`,
        description: "Secondary approval fixture",
        version: "1.0.0",
      },
      content: "# Other content",
      tags: ["stabilization", "other"],
      searchText: "Other content",
      stats: { installCount: 0, viewCount: 0 },
      isPublished: false,
      releaseStatus: "draft",
      createdBy: ownerId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const approvedRequestId = new ObjectId();
    await db.collection("approval_requests").insertOne({
      _id: approvedRequestId,
      assetId,
      teamId,
      requestedBy: ownerId,
      action: "publish",
      assetVersionNumber: 0,
      status: "approved",
      requiredApprovals: 1,
      decisions: [],
      decisionSummary: "Approval threshold reached.",
      createdAt: new Date(),
      updatedAt: new Date(),
      resolvedAt: new Date(),
    });

    await db.collection("approval_requests").insertOne({
      _id: new ObjectId(),
      assetId: otherAssetId,
      teamId,
      requestedBy: ownerId,
      action: "publish",
      assetVersionNumber: 0,
      status: "approved",
      requiredApprovals: 1,
      decisions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      resolvedAt: new Date(),
    });

    const getResponse = await route.GET(
      new NextRequest(`http://localhost/api/approvals?teamId=${teamId.toHexString()}&assetId=${assetId.toHexString()}&status=approved`)
    );
    expect(getResponse.status).toBe(200);

    const payload = await getResponse.json();
    expect(payload.count).toBe(1);
    expect(payload.approvals[0].assetId).toBe(assetId.toHexString());
    expect(payload.approvals[0].status).toBe("approved");
    expect(payload.approvals[0].decisionSummary).toBe("Approval threshold reached.");
  });
});
