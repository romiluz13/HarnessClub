import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ObjectId, type Db } from "mongodb";
import { cleanTestDb, closeTestDb, getTestDb, seedUserWithTeam } from "../helpers/db-setup";
import { createAsset, updateAsset } from "@/services/asset-service";
import { createApprovalRequest, submitDecision } from "@/services/approval-service";
import type { AssetDocument } from "@/types/asset";

const MARKER = `release-state-${Date.now()}`;

let db: Db;

async function loadInstallRoute() {
  vi.resetModules();
  vi.doMock("@/lib/db", () => ({
    getDb: async () => db,
  }));

  return import("@/app/api/assets/[id]/install/route");
}

function createReviewerDoc(teamId: ObjectId) {
  const reviewerId = new ObjectId();

  return {
    reviewerId,
    reviewer: {
      _id: reviewerId,
      email: `reviewer-${MARKER}-${reviewerId.toHexString()}@test.com`,
      name: "Release Reviewer",
      auth: { provider: "github", providerId: `reviewer-${reviewerId.toHexString()}` },
      teamMemberships: [{ teamId, role: "admin", joinedAt: new Date() }],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
}

describe("Release-state regressions", () => {
  beforeAll(async () => {
    db = await getTestDb();
  });

  beforeEach(async () => {
    await cleanTestDb();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  afterAll(async () => {
    await cleanTestDb();
    await closeTestDb();
  });

  it("re-publishes approved updates after a published asset is edited", async () => {
    const { teamId, userId } = await seedUserWithTeam(db);
    const { reviewerId, reviewer } = createReviewerDoc(teamId);
    await db.collection("users").insertOne(reviewer);

    const created = await createAsset(db, {
      type: "skill",
      teamId,
      metadata: {
        name: `release-skill-${MARKER}`,
        description: "Tracks update approval lifecycle",
        author: "release-test",
        version: "1.0.0",
      },
      content: "# Initial",
      tags: ["release-state"],
      createdBy: userId,
    });

    expect(created.success).toBe(true);
    const assetId = (created as { assetId: ObjectId }).assetId;

    const publishRequest = await createApprovalRequest(db, {
      assetId,
      teamId,
      requestedBy: userId,
      action: "publish",
      mode: "single_review",
    });
    expect(publishRequest.success).toBe(true);
    expect(publishRequest.requestId).toBeDefined();

    let asset = await db.collection<AssetDocument>("assets").findOne({ _id: assetId });
    expect(asset?.releaseStatus).toBe("pending_review");
    expect(asset?.isPublished).toBe(false);

    const publishDecision = await submitDecision(db, publishRequest.requestId!, {
      reviewerId,
      reviewerName: reviewer.name,
      decision: "approve",
      comment: "Ship it",
      decidedAt: new Date(),
    });
    expect(publishDecision.success).toBe(true);
    expect(publishDecision.newStatus).toBe("approved");

    asset = await db.collection<AssetDocument>("assets").findOne({ _id: assetId });
    expect(asset?.releaseStatus).toBe("published");
    expect(asset?.isPublished).toBe(true);

    const updated = await updateAsset(db, assetId, {
      content: "# Updated",
      updatedBy: userId,
      changeReason: "Refine published asset",
    });
    expect(updated).toBe(true);

    asset = await db.collection<AssetDocument>("assets").findOne({ _id: assetId });
    expect(asset?.releaseStatus).toBe("draft");
    expect(asset?.isPublished).toBe(false);
    expect(asset?.currentVersionNumber).toBe(1);

    const updateRequest = await createApprovalRequest(db, {
      assetId,
      teamId,
      requestedBy: userId,
      action: "update",
      mode: "single_review",
      diffSummary: "Updated published content",
    });
    expect(updateRequest.success).toBe(true);
    expect(updateRequest.requestId).toBeDefined();

    asset = await db.collection<AssetDocument>("assets").findOne({ _id: assetId });
    expect(asset?.releaseStatus).toBe("pending_review");
    expect(asset?.isPublished).toBe(false);

    const updateDecision = await submitDecision(db, updateRequest.requestId!, {
      reviewerId,
      reviewerName: reviewer.name,
      decision: "approve",
      comment: "Approved update",
      decidedAt: new Date(),
    });
    expect(updateDecision.success).toBe(true);
    expect(updateDecision.newStatus).toBe("approved");

    asset = await db.collection<AssetDocument>("assets").findOne({ _id: assetId });
    expect(asset?.releaseStatus).toBe("published");
    expect(asset?.isPublished).toBe(true);
  });

  it("does not move an asset into pending_review if request creation fails before insert completes", async () => {
    const { teamId, userId } = await seedUserWithTeam(db);
    const created = await createAsset(db, {
      type: "skill",
      teamId,
      metadata: {
        name: `request-failure-${MARKER}`,
        description: "Approval creation failure regression",
        author: "release-test",
        version: "1.0.0",
      },
      content: "# Draft",
      tags: ["approval-failure"],
      createdBy: userId,
    });
    expect(created.success).toBe(true);
    const assetId = (created as { assetId: ObjectId }).assetId;

    const realCollection = db.collection.bind(db);
    const failingInsert = vi.fn().mockRejectedValueOnce(new Error("approval insert failed"));

    vi.spyOn(db, "collection").mockImplementation(((name: string) => {
      const collection = realCollection(name as never);
      if (name !== "approval_requests") {
        return collection as never;
      }

      return new Proxy(collection, {
        get(target, prop, receiver) {
          if (prop === "insertOne") {
            return failingInsert;
          }

          const value = Reflect.get(target, prop, receiver);
          return typeof value === "function" ? value.bind(target) : value;
        },
      }) as never;
    }) as typeof db.collection);

    await expect(
      createApprovalRequest(db, {
        assetId,
        teamId,
        requestedBy: userId,
        action: "publish",
        mode: "single_review",
      })
    ).rejects.toThrow("approval insert failed");

    const asset = await db.collection<AssetDocument>("assets").findOne({ _id: assetId });
    expect(asset?.releaseStatus).toBe("draft");
    expect(asset?.isPublished).toBe(false);

    const pendingRequests = await db.collection("approval_requests").countDocuments({ assetId });
    expect(pendingRequests).toBe(0);
  });

  it("fails plugin installs loudly when bundled assets are unpublished", async () => {
    const { teamId, userId } = await seedUserWithTeam(db);
    const publishedSkillId = new ObjectId();
    const blockedSkillId = new ObjectId();
    const pluginId = new ObjectId();
    const now = new Date();

    await db.collection("assets").insertMany([
      {
        _id: publishedSkillId,
        type: "skill",
        teamId,
        metadata: {
          name: `published-bundle-${MARKER}`,
          description: "Published bundled asset",
          author: "release-test",
          version: "1.0.0",
        },
        content: "# Published bundled asset",
        tags: ["bundle", "published"],
        searchText: "published bundled asset",
        stats: { installCount: 0, viewCount: 0 },
        isPublished: true,
        releaseStatus: "published",
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: blockedSkillId,
        type: "skill",
        teamId,
        metadata: {
          name: `draft-bundle-${MARKER}`,
          description: "Draft bundled asset",
          author: "release-test",
          version: "1.0.0",
        },
        content: "# Draft bundled asset",
        tags: ["bundle", "draft"],
        searchText: "draft bundled asset",
        stats: { installCount: 0, viewCount: 0 },
        isPublished: false,
        releaseStatus: "draft",
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: pluginId,
        type: "plugin",
        teamId,
        metadata: {
          name: `plugin-bundle-${MARKER}`,
          description: "Plugin with one blocked child",
          author: "release-test",
          version: "1.0.0",
        },
        content: "{\"name\":\"plugin bundle\"}",
        tags: ["plugin", "bundle"],
        searchText: "plugin bundle",
        stats: { installCount: 0, viewCount: 0 },
        isPublished: true,
        releaseStatus: "published",
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
        pluginConfig: {
          manifest: { version: "1.0.0" },
          bundledAssetIds: [publishedSkillId, blockedSkillId],
        },
      },
    ]);

    const route = await loadInstallRoute();
    const response = await route.GET(
      new NextRequest(`http://localhost/api/assets/${pluginId.toHexString()}/install`),
      { params: Promise.resolve({ id: pluginId.toHexString() }) }
    );

    expect(response.status).toBe(409);
    const payload = await response.json();
    expect(payload.error).toContain("incomplete");
    expect(payload.blockedBundledAssets).toHaveLength(1);
    expect(payload.blockedBundledAssets[0].id).toBe(blockedSkillId.toHexString());
  });
});
