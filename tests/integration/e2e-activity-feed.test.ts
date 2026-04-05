/**
 * E2E Tests — Phase 18: Team Activity Feed
 *
 * Real MongoDB, real services, zero mocks.
 * Tests: getFeed, read cursors, @mentions, filtering, pagination.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ObjectId, type Db } from "mongodb";
import { getTestDb, closeTestDb } from "../helpers/db-setup";
import { logAuditEvent } from "@/services/audit-service";
import {
  getFeed,
  markFeedAsRead,
  getUnreadCount,
  createMention,
  getMentions,
  markMentionRead,
  getUnreadMentionCount,
} from "@/services/activity-feed-service";

let db: Db;
const MARKER = `feed-${Date.now()}`;
const userId = new ObjectId();
const user2Id = new ObjectId();
const teamId = new ObjectId();
const orgId = new ObjectId();
let assetId: ObjectId;

beforeAll(async () => {
  db = await getTestDb();

  // Seed users
  await db.collection("users").insertMany([
    {
      _id: userId,
      email: `feed-owner-${MARKER}@test.com`,
      name: "Feed Owner",
      auth: { provider: "github", providerId: `feed-owner-${MARKER}` },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: user2Id,
      email: `feed-member-${MARKER}@test.com`,
      name: "Feed Member",
      auth: { provider: "github", providerId: `feed-member-${MARKER}` },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  // Seed an asset
  assetId = new ObjectId();
  await db.collection("assets").insertOne({
    _id: assetId,
    type: "skill",
    teamId,
    metadata: { name: `Feed Test Skill ${MARKER}`, description: "For feed tests" },
    content: "# Feed test",
    tags: ["feed-test"],
    stats: { installCount: 0, viewCount: 0 },
    isPublished: false,
    createdBy: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Seed audit events (the source of feed data)
  const now = Date.now();
  await db.collection("audit_logs").insertMany([
    {
      _id: new ObjectId(),
      actorId: userId,
      action: "asset:create",
      targetId: assetId,
      targetType: "skill",
      teamId,
      orgId,
      details: { name: `Feed Test Skill ${MARKER}` },
      timestamp: new Date(now - 5000),
    },
    {
      _id: new ObjectId(),
      actorId: userId,
      action: "asset:update",
      targetId: assetId,
      targetType: "skill",
      teamId,
      orgId,
      timestamp: new Date(now - 4000),
    },
    {
      _id: new ObjectId(),
      actorId: user2Id,
      action: "team:member_add",
      targetId: user2Id,
      teamId,
      orgId,
      details: { memberName: "Feed Member" },
      timestamp: new Date(now - 3000),
    },
    {
      _id: new ObjectId(),
      actorId: userId,
      action: "approval:request",
      targetId: assetId,
      teamId,
      orgId,
      timestamp: new Date(now - 2000),
    },
    {
      _id: new ObjectId(),
      actorId: user2Id,
      action: "approval:approve",
      targetId: assetId,
      teamId,
      orgId,
      timestamp: new Date(now - 1000),
    },
  ]);
});

// ─── Feed Query Tests ─────────────────────────────────────

describe("Activity Feed (real DB)", () => {
  it("returns all feed entries for a team in reverse chronological order", async () => {
    const result = await getFeed(db, teamId);
    expect(result.total).toBe(5);
    expect(result.entries).toHaveLength(5);
    // Most recent first
    expect(result.entries[0].action).toBe("approval:approve");
    expect(result.entries[4].action).toBe("asset:create");
  });

  it("resolves actor names from users collection", async () => {
    const result = await getFeed(db, teamId);
    const createEntry = result.entries.find((e) => e.action === "asset:create");
    expect(createEntry).toBeDefined();
    expect(createEntry!.actorName).toBe("Feed Owner");
    expect(createEntry!.actorInitial).toBe("F");

    const memberEntry = result.entries.find((e) => e.action === "team:member_add");
    expect(memberEntry!.actorName).toBe("Feed Member");
  });

  it("resolves asset target names for asset actions", async () => {
    const result = await getFeed(db, teamId);
    const createEntry = result.entries.find((e) => e.action === "asset:create");
    expect(createEntry!.targetName).toContain("Feed Test Skill");
  });

  it("builds human-readable messages", async () => {
    const result = await getFeed(db, teamId);
    const createEntry = result.entries.find((e) => e.action === "asset:create");
    expect(createEntry!.message).toContain("Feed Owner");
    expect(createEntry!.message).toContain("created an asset");
    expect(createEntry!.message).toContain("Feed Test Skill");
  });

  it("categorizes entries correctly", async () => {
    const result = await getFeed(db, teamId);
    const categories = result.entries.map((e) => e.category);
    expect(categories).toContain("asset");
    expect(categories).toContain("team");
    expect(categories).toContain("approval");
  });

  it("filters by category", async () => {
    const assetOnly = await getFeed(db, teamId, { category: "asset" });
    expect(assetOnly.entries.every((e) => e.category === "asset")).toBe(true);
    expect(assetOnly.total).toBe(2); // asset:create + asset:update

    const approvalOnly = await getFeed(db, teamId, { category: "approval" });
    expect(approvalOnly.total).toBe(2); // approval:request + approval:approve
  });

  it("filters by actorId", async () => {
    const ownerOnly = await getFeed(db, teamId, { actorId: userId });
    expect(ownerOnly.entries.every((e) => e.actorId === userId.toHexString())).toBe(true);
    expect(ownerOnly.total).toBe(3); // asset:create, asset:update, approval:request
  });

  it("paginates correctly", async () => {
    const page1 = await getFeed(db, teamId, { limit: 2, page: 1 });
    expect(page1.entries).toHaveLength(2);
    expect(page1.total).toBe(5);

    const page2 = await getFeed(db, teamId, { limit: 2, page: 2 });
    expect(page2.entries).toHaveLength(2);
    // No overlap
    expect(page1.entries[0].id).not.toBe(page2.entries[0].id);

    const page3 = await getFeed(db, teamId, { limit: 2, page: 3 });
    expect(page3.entries).toHaveLength(1);
  });

  it("returns empty for non-existent team", async () => {
    const result = await getFeed(db, new ObjectId());
    expect(result.entries).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

// ─── Read Cursor Tests ────────────────────────────────────

describe("Read Cursors (real DB)", () => {
  it("counts all events as unread for new user", async () => {
    // user2Id hasn't marked anything as read, and user2Id's own actions (2) are excluded
    const count = await getUnreadCount(db, user2Id, teamId);
    expect(count).toBe(3); // 3 events by userId (user2's own 2 don't count)
  });

  it("markFeedAsRead sets cursor to now", async () => {
    await markFeedAsRead(db, user2Id, teamId);
    const count = await getUnreadCount(db, user2Id, teamId);
    expect(count).toBe(0);
  });

  it("new events after marking read show as unread", async () => {
    // Insert a new event after the read cursor
    await new Promise((r) => setTimeout(r, 50)); // Ensure timestamp is after cursor
    await logAuditEvent(db, {
      actorId: userId,
      action: "asset:publish",
      targetId: assetId,
      teamId,
      orgId,
    });

    const count = await getUnreadCount(db, user2Id, teamId);
    expect(count).toBe(1);
  });

  it("own actions don't count as unread", async () => {
    await logAuditEvent(db, {
      actorId: user2Id,
      action: "asset:export",
      targetId: assetId,
      teamId,
      orgId,
    });
    // Still 1 (the publish by userId), not 2
    const count = await getUnreadCount(db, user2Id, teamId);
    expect(count).toBe(1);
  });
});

// ─── @Mention Tests ───────────────────────────────────────

describe("@Mentions (real DB)", () => {
  let mentionId: ObjectId;

  it("creates a mention with resolved names", async () => {
    mentionId = await createMention(db, {
      mentionedUserId: user2Id,
      mentionedBy: userId,
      teamId,
      assetId,
      comment: "Can you review this skill?",
    });
    expect(mentionId).toBeInstanceOf(ObjectId);

    const doc = await db.collection("mentions").findOne({ _id: mentionId });
    expect(doc).not.toBeNull();
    expect(doc!.mentionedByName).toBe("Feed Owner");
    expect(doc!.assetName).toContain("Feed Test Skill");
    expect(doc!.read).toBe(false);
  });

  it("getMentions returns user's mentions", async () => {
    const mentions = await getMentions(db, user2Id);
    expect(mentions.length).toBeGreaterThanOrEqual(1);
    expect(mentions[0].comment).toBe("Can you review this skill?");
  });

  it("getUnreadMentionCount returns correct count", async () => {
    const count = await getUnreadMentionCount(db, user2Id);
    expect(count).toBe(1);
  });

  it("markMentionRead marks mention as read", async () => {
    const result = await markMentionRead(db, mentionId, user2Id);
    expect(result).toBe(true);

    const count = await getUnreadMentionCount(db, user2Id);
    expect(count).toBe(0);
  });

  it("getMentions with unreadOnly filters read mentions", async () => {
    const unread = await getMentions(db, user2Id, { unreadOnly: true });
    expect(unread).toHaveLength(0);

    const all = await getMentions(db, user2Id);
    expect(all.length).toBeGreaterThanOrEqual(1);
  });

  it("markMentionRead rejects wrong user", async () => {
    const result = await markMentionRead(db, mentionId, new ObjectId());
    expect(result).toBe(false);
  });

  it("creates mention without assetId", async () => {
    const id = await createMention(db, {
      mentionedUserId: userId,
      mentionedBy: user2Id,
      teamId,
      comment: "Hey, check the team settings",
    });
    const doc = await db.collection("mentions").findOne({ _id: id });
    expect(doc!.assetId).toBeFalsy();
    expect(doc!.assetName).toBeFalsy();
  });
});

afterAll(async () => {
  await Promise.all([
    db.collection("users").deleteMany({ email: { $regex: MARKER } }),
    db.collection("assets").deleteMany({ "metadata.name": { $regex: MARKER } }),
    db.collection("audit_logs").deleteMany({ teamId }),
    db.collection("feed_read_cursors").deleteMany({ teamId }),
    db.collection("mentions").deleteMany({ teamId }),
  ]);
  await closeTestDb();
});
