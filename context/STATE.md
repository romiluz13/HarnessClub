# AgentConfig (formerly SkillsHub) — Project State

## Current State

## 2026-04-06: Technology Leverage Research — External Registries, APIs, and Authoring Stack

### What Was Checked
- Re-read the local MCP setup guidance (`mongodb-mcp-setup`) and verified the live Codex MCP config after the PATH hardening:
  - `codex mcp get MongoDB`
  - `codex mcp get octocode`
- Ran live research against:
  - official MCP Registry docs
  - OpenAI Responses API docs
  - Skills docs / CLI docs
  - direct `skills.sh` endpoint probing
  - GitHub ecosystem repos around skills and content tooling
- Directly probed `https://skills.sh/api/search?q=...` and confirmed it is a real JSON search surface with keys:
  - `query`
  - `searchType`
  - `skills`
  - `count`
  - `duration_ms`
- Verified `skills.sh/api/search` currently returns `200` with `content-type: application/json`.

### Key Verified Findings
- **MongoDB MCP local config**
  - machine-side launch config is now correct for this Codex environment because both `MongoDB` and `octocode` use absolute Homebrew `npx` plus explicit PATH
  - for Atlas users, the MongoDB MCP skill still recommends:
    - service-account credentials for Atlas Admin/API workflows
    - Atlas Local for local development
    - plain connection-string auth as the quick single-cluster path
  - this means the current read-only connection-string setup is acceptable for inspection work, but it is not the strongest long-term setup for Atlas-admin workflows
- **Official MCP Registry**
  - the registry is in preview
  - it provides a REST API for clients/aggregators
  - it is intended primarily for downstream aggregators/marketplaces
  - it is **not** intended to be consumed directly by MCP host apps
  - the official codebase is **not** intended for self-hosting
- **Skills ecosystem**
  - `skills.sh` has a live discovery/search API at `/api/search`
  - Skills docs explicitly describe the `skills` CLI as open source and telemetry-backed for leaderboard ranking
  - Skills docs also explicitly say users should review skills themselves and not assume every listed skill is fully safe/curated
- **OpenAI platform**
  - Responses API now positions itself as the unified agentic surface with built-in tools and remote MCP support
  - this is the strongest short-term runtime/test surface for “preview this harness,” “try this configuration,” and later release/eval gates

### Most Valuable External Levers
1. **OpenAI Responses API + remote MCP support**
   - best path for live harness preview/testing
2. **Official MCP Registry REST API**
   - best path for MCP discovery and metadata enrichment
3. **GitHub App + template-repo flows**
   - best path for import/sync/bootstrap and “generate starter repo from harness”
4. **skills.sh discovery API**
   - best path for skill discovery/enrichment, but should be treated as semi-stable and server-side only until the API contract is better documented
5. **Authoring/rendering stack**
   - `markdown-it`, `unified`, `Shiki`, `Tiptap`, and Mermaid-style tooling are strong candidates for making harness docs/configs/previews feel alive instead of database-like

### Product Conclusion
- The repo’s current problem is **not** lack of storage or metadata.
- The missing leverage is:
  - better discovery
  - better setup/connect UX
  - better live preview/test UX
  - better authoring/preview surfaces for harnesses, policies, prompts, and install docs
- AgentConfig should not become:
  - just another registry
  - just another markdown knowledge base
  - just another MCP/package manager
- AgentConfig should become the **curated downstream control plane + workbench** that:
  - ingests metadata from upstream ecosystems
  - adds trust/approval/org semantics
  - helps teams test, shape, publish, and install real harnesses

### Important Constraint
- The machine-side Octocode fix is real, but the live desktop session still needs a full reload/restart before Octocode can be treated as a dependable in-session MCP research tool.

## 2026-04-06: Octocode MCP Local Debug

### What Was Checked
- Verified `octocode` existed in `~/.codex/config.toml`.
- Confirmed Codex shell environment in this session did **not** include `node`, `npm`, or `npx` on `PATH`.
- Verified `octocode-mcp` itself is healthy when launched with a Node-capable PATH and Homebrew binaries:
  - manual stdio launch succeeded
  - real MCP `initialize` handshake succeeded
  - server returned capabilities and instructions as `octocode-mcp_13.0.1`
- Verified GitHub auth is already present on the machine via `gh auth status`.

### Root Cause
- `octocode` was configured as:
  - `command = "npx"`
  - `args = ["octocode-mcp"]`
- But the Codex shell/app environment available in this session did not expose Homebrew Node binaries on `PATH`.
- Because Homebrew `npx` uses `#!/usr/bin/env node`, both `command` resolution and `PATH` matter.

### Fix Applied
- Backed up the user config:
  - `~/.codex/config.toml.bak-20260406-octocode`
- Updated `~/.codex/config.toml` so `octocode` now uses:
  - `command = "/opt/homebrew/bin/npx"`
  - `args = ["--yes", "octocode-mcp@latest"]`
  - `env.PATH = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"`

### What This Means
- The local machine-side launch/config issue is fixed.
- A Codex app restart or MCP reload is still needed for the desktop app to pick up the new config in practice.
- This assistant runtime still cannot call `octocode` directly as a tool, but that is a runtime/tooling exposure limitation, not proof that the local MCP server is broken.

## 2026-04-06: API Leverage Research — Octocode Status + Useful External APIs

### What Was Checked
- Verified local Codex MCP configuration in `~/.codex/config.toml`.
- Confirmed `octocode` is configured locally:
  - `command = "npx"`
  - `args = ["octocode-mcp"]`
- Confirmed via `codex mcp list` that `octocode` is enabled locally, but **this assistant runtime cannot call it directly** because MCP auth/support is marked unsupported in the current tool session.
- Ran live official-doc web research on:
  - OpenAI MCP / Responses / evals / webhooks / developer mode
  - MCP Registry official docs
  - GitHub App install auth + template repository APIs
  - Slack Events API + incoming webhooks
  - Microsoft Graph change notifications

### Ranked High-Leverage API Opportunities
1. **OpenAI Responses API + remote MCP support**
   - strongest path for harness preview/test and future control-plane integrations
2. **OpenAI Agent evals + trace grading + webhooks**
   - strongest path for release-quality validation and async run/result ingestion
3. **MCP Registry API**
   - strongest path for MCP discovery, compatibility metadata, and marketplace enrichment
4. **GitHub App APIs**
   - strongest path for import/sync/install bootstrap from GitHub repos and orgs
5. **GitHub template repository API**
   - strongest path for “generate starter repo from approved harness” UX
6. **Slack Events API + incoming webhooks**
   - strong path for approvals, alerts, and activity sinks
7. **Microsoft Graph change notifications**
   - strong enterprise path for event-driven sync instead of polling

### Key Product Conclusion
- The most useful technology to leverage is the tech that makes AgentConfig feel like:
  - a **setup/connectable harness control plane**
  - a **testable/releasable system**
  - a **real integration hub**
- The least useful direction is random breadth. The product should prefer:
  - MCP + GitHub + OpenAI first
  - messaging/enterprise event APIs second
  - everything else later

### Important Constraint
- `octocode` should be treated as a potentially useful local research tool for future repo/code intelligence work, but it is **not currently available as a callable MCP in this assistant session**, so product decisions should not assume it is part of the shipped runtime today.

## 2026-04-06: Product Reframe Roadmap Written

### What Was Done
- Converted the Cabinet/Tank comparison into concrete AgentConfig roadmap docs:
  - `docs/plans/2026-04-06-agentconfig-product-reframe-design.md`
  - `docs/plans/2026-04-06-agentconfig-product-reframe-plan.md`
- Locked the key product direction:
  - steal Cabinet’s onboarding + workbench feeling
  - steal Tank’s setup/install/trust clarity
  - keep AgentConfig’s identity as a harness control plane

### Core Outcome
- The repo now has a written answer to:
  - what to steal now
  - what to steal later
  - what not to steal
  - what the first hero workflow should be
- The first recommended implementation target is now explicit:
  - **guided setup -> harness recommendation -> harness creation -> harness workbench -> export/install/test**

### What This Means
- Product work can now stop drifting between “admin polish” and “invent a giant new platform.”
- The next serious implementation slice should be the reframe:
  - workbench-first dashboard
  - guided harness creation
  - real setup/connect UX
  - library/assets demoted to supporting role

## 2026-04-06: External Product Reference Pass — Cabinet + Tank

### What Was Done
- Pulled the latest `main` from two nearby reference repos:
  - `/Users/rom.iluz/Dev/cabinet`
  - `/Users/rom.iluz/Dev/tank`
- `cabinet` had a force-pushed remote history, so the previous local `main` was preserved on:
  - `codex/cabinet-pre-sync-20260406-011422`
  then local `main` was reset to `origin/main` before review.
- Read the current product/readme/docs and key workflow files from both projects to understand what makes them feel more “alive” or more “installable” than AgentConfig currently does.

### Key Takeaways
- **Cabinet** solves the feeling problem:
  - 5-question onboarding wizard
  - visible AI team / mission control
  - live terminal and job runs
  - task inbox and workspace files per agent
  - “watch your team work” framing instead of “manage records”
- **Tank** solves the trust/install problem:
  - self-hosted setup wizard
  - explicit install commands and copyable DX
  - clean CLI/web/MCP story
  - security/trust as a first-class browse/install experience
  - product brief that sharply distinguishes shipped behavior from roadmap

### What This Means For AgentConfig
- The founder’s dissatisfaction is rational: AgentConfig currently exposes too much of the **registry/admin layer** and too little of the **magic/workflow layer**.
- The best external ideas are not “copy their whole products.”
- The right move is to borrow:
  - from Cabinet: onboarding, runtime visibility, harness/workspace feeling
  - from Tank: installability, setup wizard, explicit connection flow, truthful trust signals
- The wrong move would be to turn AgentConfig into:
  - a markdown knowledge base like Cabinet
  - or a package manager/security registry like Tank

### Recommended Direction
- Build a **guided harness setup + runtime workbench** as the main product flow.
- Add a **real self-hosted setup/connect wizard** so OSS users can get to value without reading backend docs.
- Keep the current asset/control-plane foundation, but stop presenting it as the whole product.

## 2026-04-06: Visual Product Read — Real App Is a Registry/Control Plane, Not Yet a Full Harness Workspace

### What Was Checked
- Re-opened the local manager QA session with `agent-browser` and reviewed the actual shipped UI surfaces:
  - dashboard
  - assets registry
  - asset detail
  - settings
  - public marketplace

### Brutal Product Read
- The app is **not** “nothing,” but it is also **not yet the ambitious product the founder is imagining when they think ‘enterprise agent harness hub’.**
- What exists today is a real **admin/control-plane product**:
  - registry of agent-related assets
  - basic team/org administration
  - settings and governance surfaces
  - public marketplace browse/install surface
- What is missing from the emotional/product experience is the **main event**:
  - no vivid “build a harness” workflow
  - no strong guided composition flow
  - no central runtime/execution workspace
  - no immediately obvious “why this matters” screen once you log in

### What This Means
- The repo is not a piece of junk. The foundation is real.
- But the founder’s disappointment is understandable because the current UI reads more like:
  - “asset registry + admin console”
  than:
  - “the place where enterprises design, assemble, and operationalize agent systems”
- The next product step should be about **product framing and workflow experience**, not only more backend correctness.

## 2026-04-06: Dual Local Test Personas Prepared Without OAuth

### What Was Done
- Extended the existing local QA tenant in `skillshub_qa` with a second user:
  - `QA Owner` → `org_owner` + team `owner`
  - `QA Employee` → org `member` + team `member`
- Minted two separate local Auth.js session-state files:
  - `/tmp/skillshub-manager-state.json`
  - `/tmp/skillshub-employee-state.json`
- Verified both personas successfully resolve through `/api/auth/session` and both receive `200` on `/dashboard`.

### What This Means
- Local manual QA no longer depends on GitHub OAuth setup.
- We now have a clean two-role test path for:
  - admin/manager verification
  - normal employee verification

## 2026-04-05: Local Manual QA Runtime Prepared With Seeded Authenticated Browser Session

### What Was Done
- Brought up a clean local MongoDB QA instance on `127.0.0.1:27019` and seeded a stable manual-QA tenant in `skillshub_qa`:
  - user: `QA Owner`
  - org: `AgentConfig QA Org`
  - team: `Revenue Harness Team`
  - assets: published skill, draft agent, published plugin
- Minted a real Auth.js session cookie locally using `@auth/core/jwt` and loaded it into a headed browser session for dashboard QA without changing product auth code or requiring live GitHub OAuth.
- Verified the following pages render correctly in a browser on the seeded runtime:
  - `/dashboard`
  - `/dashboard/assets`
  - `/dashboard/assets/660000000000000000000401`
  - `/dashboard/teams`
  - `/dashboard/settings`
  - `/dashboard/settings/organization`
  - `/dashboard/settings/sso`
  - `/marketplace`
- Verified supporting runtime/API truth for the same local QA setup:
  - `/api/health` → `status: ok`
  - `/api/auth/session` resolves the synthetic Auth.js session correctly
  - `/api/assets` returns the 3 seeded assets
  - `/api/teams` returns the seeded team
- Added a manual QA checklist at `docs/qa/2026-04-05-manual-qa-checklist.md`.

### New Finding
- `npm run start` is currently a bad local visual-QA/runtime entrypoint on this worktree. The standalone server serves app HTML but misses the built CSS chunk locally, causing an unstyled interface. `npx next start` serves the CSS correctly and was used for the actual manual browser QA pass.

### Verification
- `curl http://127.0.0.1:3020/api/health` ✅ `status: ok`
- Browser-verified seeded dashboard runtime via `agent-browser` ✅
- Search submit browser flow (`Revenue`) ✅ navigates to `/dashboard/assets?q=Revenue` with 2 matching results

### What This Means
- The repo now has a prepared local manual-QA target with realistic seeded data and an authenticated dashboard session, which materially reduces the risk of “I can’t even get in to test this.”
- The next release-confidence step should include fixing the standalone static-asset path so the documented production/local start command matches the visually correct app runtime.

## 2026-04-05: Fresh Real Grove + Voyage Live Validation Reconfirmed

### What Was Verified
- Re-ran the explicit live copilot lane using ephemeral shell env only, without writing Grove or Voyage credentials into the repo.
- Verified the dedicated live runner (`npm run test:live`) works end-to-end against the real Grove gateway and the app’s real copilot/search stack after the zero-skip lane split.
- Confirmed the current live lane still exercises both:
  - `tests/integration/copilot-pi-live.test.ts`
  - `tests/integration/copilot-chat-route-live.test.ts`

### Verification
- `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH COPILOT_LIVE_TEST=1 COPILOT_PROVIDER=grove COPILOT_MODEL=gpt-5.4 COPILOT_BASE_URL=<grove chat completions url> COPILOT_API_KEY=<ephemeral> COPILOT_API_KEY_HEADER=api-key VOYAGE_API_KEY=<ephemeral> npm run test:live` ✅ **2 passed, 0 failed**

### What This Means
- The live-provider contract is now verified again on the current worktree, not just historically.
- The repo now has both:
  - a deterministic default lane: `npm run test` → `540 passed, 0 skipped`
  - a real-provider lane: `npm run test:live` → Grove-backed copilot validation passes
- This materially strengthens release confidence for the copilot/search stack, but it still does **not** by itself prove “100% production ready” across OSS installability, docs truth, extension productization, operational rate limiting, or full UX/DX quality.

## 2026-04-05: Zero-Skip Default Test Lane + Canonical Assets Routes

### What Was Fixed
- Default `vitest` is now a truly deterministic lane with no hidden live-provider skips:
  - `vitest.config.ts` excludes `tests/**/*-live.test.ts`
  - `package.json` now exposes an explicit `npm run test:live`
  - `vitest.live.config.ts` provides a dedicated config for the live Grove/OpenAI-compatible suite
  - `tests/helpers/copilot-live-config.ts` fails fast with a clear env message when live tests are invoked without provider configuration
- The remaining user-facing `/dashboard/skills` drift was reduced materially:
  - added canonical asset detail page at `src/app/dashboard/assets/[id]/page.tsx`
  - legacy `src/app/dashboard/skills/page.tsx` and `src/app/dashboard/skills/[id]/page.tsx` now redirect to `/dashboard/assets`
  - search, mobile nav, asset cards, and detail navigation now point to `/dashboard/assets...`
- Fixed an additional truth hole discovered during the route cleanup: the global search submit path now actually works instead of only changing the URL.
  - `src/app/api/assets/route.ts` now accepts `?q=` and filters by `searchText`
  - `src/app/dashboard/assets/page.tsx` now reads `q` from the URL and shows filtered result counts

### Test Coverage Added / Updated
- Added `tests/app/dashboard-skills-redirects.test.tsx`
- Expanded:
  - `tests/components/search-bar.test.tsx`
  - `tests/components/skill-card.test.tsx`
  - `tests/components/skills-list.test.tsx`
- Live copilot tests now fail immediately at module load when env is missing instead of silently counting as skipped behind `describe.skip`

### Verification
- Focused route/UI suite ✅ `30/30` passing
- `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH env -u COPILOT_LIVE_TEST -u COPILOT_MODEL -u COPILOT_BASE_URL -u COPILOT_API_KEY npm run test:live` ✅ **fails fast with explicit missing-env message and 0 skipped tests**
- `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run lint` ✅
- `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npx tsc --noEmit` ✅
- `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test` ✅ **540 passed, 0 skipped**
- `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run build` ✅

### What This Means
- The default OSS/CI gate is now literally zero-skip, which matches the project’s “skip = fail” discipline.
- Live copilot validation is no longer hidden in the default suite; it is an explicit contract with a dedicated runner and honest failure mode.
- The dashboard’s canonical registry surface is now `assets`, while old `skills` URLs remain compatibility redirects instead of competing route surfaces.

## 2026-04-05: Trust-Floor Slice 2 Closed — Sign-In Honesty, Sidebar Hydration, Proxy Truth, Copilot Save Semantics

### What Was Fixed
- Fixed the sidebar hydration regression in `src/components/sidebar.tsx` by moving collapse persistence onto a `useSyncExternalStore`-based browser preference model instead of reading `localStorage` during render.
- Made the sign-in surface provider-aware:
  - `src/lib/auth.ts` now exposes configured provider metadata
  - `src/app/auth/signin/page.tsx` now renders setup guidance instead of a broken GitHub button when OAuth is not configured
  - `src/components/sign-in-form.tsx` is now driven by provider props instead of hardcoding GitHub assumptions
- Made proxy behavior more honest in `src/proxy.ts` by removing the misleading CORS/hardening framing and surfacing the throttling scope explicitly via `X-RateLimit-Scope: local-instance`.
- Fixed the scoped copilot conversation save semantics in `src/services/copilot/memory-service.ts`: when an out-of-scope or stale `conversationId` is provided, the service now creates a fresh scoped conversation instead of silently returning the old ID after a no-op update.

### Test Coverage Added
- `tests/components/sign-in-form.test.tsx`
- `tests/app/auth-signin-page.test.tsx`
- `tests/integration/proxy.test.ts`
- Expanded:
  - `tests/components/sidebar.test.tsx`
  - `tests/integration/copilot-chat-route.test.ts`
  - `tests/integration/e2e-copilot-memory.test.ts`

### Verification
- `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run lint` ✅
- `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npx tsc --noEmit` ✅
- Focused trust-floor suite ✅ `37/37` passing
- `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test` ✅ **536 passed, 2 skipped**
- `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run build` ✅

### What This Means
- The earlier second-pass review findings for sidebar hydration, provider-aware sign-in honesty, proxy truthfulness, and scoped conversation-save behavior are now materially addressed in code and tests.
- The biggest remaining honesty gap is still the default test lane reporting `2 skipped` when live Grove env vars are absent. The live path remains verified separately, but the default OSS/CI story is not yet a literal no-skip baseline.

## 2026-04-05: Lint Warning Debt Cleared — Zero-Warning Baseline Restored

### What Was Fixed
- Removed the remaining lint warning debt across routes, UI, services, and tests, bringing `eslint` back to a true zero-warning state instead of “green with known noise.”
- Tightened `GET /api/assets/:id/export` so it now enforces explicit `skill:read` permission, not just team membership.
- Tightened `GET /api/marketplace/:teamSlug` so invalid `?type=` values now return `400` with the supported asset types instead of silently pretending the filter is valid.
- Replaced the raw avatar `<img>` in `src/components/user-menu.tsx` with `next/image` and added the minimal GitHub avatar remote-image config in `next.config.ts`.
- Removed a couple of dead runtime queries during the cleanup, including unused metrics work in `metrics-service.ts` and an unused team lookup in proactive suggestions.

### Verification
- `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run lint` ✅ **0 errors, 0 warnings**
- `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npx tsc --noEmit` ✅
- `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test` ✅ **526 passed, 2 skipped**
- `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH bun run vitest run tests/integration/copilot-pi-live.test.ts tests/integration/copilot-chat-route-live.test.ts` with Grove env ✅ **2/2 passed**
- `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run build` ✅

### What This Means
- The repo now has a cleaner release baseline: zero lint noise, green typecheck, green default test suite, green live copilot verification, and green production build.
- The only remaining nuance in the gate story is explicit: the default `npm run test` lane still skips the two live Grove tests unless live copilot secrets are supplied. The live no-skip path is proven, but not yet the default developer/CI path.

## 2026-04-05: Full No-Skip Test Baseline Achieved With Live Grove Copilot

### What Was Added
- Extended the main platform end-to-end suite in `tests/integration/e2e-platform.test.ts` to cover the missing public distribution workflow:
  - approval-driven publication into marketplace visibility
  - public marketplace browse visibility with `releaseStatus`
  - successful install for a healthy published plugin bundle
  - explicit failure for a broken published plugin bundle
- This strengthens the repo’s primary “platform” E2E instead of fragmenting the coverage into only narrow regression files.

### Live Copilot Validation
- Used the provided Grove gateway configuration (`COPILOT_PROVIDER=grove`, `COPILOT_MODEL=gpt-5.4`, Azure API-key header auth) to run the previously skipped live copilot suites.
- Fixed a stale test-harness mock in `tests/integration/copilot-chat-route-live.test.ts` so the live route test matches the stricter team-authorization path now present in `/api/copilot/chat`.
- Verified both live suites pass:
  - `tests/integration/copilot-pi-live.test.ts` ✅
  - `tests/integration/copilot-chat-route-live.test.ts` ✅

### Verification
- `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH bun run vitest run tests/integration/e2e-platform.test.ts tests/integration/release-state-regressions.test.ts tests/integration/api-marketplace.test.ts` ✅ 58/58 passing
- `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npx tsc --noEmit` ✅
- `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test` with live Grove env enabled ✅ **528 passed, 0 skipped**

### What This Means
- The repo now has a real no-skip test baseline when live copilot configuration is available.
- The release-confidence story is materially stronger than before: the main platform E2E proves publish→marketplace→install, and the real model path is no longer hidden behind skipped suites.
- Remaining release concerns now narrow further toward:
  - warning cleanup
  - the remaining trust-floor/runtime honesty issues already logged in the roadmap
  - broader endpoint/workflow expansion if we want an even stricter release gate

## 2026-04-05: Release-State Recovery Complete — Lifecycle + Install Integrity Fixed

### What Was Fixed
- Kept the new release-state direction, but finished the broken lifecycle edges instead of reverting the whole branch.
- Approval outcomes now treat approved `update` requests as distributable again, so reviewed updates land back in `published` instead of getting stranded as `approved`.
- Approval request creation is now safer: the request is inserted before the asset is moved into `pending_review`, and the asset state update is version-guarded. If the request insert path fails, the asset is no longer left stranded in review state.
- Plugin install no longer silently omits unpublished or unexportable bundled assets. `/api/assets/:id/install` now fails loudly with bundle-integrity diagnostics instead of returning a broken partial payload with `200`.
- The assets validator now explicitly includes `releaseStatus` and `currentVersionNumber`, so the release-state model is represented in the schema layer instead of living only in TypeScript/service code.
- Stabilization route tests were refreshed to match the newer asset response shape and approval request version semantics.
- The capabilities seed helper now retries live Voyage embedding calls, which removed a flaky external timeout from the broad test gate without dropping the “real embedding” validation path.

### Verification
- `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npx tsc --noEmit` ✅
- `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run lint` ✅ 0 errors, 51 warnings
- `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run test` ✅ 522 passed, 2 skipped
- `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run build` ✅ clean production build
- Additional targeted regression verification:
  - `bun run vitest run tests/integration/release-state-regressions.test.ts tests/integration/e2e-platform.test.ts tests/integration/setup-db.test.ts` ✅
  - `bun run vitest run tests/integration/stabilization-routes.test.ts` ✅

### What This Means
- The interrupted release-state branch is now materially safer to keep. The core model is still worth building on, and the two most dangerous behavioral regressions from that branch are closed:
  - approved updates disappearing from distribution
  - plugin bundles pretending to install successfully while missing children
- The repo is back to a truthful green baseline after these changes, not just “green until you inspect the lifecycle.”
- Remaining work should now go back to the broader production-readiness roadmap instead of firefighting this branch.

## 2026-04-05: Uncommitted Release-State Worktree Review

### What Was Reviewed
- Inspected the new uncommitted worktree changes touching:
  - `src/types/asset.ts`
  - `src/services/asset-service.ts`
  - `src/services/approval-service.ts`
  - `src/app/api/assets/*.ts`
  - marketplace browse/install endpoints
  - `src/lib/api-helpers.ts`
- These changes introduce a real **release-state model** (`draft`, `pending_review`, `approved`, `published`, `archived`) and start connecting approvals, marketplace visibility, and installability to that model.

### What Improved
- Direct asset publishing through `PATCH /api/assets/:id` is now blocked and routed toward the approvals workflow.
- Marketplace and install routes now distinguish “published for distribution” more carefully instead of trusting `isPublished` alone.
- Asset creation is more centralized again by using `createAsset()` from the service layer instead of duplicating validation/audit/embed logic in the route.
- Approval requests are now version-aware and can be invalidated when the asset changes.

### New Risks Opened
- The new release-state workflow is only partially landed. The biggest correctness risk found is that approving an `update` request maps the asset to `approved`, not `published`, while published assets are demoted to draft/unpublished on edit. That likely leaves approved updates unavailable for marketplace/install flows.
- Plugin install now silently skips unpublished bundled assets instead of failing loudly, which can produce a partial/broken plugin payload while still returning `200`.
- Approval request creation now flips the asset into `pending_review` before the approval request insert/audit/webhook path is complete, so a later failure can strand the asset in review state without a matching request.

### Validation Limits
- This pass was static review only. The current Codex environment has no `node`, `npm`, or `bun` on PATH, so I could not rerun lint/typecheck/tests/build against the new worktree changes.
- No tests were changed alongside this new release-state work, which is a trust risk by itself given how much lifecycle behavior changed.

## 2026-04-05: Production Readiness Roadmap Locked

### What Was Decided
- The release plan is now organized around four ordered gates instead of treating “polish” as one big final bucket:
  1. **Trust floor** — security, authz, broken contracts, honest validation
  2. **OSS installability** — supported environment tiers, first-run setup, env doctor, docs truth
  3. **Platform completion** — close the highest-value conceptual gaps in the harness/configuration model
  4. **Differentiation** — governed memory, replay/evals, release gates, stronger policy semantics
- Added a concrete execution artifact: `docs/plans/2026-04-05-production-readiness-roadmap.md`
- A skeptical review of the latest stabilization commit found it was useful but not enough to claim “production ready”: the onboarding seeding fix and env-gated integration init were good, but runtime auth UX drift, proxy hardening over-claims, silent scoped conversation save failures, and a sidebar hydration risk still remain.

### What Still Seems Likely
- There are probably more issues still hiding in legacy `/dashboard/skills` drift, extension bootstrap/docs, and flows that only look healthy because CI is green. The repo is materially stronger now, but not yet at the point where green automation alone should be trusted as a launch signal.

### Next Execution Order
- Finish the remaining trust-floor bugs first:
  - scoped copilot conversation save no-op
  - provider-aware sign-in/install UX
  - proxy/rate-limit deployment truth
  - hydration-safe sidebar state
  - remaining authz / naming / route drift audit
- Then move directly into OSS installability:
  - Atlas cloud vs local Atlas vs plain Mongo support matrix
  - env doctor / first-run validation
  - truthful README + CONTRIBUTING + `.env.example`
  - deterministic seed/bootstrap path
- Reassess 1.0 scope only after those two gates are complete.

## 2026-04-05: Atlas Local Preview Reality Pass — Zero-Mock Validation

### What Was Verified
- Reset the local Atlas preview Docker stack to a fresh volume, then brought `mongodb/mongodb-atlas-local:preview` back up until the container reported `healthy`.
- Re-ran the real Atlas Search/Vector Search setup path through Vitest global setup against `mongodb://localhost:27018/?directConnection=true` using the repo’s `.env.test` config.
- Verified native Atlas-local search behavior, including real `assets_search` + `assets_vector` readiness, a live Voyage embedding for the persistent fixture, and native `$rankFusion` execution in the hybrid search suite.
- Ran zero-mock end-to-end onboarding and platform lifecycle suites against Atlas Local Preview, exercising real org/team/asset/approval/SSO/webhook/token/service flows with MongoDB persistence.
- Re-ran the full engineering gate matrix with Atlas Local Preview active: `tsc`, `eslint`, full `vitest`, and `next build`.

### Verification
- `docker compose -f docker-compose.atlas-local.yml up -d` ✅ after resetting the stack volume
- `npx vitest run tests/integration/search-hybrid.test.ts` ✅ 11/11 passing on Atlas Local Preview, including native `$rankFusion`
- `npx vitest run tests/integration/e2e-onboarding.test.ts tests/integration/e2e-platform.test.ts` ✅ 60/60 passing
- `npm run test` ✅ 519 passed, 2 skipped (the two skipped tests are the live copilot suites gated by missing `COPILOT_*` env vars in `.env.test`)
- `npx tsc --noEmit` ✅
- `npm run lint` ✅ 0 errors, 51 warnings remain
- `npm run build` ✅ clean production build while Atlas Local Preview was available

### What This Means
- The app now has a validated “serious local dev / OSS” lane, not just a plain Mongo fallback story: Atlas Local Preview successfully exercised real Search + Vector Search behavior with live fixture indexing and zero-mock E2E service coverage.
- The remaining blockers are not Atlas-local incompatibilities; they are product-hardening items already known from the broader production plan: release-state enforcement, distributed rate limiting, SSO secret encryption-at-rest, warning cleanup, and optional live copilot configuration for full external-model validation.
- Atlas Local Preview currently follows the repo’s manual-embedding path (`AutoEmbed index not available (M0/local mode — using manual embeddings)`), so local preview is validated for hybrid search realism but not yet for a true auto-embedding runtime path.

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
**Final release signoff remains a separate gate from “all roadmap phases complete.”** The backend/API/runtime trust floor is now strong and live-provider validation is real, but a true “ship it” signoff still needs browser-driven UI verification plus extension/fresh-install smoke on a clean machine.

## Blockers
- No known backend/API/build blocker remains on the current worktree.
- Remaining release-signoff gap: browser-level UI verification and extension/fresh-install validation are still not programmatically covered in this environment.

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
- **Deterministic Tests**: 544 passing across 52 files, 0 skipped
- **Live Provider Tests**: 2/2 Grove-backed copilot suites passing
- **Skill Guidelines**: 15 installed
- **Embedding Model**: voyage-3-lite (512d) → autoEmbed primary (ADR-010), manual fallback
- **Framework**: Next.js 16 App Router
- **API Routes**: 20+ endpoints
- **Asset Types**: 7 (skill, rule, agent, plugin, mcp_config, hook, settings_bundle)
- **Export Formats**: 5 (Claude Code, Cursor, Copilot, Windsurf, Codex)

## 2026-04-05: Final Release Gate — Runtime Contract Truth Pass

### What Was Fixed
- Added a real `/api/health` readiness route so Docker and deploy smoke checks validate app + MongoDB truthfully.
- Fixed bearer-token auth drift on the core asset and token routes by passing the current request into route auth helpers and making `requireAuth()` authorization-header-aware even when routes forget to pass the request explicitly.
- Corrected the public API discovery document so it advertises `GET /api/search?q=` instead of the nonexistent `/api/assets/search`.
- Rewrote the docs/install surfaces to match the real product contract: MongoDB mode choices, GitHub OAuth requirement for UI sign-in, truthful import payload examples, and standalone production start behavior.
- Switched `npm run start` to the standalone server entry so local production smoke matches the Docker/runtime artifact instead of emitting the Next.js standalone warning.
- Fixed the final standalone-auth issue by setting `trustHost: true` in Auth.js, which removed `UntrustedHost` errors during production-artifact smoke runs.

### Verification
- `npm run lint` ✅
- `npx tsc --noEmit` ✅
- `npm run test` ✅ `544 passed, 0 skipped`
- `npm run test:live` ✅ `2 passed`
- `npm run build` ✅
- Production-artifact smoke on `node .next/standalone/server.js` ✅
  - `/api/health` returned `200` with `mongo: ok`
  - `/api/v1` returned the corrected discovery contract
  - `/auth/signin` showed the expected “OAuth not configured” guidance when GitHub creds were intentionally absent
  - Bearer-token runtime checks against `/api/assets`, `/api/assets/:id`, `/api/v1/tokens`, and `/api/settings/tokens` all returned `200`

### What This Means
- The repo now has a truthful release candidate baseline for backend, API, auth, docs, and self-host runtime behavior.
- I still do **not** call this “100% production ready / state-of-the-art UI-UX-DX” yet, because browser-driven app verification and extension/fresh-install release drills are still missing from the final signoff.

## 2026-04-05: External Research — Microsoft APM (`microsoft/apm`)

### What Was Researched
- Cloned `https://github.com/microsoft/apm` locally to `/Users/rom.iluz/Dev/apm`.
- Reviewed the repo README, manifest/lockfile docs, enterprise/governance docs, runtime compatibility docs, and the Python CLI structure.
- Confirmed APM is an **agent package manager / installer / compiler** layer, not a hosted registry or enterprise control plane.

### What APM Actually Is
- APM centers on `apm.yml` + `apm.lock.yaml` as a dependency/lock model for agent primitives, prompts, hooks, MCP servers, and plugins.
- It resolves transitive dependencies from Git-based sources, installs them into tool-native file trees, supports marketplaces, and adds policy/audit/CI checks around that install flow.
- It also has experimental runtime-management features for Copilot/Codex/LLM CLIs and a policy layer (`apm-policy.yml`) on top of the lockfile/install model.

### Best Current Read
- **Complementary, not a replacement.**
- APM is strongest as a **downstream package/install/runtime layer** for repo-local agent setup.
- AgentConfig is strongest as the **upstream system of record / enterprise control plane**: asset registry, org/team governance, RBAC, approvals, version history, marketplace publishing, audit/search, and eventually governed memory/release semantics.

### Practical Product Implication
- The best path is likely: **export to APM, import from APM, maybe generate `apm.yml` / `apm.lock.yaml` / APM packages as one deployment target**.
- The wrong path would be: rewrite the product around APM or assume APM replaces the enterprise platform layer we are building. It does not.
