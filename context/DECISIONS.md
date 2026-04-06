# SkillsHub → AgentConfig — Architecture Decisions


### ADR-019: External registries are upstream discovery sources; AgentConfig remains the curated downstream control plane — 2026-04-06
**Context**: A fresh research pass across the official MCP Registry, Skills/skills.sh, OpenAI Responses docs, and adjacent authoring ecosystems clarified why the product still feels shallow. The missing value is not more raw storage; it is better discovery, better preview/testing, and better authoring/presentation. The official MCP Registry explicitly says it is intended primarily for downstream aggregators and not direct host-app consumption. Skills/skills.sh provides real discovery value and a live search API, but its own docs also say users should review skills themselves and not assume full curation/security. That means neither registry should become the product itself.
**Decision**:
1. Treat the official MCP Registry as an **upstream metadata source** for MCP discovery and enrichment.
2. Treat `skills.sh` as an **optional upstream discovery/enrichment source** for skills, preferably consumed server-side and not as a hard runtime dependency until the API contract is better documented.
3. Keep AgentConfig’s identity as the **curated downstream system of record** that adds:
   - org/team ownership
   - trust/review/approval semantics
   - bundling and harness composition
   - install/export flows
   - eventually preview/eval/release workflows
4. Invest in richer authoring/presentation surfaces so the curated control plane feels like a workbench, not a database browser.
**Alternatives Considered**: (1) copy public registries and become a mirror, (2) ignore ecosystem registries and force all discovery to happen inside AgentConfig, (3) pivot the product into a generic package manager / skill leaderboard.
**Consequences**: Discovery gets dramatically better without collapsing product differentiation. AgentConfig can ingest ecosystem metadata while keeping curation, governance, trust, and enterprise workflow as the real value layer.


### ADR-018: Borrow product feeling from Cabinet and installability/trust patterns from Tank, without changing AgentConfig into either product — 2026-04-06
**Context**: A fresh comparative pass against the latest local `cabinet` and `tank` repos explains why AgentConfig feels underwhelming despite having real backend depth. Cabinet creates strong emotional/product payoff with a guided onboarding flow, visible agent activity, runtime surfaces, task inboxes, and workspace visibility. Tank creates strong OSS confidence with an explicit setup wizard, copyable install commands, CLI/web/MCP parity, and sharper trust signals. AgentConfig currently has more of a registry/admin feel than a “build and run agent systems” feel.
**Decision**:
1. Keep AgentConfig’s identity as a multi-tenant agent configuration/control-plane product.
2. Borrow **Cabinet-like** product patterns only where they reinforce the core story:
   - guided onboarding
   - visible runtime/workbench surfaces
   - task/job/workspace visibility for harnesses and agents
3. Borrow **Tank-like** product patterns only where they improve OSS adoption and trust:
   - setup/connect wizard
   - copyable install/connect commands
   - explicit trust/install signals
   - clearer separation of shipped behavior vs roadmap claims
4. Do **not** pivot AgentConfig into:
   - a markdown-first knowledge base / startup OS
   - or a package-manager / skill-security registry
**Alternatives Considered**: (1) keep focusing purely on backend/platform correctness and hope the product “clicks” later, (2) copy Cabinet’s whole AI-team metaphor wholesale, (3) copy Tank’s package-manager/security-product framing wholesale.
**Consequences**: The next UX roadmap should prioritize a guided harness setup flow and a visible runtime workbench, while the OSS/DX roadmap should prioritize first-run setup, connection clarity, and truthful installability. This gives the product a better chance to feel alive without losing its real enterprise control-plane differentiation.


### ADR-017: `/dashboard/assets` is the canonical registry surface; `/dashboard/skills` is compatibility-only — 2026-04-05
**Context**: The product pivoted from a skills-only manager into a multi-asset registry, but the dashboard still exposed mixed route semantics: some surfaces used `/dashboard/assets`, others still linked to `/dashboard/skills`, and the global search submit path changed the URL without actually producing filtered results. That drift created product dishonesty even while the underlying asset model was already canonical.
**Decision**:
1. Treat `/dashboard/assets` and `/dashboard/assets/[id]` as the canonical dashboard routes for registry browsing and detail views.
2. Keep `/dashboard/skills` and `/dashboard/skills/[id]` only as backward-compatible redirects.
3. Make supporting navigation and search align with the canonical route surface:
   - mobile nav points to assets
   - search suggestions/details resolve to asset routes
   - listing/detail cards resolve to asset routes
   - `/api/assets?q=` powers search-submit filtering for the canonical listing page
**Alternatives Considered**: (1) keep both route families live indefinitely, (2) delete the legacy routes immediately and risk breaking bookmarked links, (3) leave the search submit path cosmetic until a future dedicated search page exists.
**Consequences**: User-facing navigation is more truthful and consistent, while old links still resolve safely. The remaining `/api/skills` compatibility routes can persist longer if needed, but they are no longer the dashboard’s primary story.


### ADR-016: Production readiness is gated by trust, installability, and product truth before differentiation — 2026-04-05
**Context**: The repo now has a real asset-registry foundation and recent stabilization work restored green build/test discipline, but skeptical review showed that green gates alone still permit hidden launch blockers: runtime auth UX drift, per-process proxy rate limiting, silent scoped conversation save failures, and lingering UI/route naming drift. The product also wants to ship OSS-first, which raises the bar for setup truth and first-run determinism.
**Decision**:
1. Define OSS 1.0 readiness with four ordered gates:
   - **Gate 1: Trust floor** — authz/security, contract alignment, truthful validation, no hidden runtime failures
   - **Gate 2: OSS installability** — supported environment tiers, setup docs, env doctor, seeds, deterministic first run
   - **Gate 3: Platform completion** — promote only the minimum missing first-class concepts needed for the harness/configuration story
   - **Gate 4: Differentiation** — governed memory, replay/evals, release gates, stronger policy semantics
2. Do not start differentiation work while Gate 1 or Gate 2 is still materially incomplete.
3. Treat “passes lint/typecheck/tests/build” as a baseline, not as a launch claim.
**Alternatives Considered**: (1) continue feature expansion while trusting green automation, (2) push hard on governed memory/control-plane features before the OSS install story is honest, (3) treat the repo as “ready enough” and defer the remaining inconsistencies to post-release cleanup.
**Consequences**: Roadmap sequencing becomes stricter and less flashy, but it aligns with the actual adoption risk: strangers will judge the project first on whether it installs, works, and behaves safely. Innovation work is still the strategic destination, but no longer allowed to mask launch-readiness debt.


### ADR-015: Open-source-first release with supported environment tiers — 2026-04-05
**Context**: Product direction is shifting toward an OSS-first release rather than immediate SaaS operations. The promise is: clone the repo, connect either a local Atlas-style deployment or Atlas cloud, and manage complete agent harnesses (skills, rules, hooks, MCP, bundles) reliably out of the box. Current repo/docs drift undermines that promise: `README.md` recommends `docker compose up` against plain `mongo:7`, while core search capabilities rely on Atlas Search / Vector Search / local Atlas features. Official docs also show that local Atlas deployments are now a real supported path through Atlas CLI, while MCP Registry is an official upstream metadata source for downstream marketplaces.
**Decision**:
1. Treat the product as **open-source-first** and optimize for self-hosted clarity, reproducibility, and trustworthiness before SaaS concerns.
2. Define explicit environment support tiers:
   - **Tier A (recommended)**: MongoDB Atlas cloud for full feature parity and easiest onboarding.
   - **Tier B (developer local)**: local Atlas deployment / `mongodb-atlas-local` for local Search + Vector Search workflows.
   - **Tier C (limited fallback)**: plain MongoDB only for degraded development paths; do not present it as full-featured parity.
3. Reframe the roadmap around four tracks:
   - **Stabilization**: authz, broken contracts, green validation, launch honesty
   - **Out-of-box OSS DX**: setup scripts, docs, seeds, env doctor, deterministic first-run
   - **Platform completion**: close gaps in first-class asset concepts and harness management
   - **Differentiation**: release gates, eval/replay, governed memory
4. Do not market or position preview/local capabilities as stronger than they are; document supported paths and tradeoffs explicitly.
**Alternatives Considered**: (1) Continue claiming generic Docker + Mongo local support for the whole platform, (2) postpone OSS quality and chase differentiated features first, (3) optimize for hosted SaaS assumptions before self-hosted install quality.
**Consequences**: The release plan now prioritizes correctness and installation truth over feature inflation. README/setup/docs/scripts need to be aligned with the actual dependency model. Search and local deployment strategy become a first-class part of release planning instead of an implementation detail.
**Key Sources**:
- Atlas local deployment + Search/Vector support: https://www.mongodb.com/docs/atlas/cli/current/atlas-cli-deploy-local/
- Automated Embedding preview docs: https://www.mongodb.com/docs/atlas/atlas-vector-search/crud-embeddings/create-embeddings-automatic/
- MCP Registry as upstream for downstream marketplaces: https://modelcontextprotocol.io/registry/about

### ADR-014: Externalize Pi SDKs from Next standalone bundle — 2026-04-04
**Context**: The copilot backend depends on `@mariozechner/pi-ai` and `@mariozechner/pi-agent-core`. Under Next.js 16 standalone/Turbopack builds, bundling Pi AI into the server chunk caused startup-time `Cannot find module as expression is too dynamic` errors and unhandled rejections even though the app compiled successfully.
**Decision**: Add both Pi packages to `serverExternalPackages` in `next.config.ts` so the standalone runtime loads them directly from `node_modules` via native Node resolution.
**Alternatives Considered**: (1) Ignore the warnings because routes still responded, (2) rewrite the copilot runtime to avoid the root SDK entrypoints, (3) patch upstream SDK internals locally.
**Consequences**: Production startup is clean again, the copilot runtime keeps its validated behavior, and the Next bundle avoids fragile rewrites of dynamic provider-loading code.


### ADR-013: Cabinet Analysis — V3 Inspiration — 2026-04-04
**Context**: Deep analysis of github.com/hilash/cabinet — a self-hosted AI startup OS with live agent orchestration, heartbeat loops, inter-agent Slack-like communication, onboarding wizard, and goal tracking. Cloned to /Users/rom.iluz/Dev/cabinet/.
**Decision**: Adopt 6 inspiration items as V3 Phases 16-21. Cabinet excels at agent EXECUTION; we excel at agent CONFIGURATION. Take their UX patterns (onboarding wizard, activity feed, metrics), NOT their execution model (heartbeats, node-pty, file-based storage).
**Key refs**: `onboarding-wizard.tsx`, `goal-manager.ts`, `heartbeat.ts`, `slack-manager.ts`, `task-inbox.ts`, `agents-workspace.tsx` (1546 lines).
**Full roadmap**: `context/V3-CABINET-ROADMAP.md`

### ADR-012: Naming Research — Keep "AgentConfig" — 2026-04-04
**Context**: Researched "HarnessHub" name across GitHub, Hacker News, Reddit, trademark databases. Found:
1. Harness.io ($3.7B) — already has "Harness Skills" and "Harness Agents" (direct overlap)
2. OpenHarness (1,899⭐) — owns "open agent harness" positioning
3. madebywild/agent-harness — owns the CLI "harness" space
**Decision**: DO NOT use "HarnessHub". Keep "AgentConfig" — unique, descriptive, SEO-friendly, no trademark collisions.
**Alternatives considered**: ConfigForge, AgentVault, HarnessKit, AgentRegistry.
**Status**: Name decision DEFERRED — user wants to decide later.

### ADR-011: CandleKeep Competitive Analysis — Innovations to Adopt — 2026-04-03
**Context**: Deep hands-on investigation of CandleKeep Cloud (v1.10.0) — a "Kindle for AI agents" that manages PDF/EPUB/Markdown document libraries for AI agents. Installed, ran queries, read their plugin source code (3 subagents: item-reader, book-enricher, book-writer), examined their multi-tool support (7 tools), marketplace (curated books), and "agentic search" (TOC-based navigation, NO embeddings/RAG).
**Decision**: CandleKeep and AgentConfig are **complementary, not competitive** (books vs configs). Adopt 5 innovations:
1. **Ambient Activation** (Phase 14): Agent proactively surfaces relevant configs during substantive tasks without being asked
2. **CLI for Agents** (Phase 15): `ac` CLI so agents can query our registry directly (`ac search`, `ac install`, `ac export`)
3. **Multi-Tool Expansion**: Add Roo Code + Gemini CLI support (7 tools total, up from 5)
4. **Background Enrichment** (Phase 8): Auto-improve asset metadata (tags, descriptions, searchText) on import
5. **Session/Usage Tracking** (Phase 13): Track which configs agents actually load — feeds marketplace popularity + dept analytics
**What we do NOT copy**: TOC-based search (terrible for short configs), no-enterprise model, curated-only marketplace, cloud-only storage.
**Consequences**: Phase 14 gains ambient activation pattern. Phase 15 gains CLI. Phase 10 marketplace adds Roo/Gemini formats. Phase 8 import enrichment added. Phase 13 gains usage analytics.

### ADR-010: MongoDB Automated Embedding with Manual Fallback — 2026-04-03
**Context**: MongoDB announced Automated Embedding (Public Preview Jan 15, 2026). Creates a `autoEmbed` type in vector search indexes that automatically generates Voyage AI embeddings at index-time (on insert/update) and query-time (for search queries). Available in Community Edition 8.2+ now, Atlas M10+ coming to GA ~April 2026. We currently use an explicit client-side Voyage AI pipeline (ADR-005).
**Decision**: Adopt MongoDB Automated Embedding as primary strategy with manual Voyage pipeline as fallback.
- **Production (Atlas M10+)**: Use `autoEmbed` index type. No client-side embedding code. MongoDB handles all embedding generation natively. Store raw text in a dedicated `searchText` field, let MongoDB embed it automatically.
- **Development/M0 fallback**: Keep existing `src/lib/voyage.ts` + `src/services/embedding-pipeline.ts` for M0 free tier and local dev without atlas-local. Runtime detection: attempt autoEmbed query first, fall back to manual if unavailable.
- **Model**: Use `voyage-3-lite` initially (matches current), upgrade to `voyage-4` or `voyage-4-lite` when GA.
**Key Technical Details**:
- Index definition: `{ type: "autoEmbed", path: "searchText", model: "voyage-3-lite" }` inside a `vectorSearch` type index
- Query syntax changes: `$vectorSearch` takes `query: "text string"` instead of `queryVector: [numbers]`
- No VOYAGE_API_KEY needed in app code — key configured in MongoDB Atlas/mongot
- Embeddings auto-regenerate on document update
- Supports filter fields alongside autoEmbed fields
**Alternatives Considered**: (1) Stay manual-only (works but adds latency, code complexity, API key management, and rate-limit risk), (2) Wait for GA before planning (wastes design time, GA is imminent), (3) Auto-embed only, no fallback (breaks M0 free tier and local dev).
**Consequences**: Phase 8.3 gains autoEmbed index definition. `embedding-pipeline.ts` becomes fallback-only. `search.ts` needs dual-mode query (text query vs vector query). Import pipeline (Phase 9) no longer needs `embedSkill()` calls when autoEmbed is active. ADR-005 is SUPERSEDED for production but kept for fallback path.
**Supersedes**: ADR-005 (for production deployments). ADR-005 remains valid for M0/local fallback.

### ADR-012: Standalone Runtime Is The Release Artifact — 2026-04-05
**Context**: `next build` and route-module tests were green, but the final standalone smoke still exposed real release issues: missing `/api/health`, stale `/api/v1` discovery docs, bearer-token drift on real HTTP requests, and Auth.js `UntrustedHost`.
**Decision**: Treat the standalone production artifact as the canonical release target for verification and local production start.
- `npm run start` now executes `node .next/standalone/server.js`.
- `/api/health` is a required readiness contract for Docker/self-hosted deployments.
- Final release checks must hit the running artifact over HTTP, including bearer-token auth flows.
- Auth.js is configured with `trustHost: true` for self-hosted/runtime correctness.
**Alternatives Considered**: (1) Keep `next start` and treat the standalone warning as acceptable noise, (2) trust route-module tests/build output alone, (3) leave Docker health checks pointed at a nonexistent route.
**Consequences**: Runtime validation becomes stricter but much more honest. The release gate now verifies the exact artifact users will run, which reduces “green build, broken deploy” false confidence.

### ADR-009: V2 Pivot — From Skills Manager to Universal Agent Configuration Platform — 2026-04-02
**Context**: Research revealed that Claude Code now supports 15+ asset types (skills, agents, hooks, MCP servers, LSP servers, plugins, commands, scheduled tasks, channels), not just skills. The `marketplace.json` protocol enables self-hostable plugin marketplaces. Reddit threads show enterprise teams duct-taping solutions with git repos and symlinks. 11+ competitors analyzed — none combine enterprise governance + semantic search + cross-tool + multi-department + beyond-skills. Department harnesses (complete config bundles for Sales, Engineering, DevOps) are validated by community (204 skills across 13 departments already exist).
**Decision**: Pivot from "skills management" to "universal AI agent configuration platform." Support ALL asset types Claude Code (and competitors) use. Target enterprise departments, not just individual developers. Maintain marketplace.json protocol compatibility. Strategy is EXPAND, NOT REWRITE — our MongoDB/Voyage/RBAC architecture extends naturally.
**Key Research Sources**: Inside Claude Code: Architecture (21 chapters), Agent Skills Specification, Claude Code Official Docs (marketplace protocol), Effective Context Engineering, Writing Effective Tools for Agents, 11+ competitor analyses, MCPXplore patterns.
**Alternatives Considered**: (1) Stay as skills-only manager (too narrow, competitors like skills.sh already dominate), (2) Full rewrite with new stack (waste of working architecture), (3) Desktop app (SkillDeck already exists), (4) Public marketplace competitor (can't beat skills.sh with 91K+ skills).
**Consequences**: 8 new phases (8-15). Data model generalizes `skills` → `assets` with type discriminator. RBAC adds org→department→team hierarchy. Marketplace endpoint generates full `marketplace.json`. Import engine handles 7+ config formats. Export engine translates to Claude Code, Cursor, Copilot, Windsurf, Codex. Built-in copilot agent powered by Claude Agent SDK. Enterprise features: SSO/SAML, SCIM, audit logging, security scanning.
**The Gap We Fill**: Enterprise governance for AI agent configurations — the "GitHub for AI Agent Configs" that nobody has built yet.

### ADR-008: SkillDeck inspiration — Split-pane editor, lock file import, update checker — 2026-04-01
**Context**: Research of crossoverJie/SkillDeck (macOS native Swift skill manager) revealed UX patterns we hadn't considered. SkillDeck was missed in initial research — we found shiwenwen/SkillsHub (Tauri) but not this one.
**Decision**: Adopt three patterns from SkillDeck:
1. **Split-pane SKILL.md editor** (form + markdown + live preview) for Phase 4.3
2. **Lock file import** — read `~/.agents/.skill-lock.json` to bootstrap a team with user's existing local skills (future feature)
3. **Update checker** — track upstream git hashes to show "X skills have updates available" in dashboard
**Alternatives Considered**: Building editor from scratch (reinventing), ignoring lock file (harder onboarding), no update tracking (stale skills).
**Consequences**: Phase 4.3 editor will be split-pane. Phase 5.2 GitHub import can also read lock file metadata (source repo, commit hash). Dashboard needs an "updates available" indicator.
**Key Difference**: SkillDeck is a local single-user macOS app (filesystem as DB, no auth, no search). SkillsHub is a cloud team platform (MongoDB, RBAC, semantic search, marketplace protocol). They are complementary, not competing.

### ADR-001: MongoDB Atlas M0 over self-hosted — 2026-04-01
**Context**: Need a database for skills storage, search, and vector embeddings.
**Decision**: Use MongoDB Atlas M0 (free tier) with Atlas Search + Vector Search.
**Alternatives Considered**: Self-hosted MongoDB (ops overhead), PostgreSQL + pgvector (less natural for document model), Supabase (no native vector search at scale).
**Consequences**: Limited to M0 constraints (512MB storage, shared resources). No auto-embeddings (only available on local Atlas). Must use explicit Voyage AI pipeline. Connection pool must be small (maxPoolSize=5).

### ADR-002: Voyage AI voyage-3-lite over OpenAI embeddings — 2026-04-01
**Context**: Need embedding model for semantic search on skill content.
**Decision**: Use Voyage AI `voyage-3-lite` (1024 dimensions).
**Alternatives Considered**: OpenAI `text-embedding-3-small` (1536 dims, more expensive), MongoDB auto-embeddings (not available on M0/Atlas cloud).
**Consequences**: 1024-dimension vectors. Must build explicit embedding pipeline (generate on create/update). Voyage API key required in env.

### ADR-003: Next.js 15 App Router over Pages Router — 2026-04-01
**Context**: Need a full-stack framework for dashboard + API.
**Decision**: Next.js 15 with App Router, React Server Components, Server Actions.
**Alternatives Considered**: Pages Router (legacy), Remix (smaller ecosystem), standalone API + SPA (more complexity).
**Consequences**: Use RSC by default, 'use client' only when needed. Server Actions for mutations. API Routes for external endpoints (marketplace.json, Chrome extension).

### ADR-004: Team management focus over public marketplace — 2026-04-01
**Context**: skills.sh already dominates the public marketplace space (91K+ skills, 12K+ stars).
**Decision**: Position SkillsHub as enterprise team management layer, not a public marketplace competitor.
**Alternatives Considered**: Building a competing public marketplace (can't beat Vercel's momentum), desktop app (shiwenwen already built one).
**Consequences**: Core features are team-scoped: RBAC, private registries, approval workflows, team search. Integration WITH public marketplaces (import from skills.sh/GitHub) rather than competing against them.

### ADR-005: Explicit embedding pipeline over auto-embeddings — 2026-04-01 ⚠️ SUPERSEDED by ADR-010 for production
**Context**: MongoDB auto-embeddings only work on atlas-local (Docker), not Atlas cloud M0.
**Decision**: Build explicit pipeline: on skill create/update → call Voyage API → store vector.
**Alternatives Considered**: Auto-embeddings with atlas-local for dev (adds Docker dependency), chunking strategies (SKILL.md files are typically small enough for single embedding).
**Consequences**: Must handle embedding generation in application code. Can use `after()` for non-blocking updates. Must handle Voyage API errors/retries.
**Update (2026-04-03)**: ADR-010 supersedes this for Atlas M10+ production. This pipeline remains as fallback for M0 free tier and local dev.

### ADR-007: Install 6 additional skill guidelines — 2026-04-01
**Context**: Initial plan had 9 MongoDB/React/frontend skills. Skill hunt via `npx skills find` revealed high-quality skills for composition patterns, App Router, Tailwind, TypeScript, API security, and Chrome extensions.
**Decision**: Install all 6: vercel-composition-patterns (107K installs), nextjs-app-router-patterns (10.7K), tailwind-design-system (25.9K), typescript-advanced-types (19.1K), api-security-best-practices (4.2K), chrome-extension-development (765).
**Alternatives Considered**: Only installing Vercel skills (missed security and Chrome extension coverage), writing our own guidelines (slower, lower quality than community-proven skills).
**Consequences**: 15 total skill guidelines. Every phase has comprehensive coverage. All installed to ~/.agents/skills/ so any coding agent (Claude Code, Augment, Cursor, Copilot, etc.) gets them.

### ADR-006: Context engineering folder for project continuity — 2026-04-01
**Context**: Project will be built across multiple sessions. Context loss between sessions causes rework, repeated mistakes, and inconsistency.
**Decision**: Maintain a `/context` folder with structured files (STATE, DECISIONS, PATTERNS, GOTCHAS, per-phase logs). Read before every task, write after every task.
**Alternatives Considered**: Relying on conversation history alone (gets truncated), external docs (disconnected from code), no documentation (chaos).
**Consequences**: Every task has read/write overhead (~30 seconds). But eliminates context loss, prevents repeated mistakes, and creates a searchable project knowledge base.
