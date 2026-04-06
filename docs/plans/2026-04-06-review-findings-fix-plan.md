# Review Findings Fix — Execution Plan

> **For Claude:** REQUIRED: Follow this plan phase-by-phase using TDD.
> Before writing any code, invoke ALL skills listed in the phase header.
> **Design:** See `docs/plans/2026-04-06-review-findings-fix-design.md` for full specification.

**Goal:** Fix all 12 findings from CC10x code review (3 CRITICAL, 3 HIGH, 6 MEDIUM) to harden security, eliminate performance regressions, and enforce project type-safety standards.

**Architecture:** Severity-based phasing. Phase 1 fixes CRITICAL security issues (regex injection, dead middleware, missing index). Phase 2 fixes HIGH issues (CSP, missing collections, N+1). Phase 3 fixes MEDIUM issues (dependency, type-safety, auth consistency, audit correctness).

**Tech Stack:** Next.js 15 App Router, MongoDB Atlas M0, TypeScript 5, Vitest, Auth.js v5, Pi Agent

**Prerequisites:**
- All existing tests passing (`npm run test`)
- `npm run lint && npx tsc --noEmit && npm run build` green
- MongoDB Atlas connection available for integration tests

**Durable Decisions:**
- `escapeRegex()` lives in `src/lib/utils.ts` as the single shared utility (no barrel files)
- Next.js middleware at `src/middleware.ts` re-exports from `src/proxy.ts`
- All API routes use `requireAuth(request)` pattern (never bare `requireAuth()`)
- New collection validators follow the existing `$jsonSchema` + `validationLevel: "moderate"` + `validationAction: "warn"` pattern in `src/lib/schema.ts`
- ESR compound indexes for all new collections per project standard
- Module augmentation for NextAuth types in `src/types/next-auth.d.ts`

---

## Relevant Codebase Files

### Patterns to Follow
- `src/lib/schema.ts` (lines 23-135) — $jsonSchema validator pattern with bsonType assertions
- `src/lib/setup-db.ts` (lines 26-47) — `ensureCollection()` + index creation pattern
- `src/lib/api-helpers.ts` (lines 66-106) — `requireAuth(request?)` dual-mode auth
- `src/app/api/assets/route.ts` (lines 19-21) — existing `escapeRegex()` implementation
- `src/proxy.ts` (lines 62-91) — security headers + CSP in `addSecurityHeaders()`
- `tests/integration/proxy.test.ts` — existing proxy test pattern
- `tests/integration/setup-db.test.ts` — existing setup-db test pattern

### Configuration Files
- `package.json` — dependency management
- `next.config.ts` — Next.js config (no middleware config needed here)
- `tsconfig.json` — TypeScript config (include path for `.d.ts` files)

---

## Phase 1: CRITICAL Security Fixes

> **Exit Criteria:**
> 1. Zero regex injection paths — `grep -rn 'new RegExp\|\\$regex' src/` shows `escapeRegex()` wrapping ALL user input
> 2. `src/middleware.ts` exists and `proxy()` is invoked on all non-static routes
> 3. `api_tokens` collection has `token_validation` and `user_tokens` indexes
> 4. `npm run test` passes, `npx tsc --noEmit` passes, `npm run build` passes

**Skills to load INSIDE the builder agent (MANDATORY — invoke before writing any code):**
```
Skill(skill="api-security-best-practices")
Skill(skill="nextjs-app-router-patterns")
Skill(skill="mongodb-schema-design")
Skill(skill="mongodb-query-optimizer")
Skill(skill="mongodb-connection")
Skill(skill="typescript-advanced-types")
```

### Task 1.1: Extract `escapeRegex()` to shared utility

**Files:**
- Create: `src/lib/utils.ts`
- Create: `tests/lib/utils.test.ts`
- Modify: `src/app/api/assets/route.ts` (remove local `escapeRegex`, add import)

**Step 1: Write failing test**

Create `tests/lib/utils.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { escapeRegex } from "@/lib/utils";

describe("escapeRegex", () => {
  it("escapes all special regex characters", () => {
    const input = ".*+?^${}()|[]\\";
    const result = escapeRegex(input);
    expect(result).toBe("\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\");
  });

  it("returns plain strings unchanged", () => {
    expect(escapeRegex("hello world")).toBe("hello world");
  });

  it("escapes catastrophic backtracking payloads", () => {
    const malicious = "(?:a{1000000})";
    const result = escapeRegex(malicious);
    // All special chars escaped — no longer executable as regex
    expect(() => new RegExp(result)).not.toThrow();
    expect(result).not.toContain("(?:");
  });

  it("escapes dollar sign", () => {
    expect(escapeRegex("$100")).toBe("\\$100");
  });

  it("handles empty string", () => {
    expect(escapeRegex("")).toBe("");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/utils.test.ts`
Expected: FAIL — `escapeRegex` is not exported from `@/lib/utils`

**Step 3: Implement `escapeRegex` in shared util**

Create `src/lib/utils.ts`:
```typescript
/**
 * Shared utility functions.
 *
 * Per api-security-best-practices: escape user input before regex compilation.
 * Prevents regex injection (ReDoS) attacks.
 */

/**
 * Escape special regex characters in a string.
 * Use this BEFORE passing any user input to `new RegExp()` or `$regex`.
 */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/utils.test.ts`
Expected: PASS (all 5 tests)

**Step 5: Update `src/app/api/assets/route.ts`**

Remove the local `escapeRegex` function (lines 19-21) and add import:
```typescript
import { escapeRegex } from "@/lib/utils";
```

The usage on line 50 (`escapeRegex(queryParam)`) remains unchanged.

**Step 6: Run full test suite to verify no regressions**

Run: `npx vitest run`
Expected: All existing tests pass

**Step 7: Commit**
```bash
git add src/lib/utils.ts tests/lib/utils.test.ts src/app/api/assets/route.ts
git commit -m "feat: extract escapeRegex to shared util for injection prevention"
```

### Task 1.2: Apply `escapeRegex()` to all 4 remaining injection sites

**Files:**
- Modify: `src/app/api/marketplace/browse/route.ts` (line 46-48)
- Modify: `src/app/api/settings/audit/route.ts` (line 49)
- Modify: `src/services/copilot/pi-tools.ts` (line 43)
- Modify: `src/services/copilot/tool-executor.ts` (line 50)

**Step 1: Fix `src/app/api/marketplace/browse/route.ts`**

Add import at top:
```typescript
import { escapeRegex } from "@/lib/utils";
```

Change lines 44-49 from:
```typescript
  if (q) {
    additionalFilters.push({
      $or: [
        { "metadata.name": { $regex: q, $options: "i" } },
        { "metadata.description": { $regex: q, $options: "i" } },
        { tags: { $regex: q, $options: "i" } },
      ],
    });
  }
```
To:
```typescript
  if (q) {
    const escaped = escapeRegex(q);
    additionalFilters.push({
      $or: [
        { "metadata.name": { $regex: escaped, $options: "i" } },
        { "metadata.description": { $regex: escaped, $options: "i" } },
        { tags: { $regex: escaped, $options: "i" } },
      ],
    });
  }
```

**Step 2: Fix `src/app/api/settings/audit/route.ts`**

Add import at top:
```typescript
import { escapeRegex } from "@/lib/utils";
```

Change line 49 from:
```typescript
    filter.action = { $regex: `^${actionPrefix}`, $options: "i" };
```
To:
```typescript
    filter.action = { $regex: `^${escapeRegex(actionPrefix)}`, $options: "i" };
```

**Step 3: Fix `src/services/copilot/pi-tools.ts`**

Add import at top:
```typescript
import { escapeRegex } from "@/lib/utils";
```

Change line 43 from:
```typescript
      const searchRegex = new RegExp(args.query.split(/\s+/).join("|"), "i");
```
To:
```typescript
      const searchRegex = new RegExp(args.query.split(/\s+/).map(escapeRegex).join("|"), "i");
```

**Step 4: Fix `src/services/copilot/tool-executor.ts`**

Add import at top:
```typescript
import { escapeRegex } from "@/lib/utils";
```

Change line 50 from:
```typescript
  const searchRegex = new RegExp(params.query.split(/\s+/).join("|"), "i");
```
To:
```typescript
  const searchRegex = new RegExp(params.query.split(/\s+/).map(escapeRegex).join("|"), "i");
```

**Step 5: Fix `src/app/api/skills/import/route.ts`**

Add import at top:
```typescript
import { escapeRegex } from "@/lib/utils";
```

Change line 79 from:
```typescript
      "source.repoUrl": { $regex: new RegExp(repoUrl.replace(/^https?:\/\//, ""), "i") },
```
To:
```typescript
      "source.repoUrl": { $regex: new RegExp(escapeRegex(repoUrl.replace(/^https?:\/\//, "")), "i") },
```

**Step 6: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 7: Verify no remaining unescaped regex from user input**

Run: `grep -rn 'new RegExp\|\\$regex' src/ | grep -v escapeRegex | grep -v node_modules`
Expected: Only framework-internal regex (not taking user input) should remain. Every `$regex` or `new RegExp` that accepts a variable derived from user input must have `escapeRegex()` applied.

**Step 8: Commit**
```bash
git add src/app/api/marketplace/browse/route.ts src/app/api/settings/audit/route.ts src/services/copilot/pi-tools.ts src/services/copilot/tool-executor.ts src/app/api/skills/import/route.ts
git commit -m "fix(security): apply escapeRegex to all 5 regex injection sites"
```

### Task 1.3: Wire `proxy.ts` to Next.js middleware

**Files:**
- Create: `src/middleware.ts`
- Modify: `tests/integration/proxy.test.ts` (add security header assertions)

**Step 1: Write middleware wiring test**

Add to `tests/integration/proxy.test.ts`:
```typescript
  it("adds security headers to all responses", () => {
    const request = new NextRequest("http://localhost/dashboard", {
      headers: { "x-forwarded-for": "203.0.113.30" },
    });

    const response = proxy(request);

    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(response.headers.get("Content-Security-Policy")).toBeTruthy();
  });

  it("adds rate limit headers only to /api/ routes", () => {
    const nonApiRequest = new NextRequest("http://localhost/dashboard", {
      headers: { "x-forwarded-for": "203.0.113.31" },
    });
    const response = proxy(nonApiRequest);

    // Non-API routes should NOT have rate limit headers
    expect(response.headers.get("X-RateLimit-Limit")).toBeNull();
    // But should have security headers
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
  });
```

**Step 2: Run test to verify it passes (proxy already works, just not wired)**

Run: `npx vitest run tests/integration/proxy.test.ts`
Expected: PASS (the proxy function already works, we're just verifying its behavior)

**Step 3: Create `src/middleware.ts`**

```typescript
/**
 * Next.js Middleware — wires proxy.ts for security headers + rate limiting.
 *
 * Per nextjs-app-router-patterns: middleware.ts at project root runs on every
 * matched request before route handlers.
 *
 * This file re-exports the proxy function and route matcher config.
 */

export { proxy as middleware, config } from "@/proxy";
```

**Step 4: Verify middleware is recognized by Next.js**

Run: `npx next build 2>&1 | head -20`
Expected: Build succeeds. The middleware file at `src/middleware.ts` is auto-detected by Next.js.

**Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 6: Commit**
```bash
git add src/middleware.ts tests/integration/proxy.test.ts
git commit -m "fix(security): wire proxy.ts middleware for security headers and rate limiting"
```

### Task 1.4: Add `api_tokens` collection with indexes and validator

**Files:**
- Modify: `src/lib/schema.ts` (add `apiTokensValidator`)
- Modify: `src/lib/setup-db.ts` (add collection + indexes)
- Modify: `tests/integration/setup-db.test.ts` (add api_tokens assertions)

**Step 1: Write failing test for api_tokens collection**

Add to `tests/integration/setup-db.test.ts`:
```typescript
  it("api_tokens collection has token_validation and user_tokens indexes", async () => {
    const db = await getTestDb();
    const indexes = await db.collection("api_tokens").indexes();
    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain("token_validation");
    expect(indexNames).toContain("user_tokens");
  });

  it("api_tokens $jsonSchema validator requires tokenHash and userId", async () => {
    const db = await getTestDb();
    const col = await db.listCollections({ name: "api_tokens" }, { nameOnly: false }).toArray();
    expect(col[0]).toBeDefined();
    const schema = (col[0] as { options?: { validator?: { $jsonSchema?: { required?: string[] } } } }).options?.validator?.$jsonSchema;
    expect(schema).toBeDefined();
    expect(schema?.required).toContain("tokenHash");
    expect(schema?.required).toContain("userId");
  });
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/setup-db.test.ts`
Expected: FAIL — `api_tokens` collection does not exist or has no indexes

**Step 3: Add validator to `src/lib/schema.ts`**

Add before the `export` block (after `auditLogsValidator`):
```typescript
/** API tokens collection $jsonSchema validator */
const apiTokensValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: ["tokenHash", "tokenPrefix", "name", "tokenType", "userId", "orgId", "scope", "revoked", "createdAt"],
    properties: {
      tokenHash: { bsonType: "string", description: "SHA-256 hash of the raw token" },
      tokenPrefix: { bsonType: "string", maxLength: 20, description: "First 8 chars for identification" },
      name: { bsonType: "string", minLength: 1, maxLength: 200 },
      tokenType: { enum: ["personal", "team", "ci"], description: "Token purpose type" },
      userId: { bsonType: "objectId" },
      orgId: { bsonType: "objectId" },
      scope: { enum: ["read", "write", "admin"] },
      revoked: { bsonType: "bool" },
      expiresAt: { bsonType: "date" },
      createdAt: { bsonType: "date" },
    },
  },
};
```

Add `apiTokensValidator` to the export block:
```typescript
export {
  apiTokensValidator,
  assetsValidator,
  auditLogsValidator,
  departmentsValidator,
  organizationsValidator,
  skillsValidator,
  teamsValidator,
  usersValidator,
};
```

**Step 4: Add collection and indexes to `src/lib/setup-db.ts`**

Add `apiTokensValidator` to the import:
```typescript
import {
  apiTokensValidator,
  assetsValidator,
  auditLogsValidator,
  departmentsValidator,
  organizationsValidator,
  teamsValidator,
  usersValidator,
} from "./schema";
```

Add to the `Promise.all` in `setupDatabase()` (after `ensureCollection(db, "audit_logs", auditLogsValidator)`):
```typescript
    ensureCollection(db, "api_tokens", apiTokensValidator),
```

Add index creation block after the audit logs indexes section:
```typescript
  // API tokens indexes — token validation is the hot path (every Bearer auth request)
  const apiTokens = db.collection("api_tokens");
  await Promise.all([
    // Primary: token validation (Equality on tokenHash + revoked)
    apiTokens.createIndex({ tokenHash: 1, revoked: 1 }, { name: "token_validation" }),
    // User's tokens list
    apiTokens.createIndex({ userId: 1 }, { name: "user_tokens" }),
  ]);
```

**Step 5: Run test to verify it passes**

Run: `npx vitest run tests/integration/setup-db.test.ts`
Expected: PASS

**Step 6: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 7: Commit**
```bash
git add src/lib/schema.ts src/lib/setup-db.ts tests/integration/setup-db.test.ts
git commit -m "fix(security): add api_tokens collection with validator and indexes"
```

### Phase 1 Gate

Run: `npm run lint && npx tsc --noEmit && npm run test && npm run build`
Expected: All four commands succeed with exit code 0.

Verification checklist:
- [ ] `grep -rn '$regex' src/ | grep -v escapeRegex | grep -v node_modules` — no unescaped user input to `$regex`
- [ ] `grep -rn 'new RegExp' src/ | grep -v escapeRegex | grep -v node_modules` — no unescaped user input to `new RegExp`
- [ ] `ls src/middleware.ts` — file exists
- [ ] `npx vitest run tests/integration/setup-db.test.ts` — all pass including api_tokens assertions

---

## Phase 2: HIGH Severity Fixes

> **Exit Criteria:**
> 1. CSP no longer contains `unsafe-eval`
> 2. `setup-db.ts` creates all 5 missing collections with validators and indexes
> 3. `listConversations` uses single aggregation — no N+1
> 4. `npm run test` passes, `npx tsc --noEmit` passes, `npm run build` passes

**Skills to load INSIDE the builder agent (MANDATORY — invoke before writing any code):**
```
Skill(skill="api-security-best-practices")
Skill(skill="mongodb-schema-design")
Skill(skill="mongodb-query-optimizer")
Skill(skill="mongodb-connection")
Skill(skill="mongodb-natural-language-querying")
```

### Task 2.1: Remove `unsafe-eval` from CSP

**Files:**
- Modify: `src/proxy.ts` (line 82)
- Modify: `tests/integration/proxy.test.ts` (add CSP assertion)

**Step 1: Write failing test**

Add to `tests/integration/proxy.test.ts`:
```typescript
  it("CSP does not contain unsafe-eval", () => {
    const request = new NextRequest("http://localhost/api/assets", {
      headers: { "x-forwarded-for": "203.0.113.40" },
    });

    const response = proxy(request);
    const csp = response.headers.get("Content-Security-Policy") ?? "";

    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
  });
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/proxy.test.ts`
Expected: FAIL — CSP currently contains `unsafe-eval`

**Step 3: Implement — modify `src/proxy.ts`**

Change line 82 from:
```typescript
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
```
To:
```typescript
      "script-src 'self' 'unsafe-inline'",
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/integration/proxy.test.ts`
Expected: PASS

**Step 5: Run full test suite and build to verify nothing breaks**

Run: `npx vitest run && npm run build`
Expected: All pass. Note: if `npm run build` fails due to CSP change affecting Next.js inline scripts, `'unsafe-inline'` is still present which should suffice for Next.js production scripts. If build fails, investigate and document.

**Step 6: Commit**
```bash
git add src/proxy.ts tests/integration/proxy.test.ts
git commit -m "fix(security): remove unsafe-eval from CSP"
```

### Task 2.2: Add 4 remaining missing collections to `setup-db.ts`

**Files:**
- Modify: `src/lib/schema.ts` (add 4 validators)
- Modify: `src/lib/setup-db.ts` (add 4 collections + indexes)
- Modify: `tests/integration/setup-db.test.ts` (add assertions)

**Step 1: Write failing tests**

Add to `tests/integration/setup-db.test.ts`:
```typescript
  it("approval_requests collection has correct indexes", async () => {
    const db = await getTestDb();
    const indexes = await db.collection("approval_requests").indexes();
    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain("asset_team_status");
    expect(indexNames).toContain("status_team_created");
  });

  it("copilot_conversations collection has correct indexes including TTL", async () => {
    const db = await getTestDb();
    const indexes = await db.collection("copilot_conversations").indexes();
    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain("team_user_updated");
    const ttlIdx = indexes.find((i) => i.name === "conversation_ttl");
    expect(ttlIdx).toBeDefined();
    expect((ttlIdx as { expireAfterSeconds?: number }).expireAfterSeconds).toBe(2592000); // 30 days
  });

  it("metrics_snapshots collection has correct indexes", async () => {
    const db = await getTestDb();
    const indexes = await db.collection("metrics_snapshots").indexes();
    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain("org_timestamp");
  });

  it("webhooks collection has correct indexes", async () => {
    const db = await getTestDb();
    const indexes = await db.collection("webhooks").indexes();
    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain("team_webhooks");
  });
```

**Step 2: Run test to verify they fail**

Run: `npx vitest run tests/integration/setup-db.test.ts`
Expected: FAIL — collections do not exist

**Step 3: Add 4 validators to `src/lib/schema.ts`**

Add before the `export` block:

```typescript
/** Approval requests collection $jsonSchema validator */
const approvalRequestsValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: ["assetId", "teamId", "action", "status", "requestedBy", "createdAt"],
    properties: {
      assetId: { bsonType: "objectId" },
      teamId: { bsonType: "objectId" },
      action: { bsonType: "string", description: "Requested action (publish, update, etc.)" },
      status: { enum: ["pending", "approved", "rejected"], description: "Approval status" },
      requestedBy: { bsonType: "objectId" },
      reviewedBy: { bsonType: "objectId" },
      reviewNote: { bsonType: "string", maxLength: 2000 },
      createdAt: { bsonType: "date" },
      updatedAt: { bsonType: "date" },
    },
  },
};

/** Copilot conversations collection $jsonSchema validator */
const copilotConversationsValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: ["teamId", "userId", "messages", "createdAt", "updatedAt", "expiresAt"],
    properties: {
      teamId: { bsonType: "objectId" },
      userId: { bsonType: "objectId" },
      messages: { bsonType: "array", maxItems: 50 },
      title: { bsonType: "string", maxLength: 200 },
      createdAt: { bsonType: "date" },
      updatedAt: { bsonType: "date" },
      expiresAt: { bsonType: "date", description: "TTL field — auto-deleted after 30 days" },
    },
  },
};

/** Metrics snapshots collection $jsonSchema validator */
const metricsSnapshotsValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: ["orgId", "timestamp"],
    properties: {
      orgId: { bsonType: "objectId" },
      teamId: { bsonType: "objectId" },
      timestamp: { bsonType: "date" },
      metrics: { bsonType: "object" },
    },
  },
};

/** Webhooks collection $jsonSchema validator */
const webhooksValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: ["teamId", "url", "events", "active", "createdAt"],
    properties: {
      teamId: { bsonType: "objectId" },
      url: { bsonType: "string" },
      events: { bsonType: "array", items: { bsonType: "string" }, maxItems: 50 },
      secret: { bsonType: "string" },
      active: { bsonType: "bool" },
      createdAt: { bsonType: "date" },
      updatedAt: { bsonType: "date" },
    },
  },
};
```

Update the export block:
```typescript
export {
  apiTokensValidator,
  approvalRequestsValidator,
  assetsValidator,
  auditLogsValidator,
  copilotConversationsValidator,
  departmentsValidator,
  metricsSnapshotsValidator,
  organizationsValidator,
  skillsValidator,
  teamsValidator,
  usersValidator,
  webhooksValidator,
};
```

**Step 4: Add collections and indexes to `src/lib/setup-db.ts`**

Update import to include all new validators:
```typescript
import {
  apiTokensValidator,
  approvalRequestsValidator,
  assetsValidator,
  auditLogsValidator,
  copilotConversationsValidator,
  departmentsValidator,
  metricsSnapshotsValidator,
  organizationsValidator,
  teamsValidator,
  usersValidator,
  webhooksValidator,
} from "./schema";
```

Add to the `Promise.all` collection creation block:
```typescript
    ensureCollection(db, "approval_requests", approvalRequestsValidator),
    ensureCollection(db, "copilot_conversations", copilotConversationsValidator),
    ensureCollection(db, "metrics_snapshots", metricsSnapshotsValidator),
    ensureCollection(db, "webhooks", webhooksValidator),
```

Add index creation blocks after the api_tokens indexes:
```typescript
  // Approval requests indexes
  const approvalRequests = db.collection("approval_requests");
  await Promise.all([
    // Primary: lookup by asset + team + status (ESR: E=assetId+teamId, E=status)
    approvalRequests.createIndex({ assetId: 1, teamId: 1, status: 1 }, { name: "asset_team_status" }),
    // List pending approvals for a team (ESR: E=status+teamId, S=createdAt)
    approvalRequests.createIndex({ status: 1, teamId: 1, createdAt: -1 }, { name: "status_team_created" }),
  ]);

  // Copilot conversations indexes
  const copilotConversations = db.collection("copilot_conversations");
  await Promise.all([
    // Primary: user's conversations in a team sorted by recent (ESR: E=teamId+userId, S=updatedAt)
    copilotConversations.createIndex({ teamId: 1, userId: 1, updatedAt: -1 }, { name: "team_user_updated" }),
    // TTL index — auto-delete after 30 days (2592000 seconds)
    copilotConversations.createIndex({ expiresAt: 1 }, { name: "conversation_ttl", expireAfterSeconds: 2592000 }),
  ]);

  // Metrics snapshots indexes
  const metricsSnapshots = db.collection("metrics_snapshots");
  await Promise.all([
    // Primary: org metrics by timestamp (ESR: E=orgId, S=timestamp)
    metricsSnapshots.createIndex({ orgId: 1, timestamp: -1 }, { name: "org_timestamp" }),
  ]);

  // Webhooks indexes
  const webhooks = db.collection("webhooks");
  await Promise.all([
    // Primary: team's webhooks
    webhooks.createIndex({ teamId: 1 }, { name: "team_webhooks" }),
  ]);
```

**Step 5: Run test to verify it passes**

Run: `npx vitest run tests/integration/setup-db.test.ts`
Expected: PASS (all new and existing tests)

**Step 6: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 7: Commit**
```bash
git add src/lib/schema.ts src/lib/setup-db.ts tests/integration/setup-db.test.ts
git commit -m "fix(db): add validators and indexes for 4 missing collections"
```

### Task 2.3: Eliminate N+1 in `listConversations`

**Files:**
- Modify: `src/services/copilot/memory-service.ts` (lines 126-152)
- Modify or create: `tests/services/copilot/memory-service.test.ts` (if exists; otherwise test via integration)

**Step 1: Understand the N+1 pattern**

Current code at `src/services/copilot/memory-service.ts:126-152`:
```typescript
// Step 1: Fetch N docs with messages.$slice:0 (empty array)
const docs = await db.collection<ConversationDocument>("copilot_conversations")
  .find({ teamId, userId })
  .sort({ updatedAt: -1 })
  .limit(limit)
  .project({ title: 1, updatedAt: 1, messages: { $slice: 0 } })
  .toArray();

// Step 2: N individual findOne queries to get message count
const results = await Promise.all(docs.map(async (doc) => {
  const full = await db.collection<ConversationDocument>("copilot_conversations")
    .findOne({ _id: doc._id }, { projection: { messages: 1 } });
  // ...
}));
```

**Step 2: Replace with aggregation pipeline**

Replace the entire `listConversations` function body (lines 132-152) with:
```typescript
export async function listConversations(
  db: Db,
  teamId: ObjectId,
  userId: ObjectId,
  limit: number = 10
): Promise<Array<{ id: string; title: string; updatedAt: string; messageCount: number }>> {
  const docs = await db.collection<ConversationDocument>("copilot_conversations")
    .aggregate<{ _id: ObjectId; title?: string; updatedAt: Date; messageCount: number }>([
      { $match: { teamId, userId } },
      { $sort: { updatedAt: -1 } },
      { $limit: limit },
      { $project: { title: 1, updatedAt: 1, messageCount: { $size: "$messages" } } },
    ])
    .toArray();

  return docs.map((doc) => ({
    id: doc._id.toHexString(),
    title: doc.title ?? "Untitled",
    updatedAt: doc.updatedAt.toISOString(),
    messageCount: doc.messageCount,
  }));
}
```

**Step 3: Run existing copilot-related tests**

Run: `npx vitest run tests/integration/e2e-copilot-memory.test.ts tests/integration/copilot-pi.test.ts`
Expected: PASS — the aggregation returns the same data shape

**Step 4: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 5: Commit**
```bash
git add src/services/copilot/memory-service.ts
git commit -m "fix(perf): replace N+1 in listConversations with aggregation pipeline"
```

### Phase 2 Gate

Run: `npm run lint && npx tsc --noEmit && npm run test && npm run build`
Expected: All four commands succeed with exit code 0.

Verification checklist:
- [ ] `grep "unsafe-eval" src/proxy.ts` — returns nothing
- [ ] `npx vitest run tests/integration/setup-db.test.ts` — all pass (7 collections: assets, teams, users, activity, audit_logs, api_tokens, approval_requests, copilot_conversations, metrics_snapshots, webhooks)
- [ ] `grep -n "Promise.all.*map" src/services/copilot/memory-service.ts` — returns nothing (N+1 eliminated)

---

## Phase 3: MEDIUM Severity Fixes

> **Exit Criteria:**
> 1. `@testing-library/dom` is in `devDependencies` only
> 2. Zero `as any` in `src/lib/auth.ts` and `src/services/copilot/pi-agent.ts`
> 3. Audit log query in settings/audit is org-scoped (user's teams, not just first team)
> 4. All `requireAuth()` calls in API routes pass `request` parameter
> 5. Settings tokens audit log uses correct `teamId` (not `userId`)
> 6. `npm run test` passes, `npx tsc --noEmit` passes, `npm run build` passes

**Skills to load INSIDE the builder agent (MANDATORY — invoke before writing any code):**
```
Skill(skill="api-security-best-practices")
Skill(skill="typescript-advanced-types")
Skill(skill="nextjs-app-router-patterns")
Skill(skill="react-best-practices")
Skill(skill="mongodb-query-optimizer")
```

### Task 3.1: Move `@testing-library/dom` to devDependencies

**Files:**
- Modify: `package.json`

**Step 1: Modify `package.json`**

Remove `"@testing-library/dom": "^10.4.1"` from `dependencies` (line 21).

Add `"@testing-library/dom": "^10.4.1"` to `devDependencies` (in alphabetical order, after `@tailwindcss/postcss`).

**Step 2: Verify installation**

Run: `npm install` (or `bun install` if using bun)
Expected: Installs correctly, no missing peer deps

**Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (testing-library/dom is still available in test context via devDeps)

**Step 4: Commit**
```bash
git add package.json
git commit -m "fix: move @testing-library/dom to devDependencies"
```

### Task 3.2: Type-safe auth session callback (remove `as any`)

**Files:**
- Create: `src/types/next-auth.d.ts`
- Modify: `src/lib/auth.ts` (lines 109-118)

**Step 1: Create NextAuth type augmentation**

Create `src/types/next-auth.d.ts`:
```typescript
/**
 * NextAuth.js type augmentations.
 *
 * Per typescript-advanced-types module-augmentation:
 * Extends the Session type with org/team context fields
 * so we don't need `as any` in the session callback.
 */

import "next-auth";

declare module "next-auth" {
  interface Session {
    activeOrgId?: string;
    activeTeamId?: string;
    orgRole?: string;
    teamRole?: string;
    hasOrg?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    provider?: string;
    providerAccountId?: string;
    activeOrgId?: string;
    activeTeamId?: string;
    orgRole?: string;
    teamRole?: string;
    hasOrg?: boolean;
  }
}
```

**Step 2: Update `src/lib/auth.ts` session callback**

Change lines 106-118 from:
```typescript
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const s = session as any;
        s.activeOrgId = token.activeOrgId;
        s.activeTeamId = token.activeTeamId;
        s.orgRole = token.orgRole;
        s.teamRole = token.teamRole;
        s.hasOrg = token.hasOrg;
      }
      return session;
    },
```
To:
```typescript
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
      }
      session.activeOrgId = token.activeOrgId as string | undefined;
      session.activeTeamId = token.activeTeamId as string | undefined;
      session.orgRole = token.orgRole as string | undefined;
      session.teamRole = token.teamRole as string | undefined;
      session.hasOrg = token.hasOrg as boolean | undefined;
      return session;
    },
```

Also remove the `// eslint-disable-next-line` comment since `as any` is gone.

**Step 3: Verify type check**

Run: `npx tsc --noEmit`
Expected: PASS — no type errors. The augmented Session type now has the fields.

**Step 4: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 5: Commit**
```bash
git add src/types/next-auth.d.ts src/lib/auth.ts
git commit -m "fix(types): type-safe auth session via module augmentation, remove as any"
```

### Task 3.3: Type-safe copilot model resolution (remove `as any`)

**Files:**
- Modify: `src/services/copilot/pi-agent.ts` (line 84)

**Step 1: Inspect pi-ai types to understand the signature**

The `getModel` function from `@mariozechner/pi-ai` accepts provider and model strings. The `as any` casts are used because the env vars could be any string, not just the known provider/model literals.

**Step 2: Create a validated approach**

Change lines 78-86 from:
```typescript
  const provider = process.env.COPILOT_PROVIDER?.trim() ?? "";
  const modelId = process.env.COPILOT_MODEL?.trim() ?? "";

  // Explicit provider + model
  if (provider && modelId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = getModel(provider as any, modelId as any);
    if (model) return model;
  }
```
To:
```typescript
  const provider = process.env.COPILOT_PROVIDER?.trim() ?? "";
  const modelId = process.env.COPILOT_MODEL?.trim() ?? "";

  // Explicit provider + model — validate provider before calling getModel
  if (provider && modelId) {
    const supportedProviders = ["anthropic", "openai", "google"] as const;
    type SupportedProvider = (typeof supportedProviders)[number];
    if (supportedProviders.includes(provider as SupportedProvider)) {
      const model = getModel(provider as SupportedProvider, modelId as Parameters<typeof getModel>[1]);
      if (model) return model;
    }
  }
```

Note: If `getModel` from `@mariozechner/pi-ai` uses string literal types internally, the builder should check the actual exported types and adjust the cast accordingly. The key requirement is: remove `as any` and use either a validated union type or `Parameters<typeof getModel>[N]` extraction.

Also remove the `// eslint-disable-next-line` comment.

**Step 3: Verify type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 4: Run copilot tests**

Run: `npx vitest run tests/integration/copilot-pi.test.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add src/services/copilot/pi-agent.ts
git commit -m "fix(types): type-safe copilot model resolution, remove as any"
```

### Task 3.4: Org-scoped audit log query

**Files:**
- Modify: `src/app/api/settings/audit/route.ts` (lines 15-27)

**Step 1: Fix audit log scoping**

The current code (lines 22-27) uses only the first team:
```typescript
  const user = await db.collection<UserDocument>("users").findOne({ _id: userId });
  const teamId = user?.teamMemberships?.[0]?.teamId;
  if (!teamId) {
    return NextResponse.json({ entries: [], total: 0 });
  }
```

Change to aggregate across ALL of the user's teams:
```typescript
  const user = await db.collection<UserDocument>("users").findOne({ _id: userId });
  const teamIds = user?.teamMemberships?.map((m: { teamId: ObjectId }) => m.teamId) ?? [];
  if (teamIds.length === 0) {
    return NextResponse.json({ entries: [], total: 0 });
  }
```

Then update the filter from `{ teamId }` to `{ teamId: { $in: teamIds } }`:
```typescript
  const filter: Record<string, unknown> = { teamId: { $in: teamIds } };
```

Also update the SIEM export call from `exportToSiem(db, { teamId })` to pass the list. Check the `exportToSiem` signature — if it only accepts a single `teamId`, update the call:
```typescript
  if (searchParams.get("export") === "siem") {
    const events = await exportToSiem(db, { teamId: teamIds[0] });
    // Note: SIEM export scoped to primary team for now; multi-team SIEM is future enhancement
    ...
  }
```

**Step 2: Also fix the `requireAuth()` call to pass request**

Change line 16 from:
```typescript
  const authResult = await requireAuth();
```
To:
```typescript
  const authResult = await requireAuth(request);
```

**Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 4: Commit**
```bash
git add src/app/api/settings/audit/route.ts
git commit -m "fix: org-scoped audit logs + pass request to requireAuth"
```

### Task 3.5: Standardize `requireAuth(request)` across all API routes

**Files:**
- Modify: 22 API route files that call `requireAuth()` without `request`

**Complete list of files to modify** (34 call sites across 22 files):

1. `src/app/api/orgs/route.ts` — 2 calls
2. `src/app/api/copilot/chat/route.ts` — 1 call
3. `src/app/api/teams/[teamId]/members/route.ts` — 3 calls
4. `src/app/api/approvals/route.ts` — 2 calls
5. `src/app/api/approvals/[requestId]/review/route.ts` — 1 call
6. `src/app/api/teams/[teamId]/mentions/route.ts` — 2 calls
7. `src/app/api/orgs/[orgId]/webhooks/route.ts` — 2 calls
8. `src/app/api/settings/audit/route.ts` — already fixed in Task 3.4
9. `src/app/api/teams/[teamId]/feed/route.ts` — 2 calls
10. `src/app/api/assets/[id]/versions/route.ts` — 1 call
11. `src/app/api/settings/webhooks/route.ts` — 3 calls
12. `src/app/api/orgs/[orgId]/sso/route.ts` — 3 calls
13. `src/app/api/teams/[teamId]/metrics/route.ts` — 1 call
14. `src/app/api/assets/[id]/supply-chain/route.ts` — 1 call
15. `src/app/api/orgs/[orgId]/discover/route.ts` — 1 call
16. `src/app/api/assets/[id]/versions/rollback/route.ts` — 1 call
17. `src/app/api/orgs/[orgId]/departments/route.ts` — 2 calls
18. `src/app/api/orgs/[orgId]/metrics/departments/route.ts` — 1 call
19. `src/app/api/orgs/[orgId]/metrics/route.ts` — 1 call
20. `src/app/api/orgs/[orgId]/departments/[deptId]/route.ts` — 1 call
21. `src/app/api/orgs/[orgId]/compliance/route.ts` — 1 call
22. `src/app/api/dashboard/stats/route.ts` — 1 call

**Approach for each file:**

For every `export async function GET|POST|PATCH|PUT|DELETE(request: NextRequest)` handler that calls `requireAuth()`:

1. Verify the function signature already has `request: NextRequest` parameter
2. Change `requireAuth()` to `requireAuth(request)`
3. This enables Bearer token auth for all routes (currently only session auth works on these routes)

**IMPORTANT:** Each handler function already receives `request: NextRequest` as its parameter — this is guaranteed by the Next.js App Router convention. The change is simply adding `request` as the argument to `requireAuth()`.

**Step 1: Apply changes to all 22 files**

Use find-and-replace: in each file, change `await requireAuth()` to `await requireAuth(request)`.

For route files that have multiple handlers (GET, POST, PATCH, DELETE), ensure ALL handlers pass `request`.

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Verify no bare `requireAuth()` remains in API routes**

Run: `grep -rn 'requireAuth()' src/app/api/`
Expected: Zero results (all calls now pass `request`)

Note: `src/lib/auth-guard.ts` has its own `requireAuth()` (no args, throws-style) — this is a different function used by server actions, not API routes. Leave it unchanged.

**Step 4: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 5: Commit**
```bash
git add src/app/api/
git commit -m "fix(auth): standardize requireAuth(request) across all 22 API route files"
```

### Task 3.6: Fix `teamId: userId` corruption in settings tokens audit log

**Files:**
- Modify: `src/app/api/settings/tokens/route.ts` (lines 81-88, 124-131)

**Step 1: Fix POST handler audit log (line 86)**

The POST handler already resolves the user's team membership:
```typescript
const user = await db.collection<UserDocument>("users").findOne({ _id: userId });
```

Line 86 currently uses:
```typescript
    teamId: user?.teamMemberships?.[0]?.teamId ?? orgId,
```

This is acceptable as a fallback. Keep this line as-is (it correctly tries teamMemberships first).

**Step 2: Fix PATCH handler audit log (line 129)**

The PATCH handler currently uses:
```typescript
    teamId: userId, // best effort
```

This is the bug — `userId` (an ObjectId for the user) is being stored as `teamId` in the audit log.

Change lines 124-131 from:
```typescript
  await logAuditEvent(db, {
    actorId: userId,
    action: "auth:token_revoke",
    targetId: tokenId,
    targetType: "api_token",
    teamId: userId, // best effort
    details: {},
  });
```
To:
```typescript
  // Resolve actual teamId from user memberships
  const user = await db.collection<UserDocument>("users").findOne(
    { _id: userId },
    { projection: { teamMemberships: { $slice: 1 }, orgMemberships: { $slice: 1 } } }
  );
  const auditTeamId = user?.teamMemberships?.[0]?.teamId ?? user?.orgMemberships?.[0]?.orgId ?? userId;

  await logAuditEvent(db, {
    actorId: userId,
    action: "auth:token_revoke",
    targetId: tokenId,
    targetType: "api_token",
    teamId: auditTeamId,
    details: {},
  });
```

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 4: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 5: Commit**
```bash
git add src/app/api/settings/tokens/route.ts
git commit -m "fix: resolve correct teamId in token revoke audit log"
```

### Phase 3 Gate

Run: `npm run lint && npx tsc --noEmit && npm run test && npm run build`
Expected: All four commands succeed with exit code 0.

Verification checklist:
- [ ] `grep '"@testing-library/dom"' package.json` — appears only in `devDependencies`
- [ ] `grep 'as any' src/lib/auth.ts` — returns nothing
- [ ] `grep 'as any' src/services/copilot/pi-agent.ts` — returns nothing
- [ ] `grep 'requireAuth()' src/app/api/ -r` — returns nothing (all pass request)
- [ ] `grep 'teamId: userId' src/app/api/settings/tokens/route.ts` — returns nothing
- [ ] `npx tsc --noEmit` — zero errors

---

## Final Gate

Run all verification commands:
```bash
npm run lint && npx tsc --noEmit && npm run test && npm run build
```

Then verify the specific security fixes:
```bash
# 1. No unescaped regex from user input
grep -rn '\$regex' src/ | grep -v escapeRegex | grep -v node_modules
grep -rn 'new RegExp' src/ | grep -v escapeRegex | grep -v node_modules

# 2. Middleware wired
ls src/middleware.ts

# 3. No unsafe-eval
grep 'unsafe-eval' src/proxy.ts

# 4. No as any in security paths
grep 'as any' src/lib/auth.ts src/services/copilot/pi-agent.ts

# 5. No bare requireAuth() in API routes
grep -rn 'requireAuth()' src/app/api/

# 6. No teamId corruption
grep 'teamId: userId' src/app/api/settings/tokens/route.ts
```

Expected: All grep commands return nothing (no matches).

---

## Risks

| Risk | Dimension | P | I | Score | Mitigation |
|------|-----------|---|---|-------|------------|
| CSP change breaks Next.js inline scripts | Technical | 2 | 4 | 8 | `unsafe-inline` is kept; only `unsafe-eval` removed. Verify with `npm run build` |
| Middleware wiring causes route conflicts | Technical | 1 | 4 | 4 | Matcher pattern from proxy.ts already tested; excludes `_next/static` and `_next/image` |
| N+1 fix changes response shape | Quality | 1 | 3 | 3 | Aggregation pipeline returns identical fields; existing tests verify |
| `requireAuth(request)` changes break routes that use `headers()` | Technical | 2 | 4 | 8 | `requireAuth` already accepts optional request; when present, it uses `request.headers` directly instead of `headers()` |
| pi-ai `getModel` type signature differs from assumption | Technical | 2 | 2 | 4 | Builder should inspect actual types; fallback to `Parameters<typeof getModel>` extraction |
| Missing regex injection site not identified | Security | 1 | 5 | 5 | Post-fix grep verification catches any remaining unescaped patterns |

---

## Success Criteria

- [ ] All 12 findings fixed
- [ ] Zero `as any` in security-sensitive paths
- [ ] Zero COLLSCAN on auth-critical paths (api_tokens indexed)
- [ ] All collections have validators and indexes
- [ ] `npm run lint && npx tsc --noEmit && npm run test && npm run build` all green
- [ ] New regression tests for CRITICAL fixes (escapeRegex, proxy security headers, api_tokens indexes)
- [ ] 544+ existing tests still pass
