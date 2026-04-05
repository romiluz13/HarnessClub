/**
 * Launch Readiness Tests — real infrastructure verification.
 *
 * Tests: cache (in-memory), webhook signing + DB round-trip,
 * webhook dispatch, copilot context builder.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHmac } from "crypto";
import { ObjectId, type Db } from "mongodb";
import { getTestDb, closeTestDb } from "../helpers/db-setup";

let db: Db;
const orgId = new ObjectId();
const teamId = new ObjectId();

beforeAll(async () => {
  db = await getTestDb();
}, 30_000);

afterAll(async () => {
  await db.collection("webhooks").deleteMany({ orgId });
  await closeTestDb();
});

// ─── Cache ──────────────────────────────────────────────────
import { TtlCache } from "@/lib/cache";

describe("TtlCache", () => {
  it("stores and retrieves values", async () => {
    const cache = new TtlCache<string>({ ttlMs: 60_000 });
    cache.set("key1", "value1");
    expect(cache.get("key1")).toBe("value1");
  });

  it("expires values after TTL", async () => {
    const cache = new TtlCache<string>({ ttlMs: 1 }); // 1ms TTL
    cache.set("key1", "value1");
    await new Promise((r) => setTimeout(r, 10));
    expect(cache.get("key1")).toBeUndefined();
  });

  it("getOrSet computes on miss", async () => {
    const cache = new TtlCache<string>({ ttlMs: 60_000 });
    let callCount = 0;
    const value = await cache.getOrSet("key1", async () => {
      callCount++;
      return "computed";
    });
    expect(value).toBe("computed");
    expect(callCount).toBe(1);

    // Should return cached
    const value2 = await cache.getOrSet("key1", async () => {
      callCount++;
      return "recomputed";
    });
    expect(value2).toBe("computed");
    expect(callCount).toBe(1);
  });

  it("invalidatePrefix removes matching keys", () => {
    const cache = new TtlCache<string>({ ttlMs: 60_000 });
    cache.set("team:1:assets", "a");
    cache.set("team:1:members", "b");
    cache.set("team:2:assets", "c");
    cache.invalidatePrefix("team:1:");
    expect(cache.get("team:1:assets")).toBeUndefined();
    expect(cache.get("team:1:members")).toBeUndefined();
    expect(cache.get("team:2:assets")).toBe("c");
  });

  it("evicts oldest when at capacity", () => {
    const cache = new TtlCache<string>({ ttlMs: 60_000, maxEntries: 3 });
    cache.set("a", "1");
    cache.set("b", "2");
    cache.set("c", "3");
    cache.set("d", "4"); // Should evict "a"
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("d")).toBe("4");
    expect(cache.size).toBe(3);
  });
});

// ─── Webhooks ──────────────────────────────────────────────
import { signPayload } from "@/services/webhook-service";

describe("Webhook Signing", () => {
  it("produces consistent HMAC-SHA256 signatures", () => {
    const payload = JSON.stringify({ event: "asset.created", data: { id: "123" } });
    const secret = "test-secret-key";
    const sig1 = signPayload(payload, secret);
    const sig2 = signPayload(payload, secret);
    expect(sig1).toBe(sig2);
    expect(sig1).toHaveLength(64); // SHA256 hex
  });

  it("different payloads produce different signatures", () => {
    const secret = "test-secret-key";
    const sig1 = signPayload('{"a":1}', secret);
    const sig2 = signPayload('{"a":2}', secret);
    expect(sig1).not.toBe(sig2);
  });

  it("different secrets produce different signatures", () => {
    const payload = '{"event":"test"}';
    const sig1 = signPayload(payload, "secret-1");
    const sig2 = signPayload(payload, "secret-2");
    expect(sig1).not.toBe(sig2);
  });

  it("matches manual HMAC computation", () => {
    const payload = '{"test":true}';
    const secret = "verify-secret";
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    expect(signPayload(payload, secret)).toBe(expected);
  });
});

// ─── Webhook DB Round-Trip ────────────────────────────────

import { createWebhook, dispatchWebhook } from "@/services/webhook-service";

describe("Webhook Lifecycle — DB round-trip", () => {
  it("creates webhook in DB with HMAC secret", async () => {
    const result = await createWebhook(db, {
      orgId,
      teamId,
      url: "https://example.com/webhook",
      events: ["asset.created", "asset.updated"],
    });
    expect(result.webhookId).toBeInstanceOf(ObjectId);
    expect(result.secret).toHaveLength(64); // 32 bytes hex

    // Verify it's in DB
    const doc = await db.collection("webhooks").findOne({ _id: result.webhookId });
    expect(doc).not.toBeNull();
    expect(doc!.url).toBe("https://example.com/webhook");
    expect(doc!.active).toBe(true);
    expect(doc!.events).toContain("asset.created");
  });

  it("dispatches webhook without throwing", async () => {
    // dispatchWebhook is fire-and-forget — it should not throw
    // even if the URL is unreachable
    await expect(
      dispatchWebhook(db, orgId, "asset.created", { assetId: "test123" })
    ).resolves.not.toThrow();
  });
});

// ─── Copilot Context ──────────────────────────────────────

import { buildSystemPrompt, generateSuggestions } from "@/services/copilot/context-builder";
import { getMigrationPlan } from "@/services/copilot/meta-skills";

describe("Copilot Context — real function verification", () => {
  it("system prompt includes tool names", () => {
    const prompt = buildSystemPrompt({ currentPage: "/" });
    expect(prompt).toContain("search_assets");
    expect(prompt).toContain("recommend_harness");
    expect(prompt).toContain("export_asset");
    expect(prompt).toContain("explain_asset");
  });

  it("generates suggestions based on page context", () => {
    const dashSuggestions = generateSuggestions({ currentPage: "/dashboard/assets" });
    expect(dashSuggestions.length).toBeGreaterThan(0);
    // Suggestions should be real strings, not empty
    for (const s of dashSuggestions) {
      expect(s.length).toBeGreaterThan(5);
    }
  });

  it("migration plan covers all 5 tools", () => {
    const tools = ["claude-code", "cursor", "copilot", "windsurf", "codex"];
    for (const from of tools) {
      for (const to of tools) {
        const plan = getMigrationPlan(from, to);
        expect(Array.isArray(plan.compatible)).toBe(true);
        expect(Array.isArray(plan.incompatible)).toBe(true);
      }
    }
  });
});
