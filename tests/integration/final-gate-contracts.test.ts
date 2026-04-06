import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ObjectId, type Db } from "mongodb";
import { closeTestDb, getTestDb } from "../helpers/db-setup";
import { createApiToken } from "@/services/api-token-service";

const MARKER = `_final_gate_contracts_${Date.now()}`;

let db: Db;
let userId: ObjectId;
let orgId: ObjectId;
let teamId: ObjectId;
let assetId: ObjectId;
let tokenId: ObjectId;
let rawToken: string;

async function loadRoute<TModule>(modulePath: string): Promise<TModule> {
  vi.resetModules();

  vi.doMock("@/lib/db", () => ({
    getDb: async () => db,
    isMongoConfigured: () => true,
  }));

  vi.doMock("@/lib/auth", () => ({
    auth: async () => null,
  }));

  return import(modulePath) as Promise<TModule>;
}

beforeAll(async () => {
  db = await getTestDb();
}, 30_000);

beforeEach(async () => {
  userId = new ObjectId();
  orgId = new ObjectId();
  teamId = new ObjectId();
  assetId = new ObjectId();

  await Promise.all([
    db.collection("api_tokens").deleteMany({ name: { $regex: MARKER } }),
    db.collection("assets").deleteMany({ "metadata.name": { $regex: MARKER } }),
    db.collection("teams").deleteMany({ slug: { $regex: MARKER } }),
    db.collection("organizations").deleteMany({ slug: { $regex: MARKER } }),
    db.collection("users").deleteMany({ email: { $regex: MARKER } }),
  ]);

  await db.collection("organizations").insertOne({
    _id: orgId,
    name: `Final Gate Org ${MARKER}`,
    slug: `final-gate-org-${MARKER}`,
    plan: "enterprise",
    owner: {
      userId,
      name: "Final Gate Owner",
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
    orgId,
    name: `Final Gate Team ${MARKER}`,
    slug: `final-gate-team-${MARKER}`,
    owner: {
      userId,
      name: "Final Gate Owner",
      email: `owner-${MARKER}@test.com`,
    },
    memberIds: [userId],
    settings: {
      marketplaceEnabled: true,
      defaultRole: "member",
      autoPublish: false,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.collection("users").insertOne({
    _id: userId,
    email: `owner-${MARKER}@test.com`,
    name: "Final Gate Owner",
    auth: { provider: "github", providerId: `owner-${MARKER}` },
    orgMemberships: [{ orgId, role: "org_owner", joinedAt: new Date() }],
    teamMemberships: [{ teamId, role: "owner", joinedAt: new Date() }],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.collection("assets").insertOne({
    _id: assetId,
    type: "skill",
    teamId,
    metadata: {
      name: `Final Gate Asset ${MARKER}`,
      description: "Bearer-auth route regression fixture",
      version: "1.0.0",
    },
    content: "# Final gate fixture",
    tags: ["final", "gate"],
    searchText: `Name: Final Gate Asset ${MARKER}\nDescription: Bearer-auth route regression fixture`,
    stats: { installCount: 0, viewCount: 0 },
    isPublished: false,
    createdBy: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const token = await createApiToken(db, {
    name: `final-gate-token-${MARKER}`,
    tokenType: "personal",
    userId,
    orgId,
    teamId,
    scope: "admin",
    expiresInDays: 30,
  });

  tokenId = token.tokenId;
  rawToken = token.rawToken;
});

afterEach(() => {
  vi.resetModules();
});

afterAll(async () => {
  await Promise.all([
    db.collection("api_tokens").deleteMany({ name: { $regex: MARKER } }),
    db.collection("assets").deleteMany({ "metadata.name": { $regex: MARKER } }),
    db.collection("teams").deleteMany({ slug: { $regex: MARKER } }),
    db.collection("organizations").deleteMany({ slug: { $regex: MARKER } }),
    db.collection("users").deleteMany({ email: { $regex: MARKER } }),
  ]);
  await closeTestDb();
});

describe("final gate bearer-auth and readiness contracts", () => {
  it("accepts bearer auth on asset list and detail routes", async () => {
    const assetsRoute = await loadRoute<typeof import("@/app/api/assets/route")>("@/app/api/assets/route");
    const assetRoute = await loadRoute<typeof import("@/app/api/assets/[id]/route")>("@/app/api/assets/[id]/route");

    const listResponse = await assetsRoute.GET(new NextRequest("http://localhost/api/assets", {
      headers: { authorization: `Bearer ${rawToken}` },
    }));

    expect(listResponse.status).toBe(200);
    const listPayload = await listResponse.json();
    expect(listPayload.assets).toHaveLength(1);
    expect(listPayload.assets[0].id).toBe(assetId.toHexString());

    const detailResponse = await assetRoute.GET(
      new NextRequest(`http://localhost/api/assets/${assetId.toHexString()}`, {
        headers: { authorization: `Bearer ${rawToken}` },
      }),
      { params: Promise.resolve({ id: assetId.toHexString() }) }
    );

    expect(detailResponse.status).toBe(200);
    const detailPayload = await detailResponse.json();
    expect(detailPayload.id).toBe(assetId.toHexString());
    expect(detailPayload.content).toContain("Final gate fixture");
  });

  it("accepts bearer auth on token listing routes", async () => {
    const v1TokensRoute = await loadRoute<typeof import("@/app/api/v1/tokens/route")>("@/app/api/v1/tokens/route");
    const settingsTokensRoute = await loadRoute<typeof import("@/app/api/settings/tokens/route")>("@/app/api/settings/tokens/route");

    const v1Response = await v1TokensRoute.GET(new NextRequest("http://localhost/api/v1/tokens", {
      headers: { authorization: `Bearer ${rawToken}` },
    }));
    expect(v1Response.status).toBe(200);
    const v1Payload = await v1Response.json();
    expect(v1Payload.tokens.some((token: { id: string }) => token.id === tokenId.toHexString())).toBe(true);

    const settingsResponse = await settingsTokensRoute.GET(new NextRequest("http://localhost/api/settings/tokens", {
      headers: { authorization: `Bearer ${rawToken}` },
    }));
    expect(settingsResponse.status).toBe(200);
    const settingsPayload = await settingsResponse.json();
    expect(settingsPayload.tokens.some((token: { id: string }) => token.id === tokenId.toHexString())).toBe(true);
  });

  it("returns a healthy readiness response when MongoDB is reachable", async () => {
    const route = await loadRoute<typeof import("@/app/api/health/route")>("@/app/api/health/route");

    const response = await route.GET();
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.status).toBe("ok");
    expect(payload.checks.mongo).toBe("ok");
  });

  it("publishes the correct search discovery endpoint", async () => {
    const route = await loadRoute<typeof import("@/app/api/v1/route")>("@/app/api/v1/route");

    const response = await route.GET();
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.endpoints.assets["GET /api/search?q="]).toContain("Search assets");
    expect(payload.endpoints.assets["POST /api/assets/search"]).toBeUndefined();
  });
});
