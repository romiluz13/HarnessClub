import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ObjectId, type Db } from "mongodb";
import type { AgentEvent } from "@mariozechner/pi-agent-core";
import { createCopilotAgent } from "@/services/copilot/pi-agent";
import type { CopilotContext } from "@/services/copilot/types";
import { closeTestDb, getTestDb } from "../helpers/db-setup";

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
const LIVE_MARKER = `_copilot_live_${Date.now()}`;
const LIVE_DESCRIPTION_PREFIX = "Fixture asset for live Pi + Grove verification";
const LIVE_DESCRIPTION = `${LIVE_DESCRIPTION_PREFIX} ${LIVE_MARKER}`;

const context: CopilotContext = {
  currentPage: "/dashboard/assets",
  teamId: TEST_TEAM_ID.toHexString(),
  teamName: "Live Test Team",
  userRole: "admin",
};

let db: Db;

beforeAll(async () => {
  if (!isLiveEnabled || !hasLiveConfig) return;

  db = await getTestDb();
  await db.collection("assets").insertOne({
    _id: new ObjectId(),
    type: "skill",
    teamId: TEST_TEAM_ID,
    metadata: {
      name: "Live Copilot Search Fixture",
      description: LIVE_DESCRIPTION,
      version: "1.0.0",
    },
    content: "# Live Copilot Search Fixture\n\nUsed for validating live tool calling.",
    tags: ["live", "copilot", "fixture"],
    searchText: "Live Copilot Search Fixture Fixture asset for live Pi Grove verification live copilot fixture",
    isPublished: false,
    createdBy: TEST_USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    [LIVE_MARKER]: true,
  });
}, 30_000);

afterAll(async () => {
  if (!isLiveEnabled || !hasLiveConfig) return;

  await db.collection("assets").deleteMany({ [LIVE_MARKER]: true });
  await closeTestDb();
});

maybeDescribe("Copilot Pi Agent — Live Grove", () => {
  it("streams a real response and calls search_assets via the live model", async () => {
    const { agent, hasLlm } = createCopilotAgent(db, context);
    expect(hasLlm).toBe(true);

    const events: AgentEvent[] = [];
    agent.subscribe((event) => {
      events.push(event);
    });

    await agent.prompt(
      "Please search the asset library for 'live copilot fixture' with limit 1. "
      + "Then respond with one sentence beginning with LIVE_OK: followed by the first result description."
    );

    const toolStarts = events.filter((event) => event.type === "tool_execution_start");
    const toolEnds = events.filter((event) => event.type === "tool_execution_end");

    const assistantMessages = agent.state.messages.filter((message) => message.role === "assistant");
    const text = assistantMessages
      .flatMap((message) => message.content)
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    const startedSearch = toolStarts.some((event) => event.toolName === "search_assets");
    const endedSearch = toolEnds.some((event) => event.toolName === "search_assets" && event.isError === false);

    if (!startedSearch || !endedSearch) {
      const lastMessage = agent.state.messages.at(-1);
      const lastError = lastMessage && "errorMessage" in lastMessage ? lastMessage.errorMessage : undefined;
      throw new Error(
        `Live model did not call search_assets. Error: ${agent.state.errorMessage ?? lastError ?? "<none>"}. `
        + `Assistant text: ${text}. Last message: ${JSON.stringify(lastMessage)}`
      );
    }

    expect(text).toContain("LIVE_OK:");
    expect(text).toContain(LIVE_DESCRIPTION_PREFIX);
  }, 90_000);
});
