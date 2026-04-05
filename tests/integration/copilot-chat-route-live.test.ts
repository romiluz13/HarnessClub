import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ObjectId, type Db } from "mongodb";
import { closeTestDb, getTestDb } from "../helpers/db-setup";
import { loadConversation } from "@/services/copilot/memory-service";

const isLiveEnabled = process.env.COPILOT_LIVE_TEST === "1";
const hasLiveConfig = Boolean(
  process.env.COPILOT_MODEL
  && process.env.COPILOT_BASE_URL
  && process.env.COPILOT_API_KEY
  && process.env.MONGODB_URI
);
const maybeDescribe = isLiveEnabled && hasLiveConfig ? describe : describe.skip;

const TEST_TEAM_ID = new ObjectId();
const TEST_USER_ID = new ObjectId();
const LIVE_MARKER = `_copilot_route_live_${Date.now()}`;

function parseSse(text: string): Array<{ event: string; data: Record<string, unknown> }> {
  return text
    .trim()
    .split("\n\n")
    .filter(Boolean)
    .map((chunk) => {
      const [eventLine, dataLine] = chunk.split("\n");
      return {
        event: eventLine.replace("event: ", ""),
        data: JSON.parse(dataLine.replace("data: ", "")) as Record<string, unknown>,
      };
    });
}

let db: Db;

beforeAll(async () => {
  if (!isLiveEnabled || !hasLiveConfig) return;

  db = await getTestDb();
  await db.collection("teams").insertOne({
    _id: TEST_TEAM_ID,
    name: `Live Route Team ${LIVE_MARKER}`,
    slug: `live-route-${LIVE_MARKER}`,
    memberIds: [TEST_USER_ID],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.collection("assets").insertOne({
    _id: new ObjectId(),
    type: "skill",
    teamId: TEST_TEAM_ID,
    metadata: {
      name: "Live Route Copilot Fixture",
      description: `Live route fixture ${LIVE_MARKER}`,
      version: "1.0.0",
    },
    content: "# Live Route Copilot Fixture\n\nUsed for route-level Grove validation.",
    tags: ["live", "route", "copilot"],
    searchText: `Live Route Copilot Fixture Live route fixture ${LIVE_MARKER}`,
    isPublished: false,
    createdBy: TEST_USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    [LIVE_MARKER]: true,
  });
}, 30_000);

afterAll(async () => {
  if (!isLiveEnabled || !hasLiveConfig) return;

  await Promise.all([
    db.collection("copilot_conversations").deleteMany({ teamId: TEST_TEAM_ID }),
    db.collection("assets").deleteMany({ [LIVE_MARKER]: true }),
    db.collection("teams").deleteMany({ _id: TEST_TEAM_ID }),
  ]);
  await closeTestDb();
});

maybeDescribe("POST /api/copilot/chat — live Grove route", () => {
  it("streams real SSE and persists the conversation", async () => {
    vi.resetModules();
    vi.doMock("@/lib/api-helpers", () => ({
      requireAuth: async () => ({ ok: true, userId: TEST_USER_ID.toHexString() }),
    }));
    vi.doMock("@/lib/db", () => ({
      getDb: async () => db,
    }));

    const route = await import("@/app/api/copilot/chat/route");
    const request = new NextRequest("http://localhost/api/copilot/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: "Please search the asset library for live route copilot fixture and reply with exactly one sentence beginning LIVE_ROUTE_OK:",
        context: {
          currentPage: "/dashboard/assets",
          teamId: TEST_TEAM_ID.toHexString(),
          teamName: "Live Route Team",
          userRole: "admin",
        },
      }),
    });

    const response = await route.POST(request);
    const events = parseSse(await response.text());
    const finalEvent = events.find((event) => event.event === "agent_end");

    expect(events.some((event) => event.event === "tool_start")).toBe(true);
    expect(events.some((event) => event.event === "tool_end")).toBe(true);
    expect(finalEvent).toBeDefined();
    expect(String(finalEvent?.data.message)).toContain("LIVE_ROUTE_OK:");
    expect((finalEvent?.data.toolsUsed as string[]).includes("search_assets")).toBe(true);

    const conversationId = String(finalEvent?.data.conversationId);
    const stored = await loadConversation(db, new ObjectId(conversationId));
    expect(stored.length).toBeGreaterThanOrEqual(4);
  }, 120_000);
});
