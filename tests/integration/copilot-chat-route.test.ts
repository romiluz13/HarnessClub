import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ObjectId, type Db } from "mongodb";
import {
  fauxAssistantMessage,
  fauxToolCall,
  registerFauxProvider,
  streamSimple,
} from "@mariozechner/pi-ai";
import { closeTestDb, getTestDb } from "../helpers/db-setup";
import { loadConversation, saveMessages } from "@/services/copilot/memory-service";
import type { CopilotContext, CopilotMessage } from "@/services/copilot/types";

const TEST_TEAM_ID = new ObjectId();
const TEST_USER_ID = new ObjectId();
const MARKER = `_copilot_route_${Date.now()}`;

const context: CopilotContext = {
  currentPage: "/dashboard/assets",
  teamId: TEST_TEAM_ID.toHexString(),
  teamName: "Route Test Team",
  userRole: "admin",
};

let db: Db;
let faux: ReturnType<typeof registerFauxProvider> | null = null;

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

async function loadRouteWithFaux(responses: ReturnType<typeof fauxAssistantMessage>[]) {
  vi.resetModules();
  faux = registerFauxProvider();
  faux.setResponses(responses);

  vi.doMock("@/lib/api-helpers", () => ({
    requireAuth: async () => ({ ok: true, userId: TEST_USER_ID.toHexString() }),
  }));
  vi.doMock("@/lib/db", () => ({
    getDb: async () => db,
  }));
  vi.doMock("@/services/copilot/pi-agent", async () => {
    const actual = await vi.importActual<typeof import("@/services/copilot/pi-agent")>("@/services/copilot/pi-agent");
    return {
      ...actual,
      createCopilotAgent: (testDb: Db, testContext: CopilotContext) =>
        actual.createCopilotAgent(testDb, testContext, {
          modelOverride: faux!.getModel(),
          streamFn: streamSimple,
        }),
    };
  });

  return import("@/app/api/copilot/chat/route");
}

beforeAll(async () => {
  db = await getTestDb();

  await db.collection("teams").insertOne({
    _id: TEST_TEAM_ID,
    name: `Route Team ${MARKER}`,
    slug: `route-${MARKER}`,
    memberIds: [TEST_USER_ID],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.collection("assets").insertOne({
    _id: new ObjectId(),
    type: "skill",
    teamId: TEST_TEAM_ID,
    metadata: {
      name: `Route Copilot Skill ${MARKER}`,
      description: "Route fixture for copilot SSE persistence",
      version: "1.0.0",
    },
    content: "# Route Copilot Skill\n\nFixture content.",
    tags: ["route", "copilot"],
    searchText: `Route Copilot Skill ${MARKER} Route fixture for copilot SSE persistence`,
    isPublished: false,
    createdBy: TEST_USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    [MARKER]: true,
  });
}, 30_000);

afterEach(() => {
  faux?.unregister();
  faux = null;
  vi.resetModules();
});

afterAll(async () => {
  await Promise.all([
    db.collection("copilot_conversations").deleteMany({ teamId: TEST_TEAM_ID }),
    db.collection("assets").deleteMany({ [MARKER]: true }),
    db.collection("teams").deleteMany({ _id: TEST_TEAM_ID }),
  ]);
  await closeTestDb();
});

describe("POST /api/copilot/chat", () => {
  it("streams SSE and persists live-path metadata", async () => {
    const route = await loadRouteWithFaux([
      fauxAssistantMessage([fauxToolCall("search_assets", { query: "route copilot", limit: 1 })]),
      fauxAssistantMessage("Found it.\n\n```action:SEARCH\nquery: route copilot\n```"),
    ]);

    const request = new NextRequest("http://localhost/api/copilot/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: "Search for the route copilot fixture",
        context,
      }),
    });

    const response = await route.POST(request);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");

    const events = parseSse(await response.text());
    expect(events.some((event) => event.event === "tool_start")).toBe(true);
    expect(events.some((event) => event.event === "tool_end")).toBe(true);

    const finalEvent = events.find((event) => event.event === "agent_end");
    expect(finalEvent).toBeDefined();
    expect(finalEvent?.data.message).toContain("Found it.");
    expect(finalEvent?.data.message).not.toContain("```action:");
    expect(finalEvent?.data.toolsUsed).toEqual(["search_assets"]);
    expect(Array.isArray(finalEvent?.data.actions)).toBe(true);
    expect((finalEvent?.data.actions as Array<{ type: string }>)[0]?.type).toBe("SEARCH");
    expect(Array.isArray(finalEvent?.data.proactiveSuggestions)).toBe(true);

    const conversationId = finalEvent?.data.conversationId;
    expect(typeof conversationId).toBe("string");

    const stored = await loadConversation(db, new ObjectId(String(conversationId)));
    expect(stored.length).toBeGreaterThanOrEqual(4);
    expect(stored.some((message) => message.role === "tool")).toBe(true);
    expect(stored.some((message) => message.toolCall?.name === "search_assets")).toBe(true);
  });

  it("appends to an existing conversation and returns the same conversationId", async () => {
    const now = new Date();
    const existingMessages: CopilotMessage[] = [
      { role: "user", content: "Initial question", timestamp: now },
      { role: "assistant", content: "Initial answer", timestamp: now },
    ];

    const conversationId = await saveMessages(db, {
      teamId: TEST_TEAM_ID,
      userId: TEST_USER_ID,
      messages: existingMessages,
    });

    const route = await loadRouteWithFaux([
      fauxAssistantMessage("Continuing the conversation."),
    ]);

    const request = new NextRequest("http://localhost/api/copilot/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: "Continue from before",
        context,
        conversationId: conversationId.toHexString(),
      }),
    });

    const response = await route.POST(request);
    const events = parseSse(await response.text());
    const finalEvent = events.find((event) => event.event === "agent_end");

    expect(finalEvent?.data.conversationId).toBe(conversationId.toHexString());

    const stored = await loadConversation(db, conversationId);
    expect(stored).toHaveLength(4);
    expect(stored[2].content).toBe("Continue from before");
    expect(stored[3].content).toContain("Continuing the conversation.");
  });
});
