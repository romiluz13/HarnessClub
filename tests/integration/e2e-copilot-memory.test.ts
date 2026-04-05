/**
 * E2E Tests — Phase 20: Structured Copilot + Chained Actions
 *
 * Real MongoDB, real services, zero mocks.
 * Tests: action parsing, conversation memory, proactive suggestions.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ObjectId, type Db } from "mongodb";
import { getTestDb, closeTestDb } from "../helpers/db-setup";
import {
  parseActionBlocks,
  formatActionBlock,
  validateAction,
} from "@/services/copilot/action-parser";
import {
  saveMessages,
  loadConversation,
  listConversations,
  deleteConversation,
} from "@/services/copilot/memory-service";
import { generateProactiveSuggestions } from "@/services/copilot/proactive-suggestions";
import type { CopilotMessage } from "@/services/copilot/types";

let db: Db;
const MARKER = `copilot-mem-${Date.now()}`;
const userId = new ObjectId();
const teamId = new ObjectId();

// ─── Action Parser Tests (pure functions) ──────────────────

describe("Action Block Parser", () => {
  it("parses single action block from text", () => {
    const text = "Here's your skill:\n\n```action:ASSET_CREATE\ntype: skill\nname: My Skill\ncontent: # Hello World\n```\n\nDone!";
    const result = parseActionBlocks(text);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe("ASSET_CREATE");
    expect(result.actions[0].params.type).toBe("skill");
    expect(result.actions[0].params.name).toBe("My Skill");
    expect(result.text).toContain("Here's your skill:");
    expect(result.text).toContain("Done!");
    expect(result.text).not.toContain("```action:");
  });

  it("parses multiple action blocks", () => {
    const text = "```action:SEARCH\nquery: typescript skills\n```\n\nAlso:\n\n```action:SCAN\nassetId: 123\n```";
    const result = parseActionBlocks(text);
    expect(result.actions).toHaveLength(2);
    expect(result.actions[0].type).toBe("SEARCH");
    expect(result.actions[1].type).toBe("SCAN");
  });

  it("handles text with no action blocks", () => {
    const text = "Just a regular response with no actions.";
    const result = parseActionBlocks(text);
    expect(result.actions).toHaveLength(0);
    expect(result.text).toBe(text);
  });

  it("formats action block correctly", () => {
    const block = formatActionBlock("EXPORT", { assetId: "abc123", target: "cursor" });
    expect(block).toContain("```action:EXPORT");
    expect(block).toContain("assetId: abc123");
    expect(block).toContain("target: cursor");
  });

  it("validates required params for ASSET_CREATE", () => {
    const valid = validateAction({ type: "ASSET_CREATE", params: { type: "skill", name: "Test", content: "# Hi" }, raw: "" });
    expect(valid.valid).toBe(true);
    expect(valid.missing).toHaveLength(0);

    const invalid = validateAction({ type: "ASSET_CREATE", params: { type: "skill" }, raw: "" });
    expect(invalid.valid).toBe(false);
    expect(invalid.missing).toContain("name");
    expect(invalid.missing).toContain("content");
  });

  it("validates SEARCH requires query", () => {
    const valid = validateAction({ type: "SEARCH", params: { query: "test" }, raw: "" });
    expect(valid.valid).toBe(true);
    const invalid = validateAction({ type: "SEARCH", params: {}, raw: "" });
    expect(invalid.valid).toBe(false);
  });

  it("SUGGEST has no required params", () => {
    const result = validateAction({ type: "SUGGEST", params: {}, raw: "" });
    expect(result.valid).toBe(true);
  });
});

// ─── Conversation Memory Tests ────────────────────────────

beforeAll(async () => {
  db = await getTestDb();
});

afterAll(async () => {
  await Promise.all([
    db.collection("copilot_conversations").deleteMany({ teamId }),
    db.collection("users").deleteMany({ email: { $regex: MARKER } }),
    db.collection("teams").deleteMany({ name: { $regex: MARKER } }),
    db.collection("assets").deleteMany({ "metadata.name": { $regex: MARKER } }),
  ]);
  await closeTestDb();
});

describe("Conversation Memory (real DB)", () => {
  let conversationId: ObjectId;


  it("creates a new conversation", async () => {
    const now = new Date();
    const messages: CopilotMessage[] = [
      { role: "user", content: "Hello copilot", timestamp: now },
      { role: "assistant", content: "Hi! How can I help?", timestamp: now },
    ];
    conversationId = await saveMessages(db, { teamId, userId, messages });
    expect(conversationId).toBeInstanceOf(ObjectId);
  });

  it("loads conversation history", async () => {
    const history = await loadConversation(db, conversationId);
    expect(history).toHaveLength(2);
    expect(history[0].role).toBe("user");
    expect(history[0].content).toBe("Hello copilot");
    expect(history[1].role).toBe("assistant");
  });

  it("appends to existing conversation", async () => {
    const now = new Date();
    const messages: CopilotMessage[] = [
      { role: "user", content: "Find my skills", timestamp: now },
      { role: "assistant", content: "Found 3 skills.", timestamp: now },
    ];
    await saveMessages(db, { teamId, userId, conversationId, messages });
    const history = await loadConversation(db, conversationId);
    expect(history).toHaveLength(4);
    expect(history[2].content).toBe("Find my skills");
  });

  it("listConversations returns recent conversations", async () => {
    const list = await listConversations(db, teamId, userId);
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0].title).toBe("Hello copilot");
    expect(list[0].messageCount).toBe(4);
  });

  it("deleteConversation removes it", async () => {
    const now = new Date();
    const tempId = await saveMessages(db, {
      teamId, userId,
      messages: [{ role: "user", content: "temp", timestamp: now }],
    });
    const deleted = await deleteConversation(db, tempId, userId);
    expect(deleted).toBe(true);
    const loaded = await loadConversation(db, tempId);
    expect(loaded).toHaveLength(0);
  });

  it("deleteConversation fails for wrong user", async () => {
    const deleted = await deleteConversation(db, conversationId, new ObjectId());
    expect(deleted).toBe(false);
  });

  it("sets TTL expiresAt field", async () => {
    const doc = await db.collection("copilot_conversations").findOne({ _id: conversationId });
    expect(doc!.expiresAt).toBeInstanceOf(Date);
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    expect(doc!.expiresAt.getTime()).toBeGreaterThan(Date.now() + thirtyDays - 60000);
  });
});

// ─── Proactive Suggestions Tests ──────────────────────────

describe("Proactive Suggestions (real DB)", () => {
  beforeAll(async () => {
    await db.collection("teams").insertOne({
      _id: teamId, name: `Suggest Team ${MARKER}`, slug: `suggest-${MARKER}`,
      memberIds: [userId], createdAt: new Date(), updatedAt: new Date(),
    });
    await db.collection("assets").insertMany([
      {
        _id: new ObjectId(), type: "skill", teamId,
        metadata: { name: `Unscanned ${MARKER}`, description: "No scan" },
        content: "# No scan", tags: [], isPublished: false, createdBy: userId,
        createdAt: new Date(), updatedAt: new Date(),
      },
      {
        _id: new ObjectId(), type: "skill", teamId,
        metadata: { name: `Risky ${MARKER}`, description: "Has critical" },
        content: "# Risky", tags: [], isPublished: false, createdBy: userId,
        createdAt: new Date(), updatedAt: new Date(),
        lastScan: { scannedAt: new Date(), findingCounts: { critical: 1, high: 0, medium: 0, low: 0, info: 0 }, findings: [] },
      },
    ]);
  });

  it("generates scan coverage suggestion", async () => {
    const suggestions = await generateProactiveSuggestions(db, teamId);
    const scanSuggestion = suggestions.find((s) => s.id === "scan_coverage");
    expect(scanSuggestion).toBeDefined();
    expect(scanSuggestion!.category).toBe("security");
  });

  it("generates trust risk suggestion", async () => {
    const suggestions = await generateProactiveSuggestions(db, teamId);
    const riskSuggestion = suggestions.find((s) => s.id === "trust_risk");
    expect(riskSuggestion).toBeDefined();
    expect(riskSuggestion!.priority).toBe("high");
  });

  it("generates no-published suggestion", async () => {
    const suggestions = await generateProactiveSuggestions(db, teamId);
    const pubSuggestion = suggestions.find((s) => s.id === "no_published");
    expect(pubSuggestion).toBeDefined();
  });

  it("sorts by priority (high first)", async () => {
    const suggestions = await generateProactiveSuggestions(db, teamId);
    const priorities = suggestions.map((s) => s.priority);
    const highIdx = priorities.indexOf("high");
    const lowIdx = priorities.indexOf("low");
    if (highIdx >= 0 && lowIdx >= 0) expect(highIdx).toBeLessThan(lowIdx);
  });

  it("returns empty for team with no assets", async () => {
    const suggestions = await generateProactiveSuggestions(db, new ObjectId());
    expect(suggestions.filter((s) => s.id === "scan_coverage")).toHaveLength(0);
  });
});
