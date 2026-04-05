# AgentConfig (formerly SkillsHub) — Project State

## Current State

## 2026-04-05: Stabilization Wave 3 — Green Gates + Clean Build Truth

### What Was Fixed
- Cleared the remaining global TypeScript failure by typing the Atlas search integration pipeline as `aggregate<SearchMatch>()` instead of returning raw `Document` values.
- Updated the copilot chat route integration test to mock `isTeamMember()` explicitly, matching the stricter team-scoped conversation authorization path.
- Made Auth.js initialization env-aware: `auth.ts` now only constructs the Mongo adapter when Mongo is configured and only registers the GitHub provider when OAuth secrets are present.
- Exported `isMongoConfigured()` from `src/lib/db.ts` so server-only integrations can avoid module-scope DB setup when envs are absent during `next build`.
- Removed import-time Voyage warnings and switched the embedding client to validate `VOYAGE_API_KEY` only when an embedding request is actually made.
- Migrated the deprecated Next.js `middleware` file convention to `src/proxy.ts`, preserving security headers and per-tier rate limiting without the deprecation warning.
- Cleaned the SearchBar escape-key test so the suite no longer emits React `act(...)` warnings during verification.

### Verification
- `npx tsc --noEmit` ✅
- `npm run lint` ✅ (0 errors, warnings remain)
- `npm run test` ✅ 519 passed, 2 skipped
- `npm run build` ✅ clean build output with no repeated `MONGODB_URI`/`VOYAGE_API_KEY` stack traces

### What This Means
- The repo is back to a credible engineering baseline: typecheck, lint, tests, and build all pass together, and the build log is now honest instead of succeeding with hidden runtime-initialization noise.
- The highest-value remaining product hardening work is now the deeper production plan items rather than release-discipline cleanup: context spine completion, approval/release enforcement, placeholder ownership removal, distributed rate limiting, and the remaining warning cleanup.

## 2026-04-05: Stabilization Wave 2 — Team Management + Token Ownership + Create Flow + Extension Bootstrap

### What Was Fixed
- Team member management now enforces real role hierarchy instead of plain membership.
- Regular members can no longer invite/remove/update members through `/api/teams/:teamId/members`.
- Admins can only manage roles below admin; generic owner transfer/removal is now blocked from the member-management route.
- Personal API token revocation is now scoped to the token owner instead of matching arbitrary org-scoped tokens.
- `requireAuth()` now supports bearer personal API tokens when a route passes the request object, which makes extension/CLI-style flows viable without a browser session cookie.
- The raw asset import route now accepts bearer-token auth and the Chrome extension import path now sends the correct `assetType` field.
- The asset create page now includes the active `teamId` from session context instead of calling the API without the required team scope.
- The extension no longer hardcodes `agentconfig.dev` or pretend a hidden setup flow exists; it now exposes manual configuration for base URL, personal API token, and team ID, and requests host permission for the chosen AgentConfig origin.
- Missing extension icon references were removed so the manifest no longer points at nonexistent files.

### Verification
- `bun run vitest run tests/integration/stabilization-routes.test.ts tests/services/governance.test.ts tests/lib/api-helpers.test.ts` ✅ 22/22 passing
- Targeted `eslint` across the touched routes/pages/extension/tests ✅
- Filtered `tsc --noEmit` check for the touched files returned no matches, meaning this slice did not introduce new TypeScript errors in its own surface area.

### What This Means
- The highest-risk remaining launch blockers are shrinking, and the OSS/self-hosted story is now more honest: a user can configure the extension against a local or hosted AgentConfig instance with a personal token instead of relying on an undocumented production-only path.
- Next stabilization targets should be: token/org admin semantics for service-account style tokens, remaining legacy `/dashboard/skills` naming drift, search multi-team truthfulness, extension docs/README setup, and the remaining red global `tsc` debt.

## 2026-04-05: Stabilization Wave 1 — SSO Contract + Authz Hardening

### What Was Fixed
- Reconciled the SSO settings page with the real org SSO API contract.
- `GET /api/orgs/:orgId/sso` now returns an editable config shape the dashboard can render directly.
- `PUT /api/orgs/:orgId/sso` now accepts the dashboard payload shape for both SAML and OIDC, preserves existing OIDC secrets when the field is left blank, and enforces org-level RBAC.
- Asset detail routes now enforce `skill:read`, `skill:update`, `skill:publish`, and `skill:delete` instead of treating plain team membership as sufficient.
- Asset content updates now flow through `updateAsset()` so version history is actually created on real edits.
- Version history read and rollback routes now require auth + team permissions.
- Approval list/create/review routes now validate team membership and publishing authority instead of trusting arbitrary authenticated users.

### Verification
- `bun run vitest run tests/integration/stabilization-routes.test.ts tests/services/governance.test.ts tests/integration/e2e-versioning.test.ts` ✅ 36/36 passing
- Targeted `eslint` across the touched routes/page/services ✅
- `tsc --noEmit` still fails overall, but the new SSO page/type errors introduced during this slice were fixed; remaining failures are pre-existing test/type drift outside this work.

### What This Means
- The product is still not launch-ready, but the first high-risk stabilization wave is now real code, real tests, and real context, not just audit notes.
- Next stabilization targets should be: team member management privilege escalation, token revocation ownership, create-asset contract repair, and extension bootstrap honesty.

## 2026-04-05: Product Strategy Research Sprint — Agent Control Plane Thesis

### Research Inputs
- Ran a live web research pass plus 3 parallel sub-agent tracks focused on: (1) market/product gap, (2) MongoDB + agent memory gap, and (3) enterprise adoption/trust blockers.
- Attempted to query CandleKeep for supporting material, but the `ck` CLI is not installed in this workspace, so no library enrichment was available from this environment.

### Converging Thesis
- The strongest differentiated direction is **not** to become another agent runtime, gateway, prompt playground, or generic observability product.
- The clearest gap is an **agent control plane** layered on top of MongoDB: versioned agent assets, MCP/tool registry, release approvals, eval gates, rollback, audit, policy enforcement, and memory promotion rules.
- MongoDB increasingly covers the substrate layer well (durable document storage, search/vector retrieval, automated embedding), but it still does not provide the product semantics teams need to run agents safely: execution checkpoints, replay, governed memory, promotion criteria, or human approval workflows.

### Product Implications
- Lean into the repo’s existing strengths: org/team scoping, assets, approvals, audit logs, version history, marketplace/export thinking.
- Reposition the product around **“GitHub for AI agent assets and releases”** rather than “MongoDB for prompts” or “yet another runtime.”
- The most promising “missing piece MongoDB doesn’t have” is: **org-scoped memory + replay + approvals**.
- Clarification: the codebase already has a real **asset registry foundation** (polymorphic `assets` collection, import/export, marketplace, versioning, approvals, audit, org/team hierarchy). The gap is that some important concepts are not yet first-class or trustworthy enough: prompts, tools, policies, and templates are only partial; release gating/evals/replay/governed memory are not first-class yet; and several existing surfaces still have authz and UI/API contract drift.

### Guardrails
- Do not build a generic agent runtime.
- Do not build a generic AI gateway/router.
- Do not build a standalone prompt playground/evals suite as the main product.
- Do not become “another vector DB” or generic memory vendor with no operational layer.

### What’s Next
- If we pursue this direction, define a V4 around 3 pillars:
  1. Agent Asset Registry
  2. Release Gates + Replayable Evals
  3. Governed Agent Memory
- Before any roadmap execution, fix the current P0 authz/security issues from the skeptical audit so the control-plane story is credible.

### Capability Map Snapshot
- **Already built and real**: polymorphic asset registry, asset CRUD, import parser registry, export engine, public marketplace endpoints, org/dept/team hierarchy, onboarding seeding, version history foundation, approval workflow foundation, audit/webhook/trust-score/compliance foundations, short-term copilot conversation memory.
- **Built but broken / not trustworthy enough**: RBAC enforcement across routes, approvals API membership checks, version-history access control, SSO UI/API contract, create-asset flow wiring, multi-team search semantics, extension packaging/auth flow, launch validation discipline (lint/typecheck/build credibility).
- **Partial**: prompts/tools/policies/templates as first-class concepts, release gating semantics, org governance UX, metrics consistency, policy-aware asset promotion, curated trust semantics around MCP/tool usage.
- **Not built yet**: replayable eval workspace, governed long-term agent memory, first-class policy engine, first-class prompt asset type, first-class tool registry, environment/channel-based release promotion.

### OSS Release Direction
- Product direction is now explicitly **open-source-first**: prioritize self-hosted correctness, deterministic setup, and docs that match reality before any SaaS-style expansion.
- Environment support should be documented in tiers:
  - **Tier A**: Atlas cloud for full feature parity
  - **Tier B**: local Atlas deployment / atlas-local for serious local dev
  - **Tier C**: plain Mongo fallback only for limited/degraded flows
- The current `docker compose` + plain Mongo story is not honest enough to be the default if the README claims full semantic search and Atlas-style capabilities.
- Roadmap should therefore begin with stabilization + OSS DX, not with new surface-area expansion.
- Planning artifacts created:
  - `docs/plans/2026-04-05-oss-release-design.md`
  - `docs/plans/2026-04-05-oss-release-implementation.md`

## 2026-04-05: Skeptical Launch Audit — NOT SHIP-READY

### Validation
- `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run lint` ❌ 17 errors, 61 warnings
- `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npx tsc --noEmit` ❌ failing component tests + type contract drift
- `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH bun run vitest run` ✅ 508 passed, 2 skipped
- `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH bun run build` ⚠️ exits 0 but logs repeated `MONGODB_URI` errors during page data collection
- `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH node scripts/wiring-audit.mjs` ✅ static wiring only

### Key Findings
- RBAC/authz blockers: team membership API allows any member to add/remove/change roles, asset mutation routes allow any team member to edit/delete, approval routes allow arbitrary authenticated users to create/review requests, and several org-scoped endpoints only verify org existence instead of org membership.
- UI/API contract drift: create-asset UI omits required `teamId`, SSO UI calls the wrong HTTP method and uses the wrong payload/response shape, and legacy `/dashboard/skills` naming remains throughout the UI despite the asset model migration.
- Release credibility gap: Vitest is green, but lint/typecheck are red and the build emits runtime DB/env errors while still returning exit code 0.
- Extension is not launch-ready: manifest references missing icons, background script hardcodes `agentconfig.dev`, and there is no visible in-extension flow that provisions the stored auth token/team selection it depends on.

### What’s Next
- Fix authz/security blockers first: team member management, asset mutations, approvals, org-scoped reads, token revocation, version-history access.
- Repair broken UI/API contracts: create asset, SSO settings, dashboard/mobile navigation drift, extension packaging/auth flow.
- Re-run lint, typecheck, build, and browser-level smoke checks before calling the product launch-ready again.

## 2026-04-04: Live Grove Pi Copilot Validation COMPLETE

### What Was Built
- Added custom OpenAI-compatible copilot gateway support in `src/services/copilot/pi-agent.ts`
- Added endpoint normalization so a full Grove `/chat/completions` URL can be provided via `COPILOT_BASE_URL`
- Added support for `COPILOT_API_KEY` plus optional `COPILOT_API_KEY_HEADER` for non-Bearer gateways
- Added live-route parity in `src/app/api/copilot/chat/route.ts` so the streaming Pi path now persists conversations, parses action blocks, and returns proactive suggestions + conversation metadata
- Externalized `@mariozechner/pi-ai` and `@mariozechner/pi-agent-core` in `next.config.ts` so standalone production builds load Pi packages from `node_modules` instead of bundling their dynamic provider loader into the server chunk
- Documented the new env vars in `.env.example`
- Added `tests/services/copilot-agent-config.test.ts` for custom gateway model wiring
- Added `tests/integration/copilot-pi-live.test.ts` for a real no-mock Grove + Mongo-backed Pi tool-calling run
- Added `tests/integration/copilot-chat-route.test.ts` for SSE route persistence/parity coverage
- Added `tests/integration/copilot-chat-route-live.test.ts` for a real Grove-backed `/api/copilot/chat` route validation

### Validation
- `bun run vitest run tests/services/copilot-agent-config.test.ts tests/integration/copilot-pi.test.ts tests/integration/copilot-pi-live.test.ts --reporter=verbose` ✅
- Real Grove validation passed with `gpt-5.4-mini` and a live `search_assets` tool call against MongoDB ✅
- `bun run vitest run tests/integration/copilot-chat-route.test.ts tests/integration/e2e-copilot-memory.test.ts --reporter=verbose` ✅
- Real Grove route validation passed for `/api/copilot/chat` SSE + persistence ✅
- `bun run vitest run tests/services/copilot-agent-config.test.ts tests/integration/copilot-pi.test.ts tests/integration/copilot-chat-route.test.ts --reporter=verbose` ✅
- `bun run build` exits 0 ✅
- Standalone server booted cleanly with real MongoDB + Voyage + Grove envs and `GET /` returned HTTP 200 without the prior Pi dynamic-module startup errors ✅

### What Was Learned
- Grove accepts the Pi copilot through an OpenAI-compatible path when the base URL is normalized to `/openai/v1`
- This GPT-5.4-mini Grove route requires `max_completion_tokens` compatibility rather than `max_tokens`
- Live model + live tool execution is now verified; full browser/auth/session/copilot-memory realism still requires separate end-to-end coverage if requested
- The `/api/copilot/chat` streaming branch currently streams text/tool events but does not yet persist conversations or parse action blocks on the live LLM path
- That live-route gap is now closed
- There is no dedicated copilot UI page/component in the repo today, so route-level SSE validation is currently the highest realistic end-to-end surface available
- Next.js/Turbopack bundling of Pi AI can turn its internal dynamic provider loading into startup-time `Cannot find module as expression is too dynamic` failures; `serverExternalPackages` is the correct production fix for standalone builds

## 2026-04-04: Full Admin Build COMPLETE (A1-A10)

### What Was Built
- **A1 Onboarding**: 3-step wizard (org → dept → team), POST /api/orgs creates full hierarchy, dashboard layout redirect, JWT session enrichment with org/team context, useActiveOrg() hook
- **A2 Dashboard**: Real stats from MongoDB (asset count, member count, team count, pending approvals), activity feed from audit_logs, actor name resolution
- **A3 Assets CRUD**: Create page (7 types), asset list with type filter tabs + trust score badges + pagination, DELETE endpoint with audit, export audit logging, serializeAsset now includes trustScore
- **A4 Teams**: Team detail page (/dashboard/teams/[slug]), member management API (GET/POST/PATCH), invite by email, role change, remove member, all with audit logging
- **A5 Org Admin**: Settings hub page, Organization settings (org info + departments), API Token management (create/view/revoke), Webhook management (create/delete), Audit Log viewer (paginated + SIEM export)
- **A6 Approvals**: Approval queue page (/dashboard/approvals), status filter, inline review (approve/reject + comment), enriched API response with asset/requester names
- **A7 SSO**: SSO config page (SAML/OIDC toggle), entity ID, SSO URL, issuer, client ID, enforce + JIT toggles, save to DB
- **A8 Marketplace**: Browse page with search + type filter, grid of published assets with trust scores, marketplace browse API
- **A9 Navigation**: Sidebar updated (Assets, Approvals, Marketplace added), breadcrumb back-nav on all detail pages, settings sub-navigation hub
- **A10 Tests**: Integration tests for onboarding, asset lifecycle, team management, admin settings, dashboard stats accuracy

### Bug Fixes Along The Way
- `createOrg` now accepts settings input (was hardcoded to engineering_fe)
- `listUserOrgs` now queries by orgMemberships (was only owner)
- Teams API counts from `assets` collection (was querying `skills`)
- `serializeAsset` now includes `trustScore` field
- Export route now has audit logging

### Files Created/Modified
New pages: 13 | New API routes: 5 | Modified services: 2 | Modified routes: 4 | Integration tests: 2
- **Phase**: V2 Phase 15 — ✅ COMPLETE (FINAL)
- **Task**: All 7 subtasks (15.1–15.7) done
- **Status**: 305/305 tests passing. Next.js build succeeds. Edge middleware (security headers + rate limiting), TtlCache, UI components (ErrorBoundary, 6 skeletons, EmptyState), landing page, docs site, Chrome Extension MV3, public API v1, webhook service, API tokens.
- **Next**: LAUNCH — All 15 phases complete. Ready for deployment.
- **Last Updated**: 2026-04-04T00:25

## V2 Pivot (ADR-009)
- **From**: Skills manager → **To**: Universal AI Agent Configuration Platform
- **Strategy**: EXPAND, DON'T REWRITE
- **Vision**: "GitHub for AI Agent Configs" — multi-asset, multi-tool, multi-department, enterprise
- **Plan**: `v2-research-plan/V2-MASTER-PLAN.md` (Harmonized)

## V1 Foundation (Phases 0-5) — ✅ ALL COMPLETE
| Phase | Status | Summary |
|-------|--------|---------|
| 0 | ✅ | Next.js 16.2.2, MongoDB 7.1.1, Voyage AI, config |
| 1 | ✅ | 4 types, 3 validators, 11 indexes, setup-db |
| 2 | ✅ | Atlas Search + Vector Search, hybrid w/ $rankFusion |
| 3 | ✅ | Auth.js v5 + GitHub OAuth, RBAC (4 roles, 11 perms) |
| 4 | ✅ | Dashboard UI (sidebar, cards, search, teams), 16 routes |
| 5 | ✅ | Marketplace JSON + GitHub import |
| 6 | ❌ | CANCELLED → Phase 15.5 (Chrome ext needs full asset model) |
| 7 | ❌ | CANCELLED → Phase 15 (superset with docs, API, launch) |

## V2 Phases (8-15) — ✅ ALL COMPLETE
| Phase | Name | Tasks | Status |
|-------|------|-------|--------|
| 8 | Asset Model + UI Migration | 7 | ✅ |
| 9 | Import Engine + Basic Scanning | 5 | ✅ |
| 10 | Marketplace + Export Engine | 6 | ✅ |
| 11 | Org/Dept/Team Hierarchy | 5 | ✅ |
| 12 | Security & Trust Layer | 4 | ✅ |
| 13 | Enterprise Governance | 5 | ✅ |
| 14 | Built-in Copilot | 4 | ✅ |
| 15 | Polish, Chrome Ext & Launch | 7 | ✅ |

## Harmony Fixes Applied
1. V1 phases 4-5 marked COMPLETE (were incorrectly NOT_STARTED)
2. V1 phase 6 (Chrome ext) CANCELLED → P15.5 (needs all asset types first)
3. V1 phase 7 (Polish) CANCELLED → P15 (superset)
4. P8 gained UI migration (8.6) + audit foundation (8.7)
5. P9 gained basic security scanning on import (9.4)
6. P10 gained export engine (10.5-10.6) — was completely missing
7. P11 gained marketplace scoping by org/dept (11.5)
8. Security (P12) moved BEFORE governance (P13) — trust before SSO
9. Cross-cutting concerns documented (audit, scanning, UI built incrementally)

## V3 Phases (16-21) — ALL COMPLETE ✅
| Phase | Name | Status |
|-------|------|--------|
| 16 | Interactive Onboarding Wizard | ✅ COMPLETE |
| 17 | Asset Version History + Diff Viewer | ✅ COMPLETE |
| 18 | Team Activity Feed | ✅ COMPLETE |
| 19 | Agent Goals & Adoption Metrics | ✅ COMPLETE |
| 20 | Structured Copilot + Chained Actions | ✅ COMPLETE |
| 21 | Live Asset Preview + Rich Rendering | ✅ COMPLETE |

## What's Next
**V3 Roadmap COMPLETE** — All 21 phases done. Real Grove Pi validation and live-route parity are now in place. If a browser-driven copilot E2E is desired next, the repo first needs a dedicated copilot UI surface to drive.

## Blockers
None.

## Cabinet Analysis (2026-04-04)
- Cloned to `/Users/rom.iluz/Dev/cabinet/` for reference
- See `context/V3-CABINET-ROADMAP.md` for full analysis + inspiration items

## Latest Research (2026-04-03)
**MongoDB Automated Embedding (ADR-010)**:
- Public Preview since Jan 15, 2026 (Community Edition 8.2+). Atlas M10+ coming to GA ~April 2026.
- Index type `autoEmbed` replaces manual embedding pipeline in production.
- Manual Voyage pipeline kept as M0/local fallback.
- Impact: Simplifies Phase 8 (search), Phase 9 (import), Phase 15 (model upgrades).

**CandleKeep Cloud Deep Investigation (ADR-011)**:
- Hands-on analysis of CandleKeep v1.10.0 (installed, ran queries, read plugin source).
- "Kindle for AI agents" — complementary, not competitive (books vs configs).
- Their agentic search (TOC → pages, no embeddings) is brilliant for books, terrible for configs.
- 5 innovations adopted: ambient activation (P14), CLI (P15), multi-tool +2 (Roo, Gemini), background enrichment (P8), usage tracking (P13).
- Multi-tool expanded from 5 → 7 tools.

## Key Numbers
- **V1 Phases**: 0-5 ✅ COMPLETE (46 tasks, 109 tests)
- **V1 Phases**: 6-7 ❌ CANCELLED (absorbed into V2)
- **V2 Phases**: 8-15 ✅ ALL COMPLETE (43 tasks, 196 tests)
- **V3 Phases**: 16-21 ✅ ALL COMPLETE
- **Total Tests**: ~500+ passing (42+ test files), 0 mocks, build clean
- **Skill Guidelines**: 15 installed
- **Embedding Model**: voyage-3-lite (512d) → autoEmbed primary (ADR-010), manual fallback
- **Framework**: Next.js 15 App Router
- **API Routes**: 20+ endpoints
- **Asset Types**: 7 (skill, rule, agent, plugin, mcp_config, hook, settings_bundle)
- **Export Formats**: 5 (Claude Code, Cursor, Copilot, Windsurf, Codex)
