import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId, type Db } from "mongodb";
import { closeTestDb, getTestDb } from "../helpers/db-setup";
import { createApiToken } from "@/services/api-token-service";

let db: Db;
const userId = new ObjectId();
const orgId = new ObjectId();

beforeAll(async () => {
  db = await getTestDb();
}, 30_000);

beforeEach(async () => {
  await db.collection("api_tokens").deleteMany({ orgId });
  vi.resetModules();
});

afterAll(async () => {
  await db.collection("api_tokens").deleteMany({ orgId });
  await closeTestDb();
});

describe("requireAuth", () => {
  it("accepts a valid bearer API token", async () => {
    const token = await createApiToken(db, {
      name: "require-auth-bearer",
      tokenType: "personal",
      userId,
      orgId,
      scope: "read",
      expiresInDays: 30,
    });

    vi.doMock("@/lib/db", () => ({
      getDb: async () => db,
    }));
    vi.doMock("@/lib/auth", () => ({
      auth: async () => null,
    }));

    const { requireAuth } = await import("@/lib/api-helpers");
    const result = await requireAuth(
      new Request("http://localhost/api/assets/import", {
        headers: { Authorization: `Bearer ${token.rawToken}` },
      })
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.userId).toBe(userId.toHexString());
    }
  });

  it("rejects an invalid bearer API token", async () => {
    vi.doMock("@/lib/db", () => ({
      getDb: async () => db,
    }));
    vi.doMock("@/lib/auth", () => ({
      auth: async () => null,
    }));

    const { requireAuth } = await import("@/lib/api-helpers");
    const result = await requireAuth(
      new Request("http://localhost/api/assets/import", {
        headers: { Authorization: "Bearer ac_invalid_token" },
      })
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });
});
