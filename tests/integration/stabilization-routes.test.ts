import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ObjectId, type Db } from "mongodb";
import { closeTestDb, getTestDb } from "../helpers/db-setup";

const MARKER = `_stabilization_${Date.now()}`;

const orgId = new ObjectId();
const teamId = new ObjectId();
const ownerId = new ObjectId();
const adminId = new ObjectId();
const memberId = new ObjectId();
const outsiderId = new ObjectId();
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
  ]);
}, 30_000);

beforeEach(async () => {
  currentUserId = ownerId;

  await Promise.all([
    db.collection("sso_configs").deleteMany({ orgId }),
    db.collection("approval_requests").deleteMany({ teamId }),
    db.collection("assets").deleteMany({ _id: assetId }),
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
    db.collection("assets").deleteMany({ _id: assetId }),
    db.collection("teams").deleteMany({ _id: teamId }),
    db.collection("organizations").deleteMany({ _id: orgId }),
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
