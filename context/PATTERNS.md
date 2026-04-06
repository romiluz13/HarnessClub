# AgentConfig — Proven Patterns

> Patterns discovered and validated during development. Use these — don't reinvent.

### Absolute Node Tooling for Local Stdio MCP Servers (2026-04-06)
**When**: Configuring local Codex MCP servers that are launched via Node-based CLIs (`npx`, package CLIs, MCP wrappers) on macOS.
**How**:
- use an absolute Homebrew command path such as `/opt/homebrew/bin/npx`
- include an explicit `PATH` in the MCP server env with Homebrew + system binaries
- restart/reload Codex after editing `~/.codex/config.toml`
**Why**: The Codex desktop shell PATH may be much narrower than the interactive terminal PATH. Using bare `npx` can make a healthy MCP server look dead even when the real issue is only launch-path resolution.
**Files**: `~/.codex/config.toml`

### Synthetic Auth.js Session for Local Manual QA (2026-04-05)
**When**: You need to visually QA authenticated dashboard flows locally, but live OAuth is not configured or would slow down deterministic verification.
**How**:
- seed a real local Mongo tenant with user/org/team/assets
- mint a real Auth.js JWT session cookie with `@auth/core/jwt`
- mint multiple persona-specific state files if QA needs role coverage (for example manager/admin and employee/member)
- load that cookie into a headed browser session
- verify the real pages against the live local runtime instead of mocking auth in the UI
**Why**: This gives a truthful browser-level QA path for authenticated surfaces without adding dev-only auth backdoors to the product.
**Files**: `src/lib/auth.ts`, `docs/qa/2026-04-05-manual-qa-checklist.md`

### Separate Deterministic and Live Test Lanes (2026-04-05)
**When**: A repo has a stable default test suite plus a small number of real-provider tests that require secrets or external services.
**How**:
- keep the default `vitest` config deterministic and exclude `*-live.test.ts`
- create a dedicated `vitest.live.config.ts` for the explicit live lane
- expose a separate `npm run test:live`
- fail fast at module scope when the explicit live suite is invoked without the required env vars
**Why**: This gives OSS/CI a literal zero-skip baseline while keeping real-provider validation honest and easy to invoke on demand.
**Files**: `vitest.config.ts`, `vitest.live.config.ts`, `package.json`, `tests/helpers/copilot-live-config.ts`

### `useSyncExternalStore` for Hydration-Safe UI Preferences (2026-04-05)
**When**: A server-rendered client component needs to reflect a browser-stored preference such as collapsed navigation, but reading the storage value directly in render would risk hydration mismatch.
**How**: Wrap the storage-backed preference in `useSyncExternalStore` with:
- a server snapshot fallback
- a browser snapshot getter
- a subscription function that listens to both `storage` and a custom same-tab change event
**Why**: This keeps the component honest to SSR/hydration rules without falling into `set-state-in-effect` lint violations or client/server markup drift.
**Files**: `src/components/sidebar.tsx`

### Turn Warning Cleanup into Real Hardening (2026-04-05)
**When**: A repo is green enough to ship, but lint warning debt still hides stale imports, dead queries, or partially expressed guard logic.
**How**: Do not mechanically delete every warning. First ask whether the imported symbol should actually be used to make the code more truthful. In this pass, that meant validating public marketplace asset types with `ASSET_TYPES`, enforcing `skill:read` on export, and deleting only the queries/imports that were truly dead.
**Why**: Warning cleanup is one of the easiest places to accidentally throw away correctness opportunities or preserve vague security checks. Treat it as a trust-floor pass, not just cosmetics.
**Files**: `src/app/api/marketplace/[teamSlug]/route.ts`, `src/app/api/assets/[id]/export/route.ts`, `src/services/metrics-service.ts`

### Atlas Local Preview as the OSS Truth Lane (2026-04-05)
**When**: Validating search-heavy or zero-mock integration flows locally for an Atlas-dependent feature set.
**How**: Use `docker-compose.atlas-local.yml`, wait for the container health check, then run the real test matrix against `mongodb://localhost:27018/?directConnection=true` from `.env.test` so global setup can create validators, search indexes, vector indexes, and the persistent search fixture.
**Why**: Plain Mongo fallback is useful for degraded behavior, but Atlas Local Preview is the realistic local lane for verifying `$search`, `$vectorSearch`, and native `$rankFusion` before claiming OSS/self-hosted readiness.
**Files**: `docker-compose.atlas-local.yml`, `tests/helpers/global-setup.ts`, `tests/integration/search-hybrid.test.ts`, `tests/integration/e2e-onboarding.test.ts`, `tests/integration/e2e-platform.test.ts`

### Env-Gated Optional Integration Initialization (2026-04-05)
**When**: A module is imported during `next build`, but some integrations are only valid when deploy-time secrets are present (Auth.js adapters/providers, Voyage client, similar SDKs).
**How**: Export a tiny capability guard like `isMongoConfigured()`, build adapters/providers conditionally, and validate secrets inside the actual request/execution path instead of logging or throwing at module scope.
**Why**: Keeps static build/import phases clean while still failing fast the moment a real runtime path tries to use an unconfigured integration.
**Files**: `src/lib/db.ts`, `src/lib/auth.ts`, `src/lib/voyage.ts`

### Retry Live Provider Calls in Test Seeders (2026-04-05)
**When**: Integration fixtures depend on a real external AI/search provider call during suite setup.
**How**: Wrap the provider fetch in a short retry loop with explicit timeout control, then fail only after a small bounded number of attempts.
**Why**: Keeps the suite honest to real providers while preventing one transient network stall from turning the entire repo red.
**Files**: `tests/helpers/seed-capabilities.ts`

### Public Distribution Workflow in the Main Platform E2E (2026-04-05)
**When**: Release confidence depends on proving that published assets really flow through public marketplace and install endpoints, not just through service-layer helpers.
**How**: Extend `tests/integration/e2e-platform.test.ts` with a publish→browse→install workflow using real DB state and public route module handlers for team marketplace, marketplace browse, and plugin install.
**Why**: This catches distribution regressions that happy-path service tests miss, especially around release-state visibility and bundle-integrity behavior.
**Files**: `tests/integration/e2e-platform.test.ts`, `src/app/api/marketplace/[teamSlug]/route.ts`, `src/app/api/marketplace/browse/route.ts`, `src/app/api/assets/[id]/install/route.ts`

### Cross-Cutting Incremental Build — V2 Architecture (NEW)
**When**: Building features that span multiple phases (audit, scanning, UI, export)
**How**: Start lightweight in early phase, mature in later phase. Don't wait to build "the full thing."
**Examples**:
- Audit: P8 (log CRUD) → P13 (full SIEM export, search, compliance)
- Scanning: P9 (on-import basics) → P12 (trust scores, approvals, supply chain)
- UI: P8 (skills→assets migration) → P15 (dark mode, a11y, polish)
- Export: P10 (5 tool formats) → P15 (SDK packages)
**Why**: Waiting to build audit/scanning at Phase 12-13 means 4 phases operate without it.

### Phase Harmony Verification — Methodology (NEW)
**When**: Planning any multi-phase project
**How**: Check every phase pair for: (1) Does phase N produce what phase N+1 needs? (2) Are cross-cutting concerns starting early enough? (3) Are cancelled phases properly absorbed? (4) Is UI updated alongside data model changes?
**Why**: V1 had Phase 6/7 planned but not built, phase files said NOT_STARTED when work was DONE, export engine was completely missing. Caught during harmony review.

### MongoDB Connection Singleton — Infrastructure
**When**: Any file that needs database access
**How**: Create MongoClient once at module level, export a `getDb()` function. In Next.js serverless, initialize outside the handler and cache on `globalThis` in dev.
**Why**: Connection creation is expensive (50-500ms TCP+TLS+auth). M0 has limited connections.
**Skill Reference**: mongodb-connection (serverless pattern, maxPoolSize=5 for M0)

### Error→Loading→Empty→Data State Order — UI
**When**: Every component that fetches data
**How**: `if (error) → if (loading && !data) → if (!data?.length) → render data`
**Why**: Prevents showing stale data during errors, shows loading only when truly empty.
**Skill Reference**: frontend-patterns (loading-state-order CRITICAL)

### Keyed Client Form Reset — UI
**When**: A client form is initialized from fetched server data and should fully reset when the backing record changes.
**How**: Keep the editable form in a child component and pass a stable `key` derived from the record version or `updatedAt`. Initialize local state once inside that child instead of mirroring fetched data into multiple `setState()` calls in an effect.
**Why**: Avoids `set-state-in-effect` lint violations, prevents half-synced form fields, and keeps reset behavior explicit.
**Files**: `src/app/dashboard/settings/sso/page.tsx`

### ESR Index Design — Database
**When**: Creating compound indexes
**How**: Order fields as Equality → Sort → Range in compound indexes
**Why**: Maximizes index selectivity and eliminates in-memory sorts.
**Skill Reference**: mongodb-query-optimizer (core-indexing-principles)

### Parallel Promise Resolution — Performance
**When**: Multiple independent async operations (embedding + DB write, multiple API calls)
**How**: `const [embedding, saved] = await Promise.all([generateEmbedding(text), saveMetadata(doc)])`
**Why**: Eliminates sequential waterfalls — the #1 performance killer.
**Skill Reference**: vercel-react-best-practices (async-parallel, CRITICAL priority)

### No Barrel Files — Bundle
**When**: Importing from any module
**How**: `import { Button } from '@/components/ui/button'` NOT `import { Button } from '@/components'`
**Why**: Barrel files (index.ts re-exports) prevent tree-shaking and bloat bundles.
**Skill Reference**: vercel-react-best-practices (bundle-barrel-imports, CRITICAL priority)

### Vitest Dynamic Import for Env Testing — Testing
**When**: Testing modules that read process.env at import time (like db.ts, config.ts)
**How**: Use `vi.resetModules()` in beforeEach, then `await import("@/lib/module")` in each test to get fresh module with current env vars
**Why**: Module-level env reads are cached by the module system. Dynamic import after resetModules forces re-evaluation.
**Skill Reference**: test-driven-development

### globalThis Cache for Dev HMR — Infrastructure
**When**: Singleton resources (DB client, API clients) in Next.js development mode
**How**: `const g = globalThis as any; g._resource ??= createResource(); export const resource = g._resource;`
**Why**: Next.js dev mode re-evaluates modules on HMR. Without globalThis cache, each hot reload creates a new connection.
**Skill Reference**: mongodb-connection (serverless pattern)

### Separate Types from Validators — Schema
**When**: Defining MongoDB document shapes
**How**: TypeScript interfaces in `src/types/*.ts`, $jsonSchema validators in `src/lib/schema.ts`, setup in `src/lib/setup-db.ts`
**Why**: Types are consumed by application code (autocomplete, compile checks). Validators are consumed by MongoDB (runtime enforcement). Mixing them creates coupling.
**Skill Reference**: mongodb-schema-design (fundamental-schema-validation), typescript-advanced-types

### ensureCollection Pattern — Database Setup
**When**: Creating collections with validators (idempotent setup)
**How**: Check if collection exists → create with validator if not → collMod to update validator if exists
**Why**: Safe to run on every deploy. Handles both fresh and existing databases.
**Skill Reference**: mongodb-schema-design

(More patterns will be added as development progresses)


### Dual-Mode Search — AutoEmbed + Manual Fallback (Phase 8)
**When**: Semantic search must work on both M10+ (autoEmbed) and M0/local (manual Voyage)
**How**: `detectSearchMode()` checks for autoEmbed index at startup, caches result. `needsManualEmbedding()` gates client-side Voyage calls. `getVectorIndexName()` returns the right index name.
**Files**: `src/lib/search-mode.ts`, `src/services/search.ts`, `src/services/search-hybrid.ts`

### Application-Level Type Validation (Phase 8)
**When**: MongoDB $jsonSchema can't do conditional validation (oneOf/if-then-else)
**How**: DB enforces structure (required fields, bsonType). App layer (`asset-validators.ts`) enforces per-type business rules (type-specific config fields only on matching type, required sub-fields).
**Files**: `src/lib/asset-validators.ts`, `src/lib/schema.ts`

### API Helpers — DRY Auth + Team Checks (Phase 8)
**When**: Multiple API routes need the same auth, team membership, serialization patterns
**How**: Shared helpers in `src/lib/api-helpers.ts` — `requireAuth()`, `getUserTeamIds()`, `isTeamMember()`, `getMemberRole()`, `serializeAsset()`.

### Bearer-Aware Route Auth — API / Extension
**When**: A route should support both browser-session auth and personal API token auth for extension/CLI flows.
**How**: Accept the current request object in `requireAuth(request)`, validate `Authorization: Bearer ac_...` first, require a personal token with a real `userId`, then fall back to the Auth.js session when no bearer token is present.
**Why**: Keeps route auth centralized while letting OSS clients and browser extensions call the same route without needing a cookie-backed session.
**Files**: `src/lib/api-helpers.ts`, `src/app/api/assets/import/route.ts`

### Release Gate Runtime Contract Pass
**When**: Declaring an OSS/self-hosted release candidate ready.
**How**: Verify the built standalone artifact instead of stopping at route-module tests: start `node .next/standalone/server.js`, hit `/api/health`, `/api/v1`, `/auth/signin`, and at least one bearer-token-protected asset route using a real seeded token.
**Why**: This catches product-contract drift that static tests miss, like missing health routes, stale discovery docs, broken bearer auth on real requests, or Auth.js host-trust/runtime issues.
**Files**: `package.json`, `src/app/api/health/route.ts`, `src/app/api/v1/route.ts`, `src/lib/auth.ts`

### Parser Registry Pattern (Phase 9)
**When**: Need to parse multiple file formats with auto-detection
**How**: Each parser implements `ParserPlugin` interface (detect+parse). Registry runs all `detect()` methods, picks highest confidence, delegates `parse()`. Registration via side-effect imports.
**Files**: `src/services/parsers/registry.ts`, `types.ts`, individual parser files

### Security Scan Before Store (Phase 9)
**When**: Any user-supplied content entering the database (import, paste, URL fetch)
**How**: `scanContent()` runs 20+ regex patterns across 4 severity levels. Critical = block import. High/medium/low = warn but allow. Fire first, parse second.
**Files**: `src/services/security-scanner.ts`

### Exporter Registry Pattern (Phase 10)
**When**: Need to generate output files for multiple target tools from stored assets
**How**: Mirrors parser registry — each exporter implements `ExporterPlugin` (export method). Registry dispatches by target + assetType. `canExport()` + `getAvailableTargets()` for UI.
**Files**: `src/services/exporters/registry.ts`, `types.ts`, per-tool exporter files

### Plugin Bundle Model (Phase 10)
**When**: Assets need to be distributed as a unit (e.g., a department harness)
**How**: `PluginAsset.pluginConfig.bundledAssetIds[]` references other assets. `manifest` contains semver, compatibility, dependencies. Install endpoint resolves + exports all bundled assets.
**Files**: `src/types/asset.ts` (PluginManifest), `src/app/api/assets/[id]/install/route.ts`

### Org→Dept→Team Reference Hierarchy (Phase 11)
**When**: Multi-level organizational structure (org has departments, departments have teams)
**How**: Reference pattern (not embedded) — each entity is its own collection. Teams get optional `orgId`/`departmentId` fields (backward compatible). ESR indexes: `{ orgId: 1, departmentId: 1 }`.
**Files**: `src/types/organization.ts`, `src/types/team.ts`, `src/lib/schema.ts`
**Skill Reference**: mongodb-schema-design (fundamental-embed-vs-reference — "reference when entities accessed independently")

### Department Template Provisioning (Phase 11)
**When**: New department created — auto-create starter assets from template
**How**: Code-defined templates (not DB-stored). On department creation, iterate template assets and `createAsset()` each one. Store resulting IDs in `defaultAssetIds[]`.
**Files**: `src/services/department-templates.ts`, `src/services/org-service.ts`

### Type-Specific Security Scanning (Phase 12)
**When**: Assets of different types need different security checks (MCP configs vs hooks vs rules)
**How**: Base `scanContent()` runs generic patterns on ALL types. `scanAsset()` composes base + type-specific analyzer (MCP domain/transport/credential checks, hook escalation detection, settings safety validation). Results include `assetType` and `scannedAt`.
**Files**: `src/services/type-scanner.ts`, `src/services/security-scanner.ts`

### Trust Score Engine (Phase 12)
**When**: Need to communicate asset reliability to users (visual indicator, approval thresholds)
**How**: 6-component weighted formula: security(30%) + provenance(25%) + usage(15%) + age(10%) + author(10%) + recency(10%). Grades A-D. ProvenanceRecord tracks chain of custody. Advisory only — not a binary gate.
**Files**: `src/services/trust-score.ts`

### Approval Workflows (Phase 12)
**When**: Assets need review before publishing (enterprise compliance)
**How**: 3 modes per dept (auto_approve, single_review, multi_review). ApprovalRequest with decisions[]. No self-review. Status: pending→approved/rejected/withdrawn. Audit trail.
**Files**: `src/services/approval-service.ts`, `src/app/api/approvals/`
**Files**: `src/lib/api-helpers.ts`

### Asset Version History (Phase 17)
**When**: Tracking changes to assets over time, showing diffs in approval reviews
**How**: `versions[]` array embedded in asset doc. LCS-based `computeDiff()`. Auto-versioning on `updateAsset()` when `updatedBy` provided. Rollback creates new version (never mutates history). DiffViewer shows side-by-side changes. VersionTimeline with expandable entries.
**Files**: `src/services/version-service.ts`, `src/components/diff-viewer.tsx`, `src/components/version-timeline.tsx`

### Team Activity Feed (Phase 18)
**When**: Showing team activity, @mentions, unread counts
**How**: Builds human-readable feed entries from `audit_logs` collection. Actor/asset name resolution via batch lookup. Read cursors in `feed_read_cursors` collection (userId + teamId). @mentions in `mentions` collection. SWR auto-refresh (30s). Category filters (asset/team/approval/security/org). Pagination.
**Files**: `src/services/activity-feed-service.ts`, `src/components/activity-feed.tsx`, `src/app/api/teams/[teamId]/feed/`

### Custom OpenAI-Compatible Copilot Gateway (2026-04-04)
**When**: Running the Pi copilot against nonstandard OpenAI-compatible providers like Grove/Azure gateways.
**How**: If `COPILOT_BASE_URL` is present, build a custom `openai-completions` model instead of relying on `getModel()`. Normalize any full `/chat/completions` URL back to the API base root, attach provider-specific auth headers via `COPILOT_API_KEY_HEADER`, and set conservative compat flags explicitly.
**Files**: `src/services/copilot/pi-agent.ts`, `.env.example`, `tests/services/copilot-agent-config.test.ts`, `tests/integration/copilot-pi-live.test.ts`

### Streaming Copilot Route Finalization (2026-04-04)
**When**: The copilot uses the live Pi/SSE path in `POST /api/copilot/chat`.
**How**: Stream incremental text/tool events immediately, but defer transcript finalization until after `agent.prompt()` completes. Then convert the new agent messages into `CopilotMessage[]`, persist them with `saveMessages()`, parse final action blocks, compute proactive suggestions, and emit a single `agent_end` payload containing `conversationId`, `actions`, `toolsUsed`, and `proactiveSuggestions`.
**Files**: `src/app/api/copilot/chat/route.ts`, `tests/integration/copilot-chat-route.test.ts`, `tests/integration/copilot-chat-route-live.test.ts`

### Externalize Dynamic Server-Only SDKs in Standalone Next Builds (2026-04-04)
**When**: A server-side SDK uses dynamic provider loading or runtime-only imports and the Next standalone/Turbopack build emits startup-time module resolution failures.
**How**: Add the package to `serverExternalPackages` in `next.config.ts` so Node loads it directly from `node_modules` at runtime instead of bundling it into the server chunk.
**Why**: This preserves native Node resolution for complex SDK internals and avoids Turbopack rewriting dynamic imports into broken `MODULE_NOT_FOUND` stubs.
**Files**: `next.config.ts`
