# AgentConfig — Gotchas & Pitfalls

> Things that bit us. Read this before every task to avoid repeating mistakes.

### Bare `npx` in Codex MCP config can make healthy stdio servers look broken — 2026-04-06
**Symptom**: MCP servers like `octocode` or `mongodb-mcp-server` appear unavailable from Codex even though they are installed and work when launched manually.
**Root Cause**: The Codex desktop/app shell in this environment does not expose Homebrew Node binaries on `PATH`, and Homebrew `npx` itself depends on `#!/usr/bin/env node`. A config like `command = "npx"` therefore fails before the MCP server ever starts. Also, editing `~/.codex/config.toml` does not retrofit the already-running app session.
**Fix**: Use an absolute command such as `/opt/homebrew/bin/npx`, add an explicit Node-capable `PATH` in the MCP server env, and then restart/reload Codex so the live session picks up the new config.
**Prevention**: For local stdio MCP servers launched through Node tooling on macOS, never assume the Codex app PATH matches your terminal PATH. Prefer absolute Homebrew binaries plus explicit `PATH` in `~/.codex/config.toml`.

### Standalone `npm run start` can look healthy while serving an unstyled app locally — Manual QA Prep (2026-04-05)
**Symptom**: `node .next/standalone/server.js` starts, `/api/health` returns `ok`, and HTML pages load, but the interface appears unstyled because the CSS chunk 404s.
**Root Cause**: The standalone runtime expects the built static assets to be available from the standalone artifact layout, but the local start flow in this worktree does not currently serve the CSS chunk correctly.
**Fix**: For local manual QA, use `npx next start` against the built app until the standalone static-asset path is fixed.
**Prevention**: Do not treat `health ok` + HTML response as enough for runtime signoff. Always check at least one real CSS asset URL and one browser screenshot on the actual documented start command.

### A merged Vitest config can accidentally keep excluding the very live tests you are trying to restore — 2026-04-05
**Symptom**: `npm run test:live` still says “No test files found” even though the command explicitly targets the live files.
**Root Cause**: The base `vitest.config.ts` excludes `tests/**/*-live.test.ts`, and a merged config inherits that exclusion unless you replace it with a fully standalone live config.
**Fix**: Give the live lane its own `vitest.live.config.ts` instead of trying to partially override the base exclude list.
**Prevention**: When splitting deterministic and live suites, assume excludes are sticky and verify the explicit live runner actually discovers the intended files.

### Failing live-test env checks in `beforeAll()` can still show skipped tests — 2026-04-05
**Symptom**: A live suite fails with the right missing-env error, but Vitest still reports the inner tests as skipped.
**Root Cause**: The failure happens after test registration, so the suite errors out during setup while the contained tests remain marked as not run.
**Fix**: Move required live-env assertions to module scope for explicit live suites that should fail immediately when misconfigured.
**Prevention**: If “skip = fail” is part of the repo discipline, fail live-test configuration before `describe()`/`it()` registration, not inside hooks.

### Hydration-safe browser preferences are an external-store problem, not a render-time read — Trust-Floor Slice 2 (2026-04-05)
**Symptom**: A client component wants to honor `localStorage` on first load, but reading it during render causes hydration mismatch risk, while reading it in an effect triggers `react-hooks/set-state-in-effect`.
**Root Cause**: Persisted browser preferences like sidebar collapse state are external browser state, not ordinary React initialization data.
**Fix**: Model the preference with `useSyncExternalStore`, a snapshot getter, and a small subscribe/dispatch mechanism instead of render-time reads or `setState()` inside an effect.
**Prevention**: For SSR-rendered client components, treat `localStorage`/`sessionStorage` as external stores whenever their value changes visible markup.

### Type-only imports cannot power runtime validation — Warning Cleanup (2026-04-05)
**Symptom**: `tsc` fails even though lint is green, complaining that a symbol like `ASSET_TYPES` “cannot be used as a value because it was imported using import type”.
**Root Cause**: A cleanup or refactor turns a previously type-only symbol into a runtime value for validation or branching, but the import stays `import type`.
**Fix**: Split the import into runtime + type forms (for example `import { ASSET_TYPES } ...` and `import type { AssetType } ...`).
**Prevention**: Any time a warning cleanup promotes an imported symbol from “dead import” into real runtime logic, re-check whether the import must stop being type-only.

### Live route tests rot when auth-helper mocks don’t evolve with route authorization logic — 2026-04-05
**Symptom**: A live route test fails before reaching the real external provider, complaining that an export like `isTeamMember` is missing from the mocked `@/lib/api-helpers` module.
**Root Cause**: The route gained stricter authorization logic, but the test’s partial module mock still only provided the older helper surface.
**Fix**: Keep live route mocks minimal but complete for the current route path. If the route now checks `isTeamMember`, add that helper explicitly in the test mock.
**Prevention**: Whenever route authorization logic is tightened, audit live/integration tests for partial helper mocks that may now be stale.

### Live embedding seed helpers need retries or they become false-red CI gates — Release-State Recovery (2026-04-05)
**Symptom**: The full integration suite fails in a capabilities seed helper with `fetch failed` / `UND_ERR_CONNECT_TIMEOUT` against `api.voyageai.com`, even though the app code and local DB behavior are healthy.
**Root Cause**: The capabilities seed helper made a single live Voyage embeddings request and treated any transient network timeout as a hard suite failure.
**Fix**: Add a short retry loop with timeout control around the live embeddings fetch so transient provider/network stalls do not turn the whole gate red.
**Prevention**: Keep live external-provider validation, but never make a broad integration suite depend on a single no-retry network call.

### Release-state rollouts can look “architecturally right” while still breaking the lifecycle — Skeptical Review (2026-04-05)
**Symptom**: A new approval/release-state model seems to add governance, but edited published assets disappear from marketplace/install flows or approval outcomes do not restore the expected public state.
**Root Cause**: The state machine is only partially wired: one route/service demotes edited assets out of published state, another maps approved `update` requests to `approved` instead of `published`, and public distribution filters already depend on the new state.
**Fix**: Model the full release lifecycle explicitly before rollout: what happens to a published asset when edited, what state an approved update should land in, and which states are considered distributable.
**Prevention**: Treat release-state work as a state-machine migration, not a field-addition refactor. Require end-to-end tests for create → edit → request review → approve/reject → marketplace/install visibility.

### Bundle integrity must fail loudly, not degrade silently — Skeptical Review (2026-04-05)
**Symptom**: Plugin install returns `200`, but some bundled assets are silently missing from the payload.
**Root Cause**: The install route skips unpublished bundled assets instead of treating missing/non-distributable children as a bundle integrity failure.
**Fix**: Either fail the whole install with a clear error or include explicit missing-child diagnostics in the response.
**Prevention**: For bundle/distribution surfaces, never silently omit required children and still claim success.

### Scoped authorization filters can turn updates into silent no-ops — Skeptical Review (2026-04-05)
**Symptom**: A route returns success with the original `conversationId`, but the new messages never appear in history.
**Root Cause**: `updateOne()` was tightened with `teamId`/`userId` scope filters, but the caller does not check `matchedCount`. If the conversation is valid but out of scope, the write matches 0 documents and silently does nothing.
**Fix**: Whenever a scoped update is introduced for security, explicitly handle the `matchedCount === 0` case by either failing fast or creating a new in-scope record.
**Prevention**: Do not assume “more secure query filter” automatically preserves previous behavior. Security fixes that narrow write scope must also define the no-match runtime behavior.

### Env-gated backend providers must be reflected in the UI — Skeptical Review (2026-04-05)
**Symptom**: The app boots without GitHub OAuth configured, but users still see a GitHub sign-in button that fails at click time.
**Root Cause**: Backend provider registration was made conditional, but the sign-in UI still assumes GitHub is always available.
**Fix**: Expose provider availability to the sign-in surface or fail earlier with an install/setup message.
**Prevention**: Whenever an integration becomes optional at module init, audit the UI for hardcoded assumptions about that integration.

### Proxy comments can drift into false security claims — Skeptical Review (2026-04-05)
**Symptom**: A proxy file claims CORS restriction and hardened rate limiting, but the actual code only sets generic security headers and uses process-local counters.
**Root Cause**: The comments describe the intended security posture, not the implementation actually present in the file.
**Fix**: Keep proxy comments implementation-specific, and treat global/shared-state rate limiting in Proxy as best-effort only unless enforced by an upstream reverse proxy or shared store.
**Prevention**: For security-sensitive infrastructure files, review comments with the same skepticism as code.

### Atlas Local Preview can get stuck in a bad startup state after prior failures — 2026-04-05
**Symptom**: The Atlas Local Preview container starts but the app/test connection to `localhost:27018` is refused or the internal runner reports replica-state / primary-readiness issues before reaching healthy.
**Root Cause**: A stale local Atlas preview volume or partially initialized replica state can survive a failed boot and keep the next startup from converging cleanly.
**Fix**: Reset the stack with `docker compose -f docker-compose.atlas-local.yml down -v`, then bring it back up and wait for the health check to report `healthy` before running tests.
**Prevention**: Treat Atlas Local Preview as a real stateful service. If startup looks inconsistent, reset the volume and verify health before assuming the app/test layer is broken.

### Lazy DB client alone does not make Auth.js build-safe — Stabilization Wave 3
**Symptom**: `next build` exits 0, but page-data collection logs repeated `MONGODB_URI` stack traces from auth/imported route modules even after `db.ts` was made lazy.
**Root Cause**: `auth.ts` still invoked `MongoDBAdapter(getClientPromise())` at module scope, so importing the auth module eagerly touched the DB promise during build.
**Fix**: Gate adapter/provider construction behind env checks (`isMongoConfigured()`, OAuth secret presence) and only validate external secrets inside real execution paths.
**Prevention**: For any optional integration, make both the client factory and the consuming module initialization env-aware. Lazy infrastructure helpers are not enough if callers still instantiate adapters/providers at import time.

### Green Vitest can still hide broken product flows — Skeptical Audit (2026-04-05)
**Symptom**: `bun run vitest run` passes, but lint/typecheck fail and core flows like create asset, SSO settings, member management RBAC, and approval review are still broken or insecure.
**Root Cause**: The suite is strong on service/integration happy paths, but weak on UI/API contract alignment, negative authorization cases, and strict TypeScript/lint release gates.
**Fix**: Treat release readiness as `lint + tsc + build + targeted browser/API contract checks`, not Vitest alone.
**Prevention**: Add high-signal end-to-end coverage for create asset, SSO save/load, approval review authorization, team member management authorization, and private version history access.

### Claude Code slash commands are DEPRECATED — V2 Planning
**Symptom**: We originally included `command` as one of 8 asset types in V2 plan.
**Root Cause**: Claude Code deprecated slash commands (prompt/local/JSX types). Research docs mentioned them but didn't flag deprecation clearly.
**Fix**: Removed `command` from asset types. Now 7 types: skill, agent, rule, plugin, mcp_config, hook, settings_bundle.
**Lesson**: Always verify feature currency against latest Claude Code release notes, not just architecture docs.

### Auto-embeddings: M10+ required, NOT M0 — Planning (UPDATED 2026-04-03)
**Symptom**: Originally thought auto-embeddings were Docker-only preview. Actually now in Public Preview (Jan 2026).
**Root Cause**: MongoDB Automated Embedding (`autoEmbed` index type) requires M10+ on Atlas. NOT available on M0 free tier. Community Edition 8.2+ also supports it.
**Fix**: ADR-010 — Use `autoEmbed` as primary strategy for M10+ production. Keep manual Voyage pipeline (`src/lib/voyage.ts`) as fallback for M0/local dev. Runtime detection determines which path to use.
**Key Details**: Index type `autoEmbed` (NOT old `text` type which is deprecated). Query uses `query: "text"` instead of `queryVector: [numbers]`. Voyage API key configured in Atlas/mongot, NOT in app code. Supports `voyage-3-lite`, `voyage-4`, `voyage-4-lite`.
**Prevention**: Check tier requirements for ALL Atlas features. M0 is heavily constrained — always plan a fallback path.

### Skill files are symlinks — Research
**Symptom**: `view` tool returns "File not found" for skill SKILL.md files
**Root Cause**: Files at `~/.augment/skills/` are symlinks to `~/.agents/skills/`. The view tool doesn't follow symlinks reliably.
**Fix**: Use `cat` via `launch-process` instead of `view` tool for symlinked files, or resolve with `realpath` first
**Prevention**: When reading files outside the workspace that might be symlinks, use shell commands

### grep -E alias conflict — Tooling
**Symptom**: `grep -E` fails with "unknown encoding" error
**Root Cause**: `rg` (ripgrep) is aliased over `grep` and `-E` means something different
**Fix**: Use explicit `grep -e "pattern1" -e "pattern2"` or use `rg` with proper syntax
**Prevention**: Use `rg` directly with `rg "pattern"` syntax, or escape to `/usr/bin/grep`

### create-next-app refuses existing files — Phase 0.1
**Symptom**: `npx create-next-app . --yes` fails with "directory contains files that could conflict"
**Root Cause**: create-next-app checks for ANY existing files (AGENTS.md, context/, etc.) and refuses to proceed
**Fix**: Temporarily move conflicting files to /tmp, run create-next-app, then restore
**Prevention**: Always run create-next-app in a clean directory, then add project files after

### Next.js version mismatch — Phase 0.1
**Symptom**: Plan says "Next.js 15" but create-next-app@latest installs 16.2.2
**Root Cause**: Next.js 16 was released and is now the latest stable version
**Fix**: Use 16.2.2 — it's the latest and has all the features we need (App Router, RSC, Server Actions)
**Prevention**: Always use @latest and document the actual version installed

### RRF rank math is counterintuitive — Phase 2.5
**Symptom**: Test asserted item "a" (rank 0 in list 1, rank 2 in list 2) would beat item "b" (rank 1 in list 1, rank 0 in list 2)
**Root Cause**: RRF formula 1/(k+rank+1) — having rank 0 in ANY list gives the same base score. "b" wins because its second rank (1) is better than "a"'s second rank (2)
**Fix**: Do the math: a = 1/61 + 1/63 ≈ 0.03227, b = 1/62 + 1/61 ≈ 0.03258 → b wins
**Prevention**: Always calculate RRF scores by hand before writing test assertions

### canManageRole needs permission check before hierarchy check — Phase 3.2
**Symptom**: Test expected member cannot manage viewer, but function returned true
**Root Cause**: Role hierarchy check (member index > viewer index) was done without first checking if the manager role has `team:manage_members` permission
**Fix**: Added `hasPermission(managerRole, "team:manage_members")` check before hierarchy comparison
**Prevention**: Always check PERMISSION first, then HIERARCHY. The two are separate concerns.

### MongoDB client throws at import time during build — Phase 0 Audit
**Symptom**: `bun run build` fails with "MONGODB_URI environment variable is not set" during page data collection
**Root Cause**: `db.ts` creates `MongoClient` and throws at module-level. Next.js imports all route modules during build.
**Fix**: Make client creation lazy via `getClientPromise()` function. Return `Promise.reject()` when URI missing (build imports but never awaits).
**Prevention**: Never throw at module scope in files imported by Next.js routes. Use lazy initialization.

### bsonType "int" fails for JavaScript numbers — Phase 1 Audit
**Symptom**: Documents inserted from Node.js fail $jsonSchema validation on numeric fields
**Root Cause**: JavaScript numbers are IEEE 754 doubles. MongoDB stores them as BSON "double", not "int". A validator with `bsonType: "int"` rejects them.
**Fix**: Use `bsonType: ["int", "double"]` for numeric fields that receive values from JavaScript
**Prevention**: Never use `bsonType: "int"` alone for fields populated by JS. Always use `["int", "double"]`.

### voyage-3-lite is 512 dimensions, not 1024 — Phase 2 Audit
**Symptom**: Embedding tests fail with `expected 1024, received 512`
**Root Cause**: Documentation and code assumed voyage-3-lite = 1024d, but the real API returns 512d vectors
**Fix**: Changed `EMBEDDING_DIMENSIONS` from 1024 to 512 in voyage.ts. Updated vector search index definition.
**Prevention**: Always verify embedding dimensions with a real API call before hardcoding.

### Vitest parallel files + shared MongoDB = data races — Integration Tests
**Symptom**: `updateOne` returns `matchedCount: 0` even though `findOne` just found the doc
**Root Cause**: Vitest runs test files in parallel by default. `cleanTestDb()` in one file's `beforeEach` wipes all collections, deleting data another file's test just inserted.
**Fix**: Added `fileParallelism: false` to vitest.config.ts since all tests share one real MongoDB connection.
**Prevention**: When all tests share a real database, always disable file parallelism.

### createTestUser needs unique auth fields — Integration Tests
**Symptom**: `E11000 duplicate key error on auth_provider_unique index`
**Root Cause**: Test helper created users without `auth.provider` and `auth.providerId`. The unique index on `{ "auth.provider": 1, "auth.providerId": 1 }` rejects multiple docs with `{null, null}`.
**Fix**: Added unique `auth` fields to `createTestUser` helper.
**Prevention**: Test factories must include ALL fields that participate in unique indexes.

### Atlas Search static mappings: nested fields need document syntax — Phase 2 Audit
**Symptom**: `$search` returns 0 results even though the index is READY and the document exists
**Root Cause**: Dotted path notation like `"metadata.name": { type: "string" }` does NOT work in Atlas Search static field mappings. The index creates successfully and shows READY, but never indexes the actual data.
**Fix**: Use nested document syntax: `metadata: { type: "document", fields: { name: { type: "string" } } }`
**Prevention**: Always use the `{ type: "document", fields: {...} }` syntax for nested object fields in Atlas Search index definitions.

### Atlas Search re-sync after collection changes on M0 — Phase 2 Audit
**Symptom**: `$search` suddenly returns 0 results after deleting documents from the collection
**Root Cause**: Deleting documents from a collection triggers Atlas Search to re-sync the index. On M0 free tier, this re-sync can take 2-5+ minutes, during which all documents may be temporarily unavailable via `$search`.
**Fix**: Use persistent fixture documents for search tests. Global setup verifies the fixture is searchable BEFORE tests run. `cleanTestDb()` preserves `_searchFixture: true` docs.
**Prevention**: Minimize writes to collections with Atlas Search indexes during tests.

### dropSearchIndex + createSearchIndex race condition — Phase 2 Audit
**Symptom**: `createSearchIndex` silently fails after dropping an index (index never appears)
**Root Cause**: After `dropSearchIndex`, the index enters a DELETING state that can take 30+ seconds. If `createSearchIndex` is called before deletion completes, it fails with "already defined" and the new index is never created.
**Fix**: Poll `listSearchIndexes()` after drop, waiting until the index fully disappears, before creating the new one.
**Prevention**: Always wait for full deletion before recreation.

### Grove/OpenAI-compatible GPT-5 routes need compat tuning — Copilot Live Validation
**Symptom**: Real Pi copilot requests fail with `400 Unsupported parameter: 'max_tokens'` or never reach a usable assistant/tool turn.
**Root Cause**: A custom Grove/Azure-compatible GPT-5 route may accept OpenAI-style chat completions but still require `max_completion_tokens` instead of `max_tokens`. Also, users often paste the full `/chat/completions` endpoint instead of the base API URL.
**Fix**: Normalize `COPILOT_BASE_URL` by stripping `/chat/completions` and configure the custom model with `compat.maxTokensField = "max_completion_tokens"`.
**Prevention**: For every new OpenAI-compatible gateway, run a real live smoke test and verify the exact token field + URL shape before declaring it supported.

### Copilot browser E2E is blocked by missing UI surface
**Symptom**: You want a real browser-driven copilot test, but there is no copilot page/component to automate in the current app shell.
**Root Cause**: The product currently exposes the copilot mainly through the API route and lower-level tests; no dedicated copilot UI surface exists in `src/app` / `src/components`.
**Fix**: Validate at the route/SSE layer for now. If true browser E2E is required later, add a dedicated copilot UI surface first, then automate it.
**Prevention**: When introducing new platform capabilities that require top-of-stack validation, ship at least one user-facing route/component so browser automation has a stable target.

### Pi AI + standalone Next bundle can crash at startup — Copilot Production Validation
**Symptom**: `bun run build` succeeds, but the standalone server logs `Cannot find module as expression is too dynamic` and emits unhandled rejections on boot.
**Root Cause**: Turbopack bundles `@mariozechner/pi-ai` into the server chunk and rewrites its internal dynamic provider/runtime imports into broken module stubs.
**Fix**: Add `@mariozechner/pi-ai` and `@mariozechner/pi-agent-core` to `serverExternalPackages` in `next.config.ts`.
**Prevention**: When a server-only SDK performs dynamic runtime/provider loading, externalize it from the Next standalone server bundle instead of trying to bundle it.

### Auth.js standalone smoke can fail with UntrustedHost — Final Release Gate
**Symptom**: The built standalone server starts, but the first auth/session request logs `UntrustedHost: Host must be trusted` even when `NEXTAUTH_URL` is set.
**Root Cause**: Auth.js requires explicit host trust in self-hosted/runtime deployments that rely on the incoming `Host` header.
**Fix**: Set `trustHost: true` in `src/lib/auth.ts`.
**Prevention**: Always include a real standalone runtime smoke in the release gate for Auth.js apps; `next build` alone will not surface host-trust issues.

(More gotchas will be added as development progresses)
