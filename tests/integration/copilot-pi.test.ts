/**
 * Integration test: Pi-based Copilot — verifies real agent loop with faux LLM.
 *
 * Tests:
 * 1. Fallback (no LLM) — intent-based dispatch returns tool results
 * 2. Pi Agent with faux provider — streams SSE events
 * 3. Tool calling — search_assets returns real DB results via Pi agent
 * 4. Security hook — blocks invalid ObjectId in tool args
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { ObjectId, type Db } from "mongodb";
import { getTestDb, closeTestDb } from "../helpers/db-setup";
import {
  registerFauxProvider,
  fauxAssistantMessage,
  fauxToolCall,
  streamSimple,
} from "@mariozechner/pi-ai";
import { Agent, type AgentEvent } from "@mariozechner/pi-agent-core";
import { buildSystemPrompt } from "@/services/copilot/context-builder";
import {
  createSearchTool,
  createExplainTool,
} from "@/services/copilot/pi-tools";
import type { CopilotContext } from "@/services/copilot/types";

// ─── Test fixtures ──────────────────────────────────────────

const TEST_TEAM_ID = new ObjectId();
const TEST_USER_ID = new ObjectId();
const COPILOT_MARKER = "_copilot_test_" + Date.now();

const testContext: CopilotContext = {
  currentPage: "/dashboard/assets",
  teamId: TEST_TEAM_ID.toHexString(),
  teamName: "Test Team",
  userRole: "admin",
};

let db: Db;
let faux: ReturnType<typeof registerFauxProvider>;
let insertedAssetId: ObjectId;

beforeAll(async () => {
  db = await getTestDb();

  // Seed a test asset for search/explain/scan
  insertedAssetId = new ObjectId();
  await db.collection("assets").insertOne({
    _id: insertedAssetId,
    type: "skill",
    teamId: TEST_TEAM_ID,
    metadata: { name: "Test Copilot Skill", description: "A skill for copilot testing", version: "1.0.0" },
    content: "# Test Copilot Skill\n\nThis is test content for copilot integration.",
    tags: ["test", "copilot"],
    searchText: `Name: Test Copilot Skill\nDescription: A skill for copilot testing\nTags: test, copilot\nContent: This is test content for copilot integration.`,
    isPublished: false,
    createdBy: TEST_USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    [COPILOT_MARKER]: true,
  });
}, 30_000);

afterAll(async () => {
  // Clean up test data
  await db.collection("assets").deleteMany({ [COPILOT_MARKER]: true });
  await closeTestDb();
});

afterEach(() => {
  faux?.unregister();
});

// ─── Tests ──────────────────────────────────────────────────

describe("Copilot Pi Agent — Faux LLM", () => {
  it("creates agent with faux provider and streams text response", async () => {
    faux = registerFauxProvider();
    faux.setResponses([fauxAssistantMessage("Hello from AgentConfig copilot!")]);

    const model = faux.getModel();
    const agent = new Agent({
      initialState: {
        systemPrompt: buildSystemPrompt(testContext),
        model,
        tools: [createSearchTool(db, testContext)],
      },
      streamFn: streamSimple,
    });

    const events: AgentEvent[] = [];
    agent.subscribe((event: AgentEvent) => {
      events.push(event);
    });

    await agent.prompt("Hello");

    const eventTypes = events.map((e) => e.type);
    expect(eventTypes).toContain("agent_start");
    expect(eventTypes).toContain("agent_end");
    expect(eventTypes).toContain("message_start");
    expect(eventTypes).toContain("message_end");

    // Verify text deltas were streamed
    const textDeltas = events.filter(
      (e): e is Extract<AgentEvent, { type: "message_update" }> => e.type === "message_update" && e.assistantMessageEvent.type === "text_delta"
    );
    expect(textDeltas.length).toBeGreaterThan(0);
  });

  it("executes search_assets tool via Pi agent loop", async () => {
    faux = registerFauxProvider();
    faux.setResponses([
      // First response: LLM calls search_assets tool
      fauxAssistantMessage([fauxToolCall("search_assets", { query: "copilot", limit: 5 })]),
      // Second response: LLM summarizes tool result
      fauxAssistantMessage("I found a skill called 'Test Copilot Skill' for copilot testing."),
    ]);

    const model = faux.getModel();
    const agent = new Agent({
      initialState: {
        systemPrompt: buildSystemPrompt(testContext),
        model,
        tools: [createSearchTool(db, testContext)],
      },
      streamFn: streamSimple,
    });

    const events: AgentEvent[] = [];
    agent.subscribe((event: AgentEvent) => {
      events.push(event);
    });

    await agent.prompt("Find copilot skills");

    // Verify tool execution events
    const toolStarts = events.filter((e) => e.type === "tool_execution_start");
    const toolEnds = events.filter((e) => e.type === "tool_execution_end");
    expect(toolStarts.length).toBe(1);
    expect(toolEnds.length).toBe(1);

    const toolEnd = toolEnds[0] as Extract<AgentEvent, { type: "tool_execution_end" }>;
    expect(toolEnd.toolName).toBe("search_assets");
    expect(toolEnd.isError).toBe(false);

    // Verify the tool result contains our test asset
    const resultText = toolEnd.result?.content?.[0]?.type === "text"
      ? toolEnd.result.content[0].text
      : "";
    expect(resultText).toContain("Test Copilot Skill");
  });
});

describe("Copilot Pi Agent — Security", () => {
  it("blocks tool call with invalid ObjectId via beforeToolCall hook", async () => {
    faux = registerFauxProvider();
    faux.setResponses([
      fauxAssistantMessage([fauxToolCall("explain_asset", { assetId: "not-a-valid-id" })]),
      fauxAssistantMessage("I could not explain that asset."),
    ]);

    const model = faux.getModel();
    const agent = new Agent({
      initialState: {
        systemPrompt: buildSystemPrompt(testContext),
        model,
        tools: [createExplainTool(db)],
      },
      streamFn: streamSimple,
      beforeToolCall: async (ctx) => {
        const args = ctx.args as Record<string, unknown>;
        if (args && "assetId" in args) {
          const id = args.assetId as string;
          if (!/^[0-9a-f]{24}$/i.test(id)) {
            return { block: true, reason: "Invalid asset ID format" };
          }
        }
        return undefined;
      },
    });

    const events: AgentEvent[] = [];
    agent.subscribe((event: AgentEvent) => {
      events.push(event);
    });

    await agent.prompt("Explain asset not-a-valid-id");

    const toolEnds = events.filter((e) => e.type === "tool_execution_end");
    expect(toolEnds.length).toBe(1);
    const toolEnd = toolEnds[0] as Extract<AgentEvent, { type: "tool_execution_end" }>;
    expect(toolEnd.isError).toBe(true);
  });
});
