# Review Findings Fix — Design

## Purpose
Fix all 12 findings from the CC10x full codebase review (wf-20260405T211107Z-bd56607d).
Security-first: 3 CRITICAL issues enable real attacks or leave the app unprotected.

## Users
- Developers (secure API surface, honest middleware, indexed DB)
- End users (protected from injection, rate-limited)
- Admins (correct audit logs, org-scoped visibility)

## Success Criteria
- [ ] Zero regex injection paths — all user input to `$regex` passes through `escapeRegex()`
- [ ] Security middleware active — `proxy.ts` wired via Next.js middleware convention
- [ ] All collections indexed — zero COLLSCAN on auth-critical paths
- [ ] CSP hardened — no `unsafe-eval`
- [ ] N+1 eliminated in `listConversations`
- [ ] All existing tests pass (544+)
- [ ] New regression tests for each CRITICAL fix
- [ ] `npm run lint && npx tsc --noEmit && npm run test && npm run build` all green

## Constraints
- MongoDB Atlas M0 (maxPoolSize=5, no $text, limited connections)
- Must not break existing API contracts
- Security fixes are irreversible-risk — critical_path verification rigor
- Read existing `escapeRegex` and extend, don't reinvent

## Out of Scope
- Content-Disposition header injection (deferred)
- In-memory rate limit store cleanup/eviction (deferred)
- `window.location.href` in sidebar keyboard shortcuts (deferred)
- New features or architectural changes

## Approach Chosen
**Severity-based phasing** — fix CRITICALs first, then HIGHs, then MEDIUMs.

---

## Phase 1: CRITICAL Security Fixes

### Fix 1.1 — Extract `escapeRegex()` to shared utility and apply everywhere

**Problem:** Regex injection in 5 locations. `escapeRegex()` exists at `src/app/api/assets/route.ts:19-21` but is local to that file.

**Approach:**
1. Move `escapeRegex()` to `src/lib/utils.ts` (new file, single function)
2. Import and apply in all 5 injection sites:
   - `src/app/api/marketplace/browse/route.ts:46-48` — wrap `q` in `escapeRegex(q)`
   - `src/app/api/settings/audit/route.ts:49` — wrap `actionPrefix` in `escapeRegex()`
   - `src/services/copilot/pi-tools.ts:43-44` — wrap split query terms
   - `src/services/copilot/tool-executor.ts:50-51` — same pattern
   - `src/app/api/skills/import/route.ts:79` — wrap `repoUrl` before `new RegExp()`
3. Update `src/app/api/assets/route.ts` to import from shared util
4. Add test: `tests/lib/utils.test.ts` — verify escaping of special regex chars

**Files:** `src/lib/utils.ts` (new), 6 files updated

**Skills to load inside builder agent:**
- `api-security-best-practices` (input validation, injection prevention)

### Fix 1.2 — Wire `proxy.ts` to Next.js middleware

**Problem:** `proxy.ts` implements rate limiting + security headers but is not wired. Zero security headers in production.

**Approach:**
1. Create `src/middleware.ts` with:
   ```typescript
   export { proxy as middleware, config } from "@/proxy";
   ```
2. Verify middleware runs on all non-static routes
3. Add integration test: `tests/integration/middleware.test.ts`

**Files:** `src/middleware.ts` (new), 1 test file

**Skills to load inside builder agent:**
- `nextjs-app-router-patterns` (middleware convention)
- `api-security-best-practices` (security headers)

### Fix 1.3 — Add `api_tokens` index for token validation

**Problem:** Every Bearer auth request does a COLLSCAN on `api_tokens`.

**Approach:**
1. Add to `setup-db.ts`:
   ```typescript
   ensureCollection(db, "api_tokens", apiTokensValidator)
   db.collection("api_tokens").createIndex(
     { tokenHash: 1, revoked: 1 },
     { name: "token_validation" }
   );
   db.collection("api_tokens").createIndex(
     { userId: 1 },
     { name: "user_tokens" }
   );
   ```
2. Add `apiTokensValidator` to `src/lib/schema.ts`
3. Update existing token service tests to verify index usage

**Files:** `src/lib/setup-db.ts`, `src/lib/schema.ts`

**Skills to load inside builder agent:**
- `mongodb-schema-design` (validator patterns)
- `mongodb-query-optimizer` (index strategy, ESR)
- `mongodb-connection` (M0 constraints)

---

## Phase 2: HIGH Severity Fixes

### Fix 2.1 — Remove `unsafe-eval` from CSP

**Problem:** `unsafe-eval` in CSP defeats XSS protection.

**Approach:**
1. In `src/proxy.ts:82`, change script-src to:
   ```
   "script-src 'self' 'unsafe-inline'"
   ```
   Note: `unsafe-inline` is kept for Next.js inline scripts. Nonce-based CSP is a future enhancement.
2. Verify the app still loads correctly with this CSP change
3. Test: add CSP header assertion in middleware test

**Files:** `src/proxy.ts`

**Skills to load inside builder agent:**
- `api-security-best-practices` (CSP best practices)

### Fix 2.2 — Add 4 remaining missing collections to `setup-db.ts`

**Problem:** `approval_requests`, `copilot_conversations`, `metrics_snapshots`, `webhooks` have no indexes or validators.

**Approach:**
1. Create validators in `src/lib/schema.ts`:
   - `approvalRequestsValidator` — assetId, teamId, action, status required
   - `copilotConversationsValidator` — teamId, userId, messages required
   - `metricsSnapshotsValidator` — basic structure validation
   - `webhooksValidator` — url, events, teamId required
2. Add to `setup-db.ts` with indexes:
   ```
   approval_requests: { assetId:1, teamId:1, status:1 }, { status:1, teamId:1, createdAt:-1 }
   copilot_conversations: { teamId:1, userId:1, updatedAt:-1 }, TTL on expiresAt
   metrics_snapshots: { orgId:1, timestamp:-1 }
   webhooks: { teamId:1 }
   ```

**Files:** `src/lib/schema.ts`, `src/lib/setup-db.ts`

**Skills to load inside builder agent:**
- `mongodb-schema-design` (validators, TTL indexes)
- `mongodb-query-optimizer` (compound index design, ESR)

### Fix 2.3 — Eliminate N+1 in `listConversations`

**Problem:** Fetches N docs then N individual `findOne` queries for message count.

**Approach:**
1. Replace the `Promise.all` N+1 pattern with aggregation:
   ```typescript
   const docs = await db.collection("copilot_conversations")
     .find({ teamId, userId })
     .sort({ updatedAt: -1 })
     .limit(limit)
     .project({ title: 1, updatedAt: 1, messageCount: { $size: "$messages" } })
     .toArray();
   ```
2. If `$size` in projection is not supported, use aggregation pipeline:
   ```typescript
   db.collection("copilot_conversations").aggregate([
     { $match: { teamId, userId } },
     { $sort: { updatedAt: -1 } },
     { $limit: limit },
     { $project: { title: 1, updatedAt: 1, messageCount: { $size: "$messages" } } }
   ])
   ```

**Files:** `src/services/copilot/memory-service.ts`

**Skills to load inside builder agent:**
- `mongodb-query-optimizer` (aggregation vs find, projection)
- `mongodb-natural-language-querying` (pipeline patterns)

---

## Phase 3: MEDIUM Severity Fixes

### Fix 3.1 — Move `@testing-library/dom` to devDependencies

**Files:** `package.json`

### Fix 3.2 — Type-safe auth session callback (remove `as any`)

**Approach:** Extend NextAuth Session type via module augmentation in `src/types/next-auth.d.ts`.

**Files:** `src/types/next-auth.d.ts` (new), `src/lib/auth.ts`

### Fix 3.3 — Type-safe copilot model resolution (remove `as any`)

**Approach:** Create a `SupportedProvider` union type and validate before calling `getModel()`.

**Files:** `src/services/copilot/pi-agent.ts`

### Fix 3.4 — Org-scoped audit log query

**Approach:** Accept `teamId` as query parameter with RBAC check, or aggregate across user's teams.

**Files:** `src/app/api/settings/audit/route.ts`

### Fix 3.5 — Standardize `requireAuth(request)` across all routes

**Approach:** Grep all `requireAuth()` calls without `request` argument, add the request parameter.

**Files:** All API routes using `requireAuth()` without `request`

### Fix 3.6 — Fix `teamId: userId` corruption in settings tokens audit log

**Approach:** Resolve user's actual team ID from memberships before writing audit log entry.

**Files:** `src/app/api/settings/tokens/route.ts`

**Skills to load inside builder agent for Phase 3:**
- `api-security-best-practices` (auth patterns)
- `typescript-advanced-types` (module augmentation, union types)
- `nextjs-app-router-patterns` (route patterns)

---

## Testing Strategy
- Each CRITICAL fix gets a dedicated regression test
- Phase gate: `npm run lint && npx tsc --noEmit && npm run test && npm run build` must pass after each phase
- Verify `escapeRegex` with known malicious inputs: `.*`, `(?:a{1000000})`, `[`, `$`
- Verify middleware activation with header assertions
- Verify indexes exist with `listIndexes()` in setup-db tests

## Questions Resolved
- Q: Phasing approach? A: By severity — CRITICALs first, then HIGHs, then MEDIUMs
- Q: Out of scope? A: All 3 deferred items excluded (Content-Disposition, rate limit cleanup, sidebar navigation)
