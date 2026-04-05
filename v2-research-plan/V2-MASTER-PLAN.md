# V2 Master Plan — AI Agent Configuration Platform (Harmonized)

> **Vision**: The "GitHub for AI Agent Configurations"
> **Strategy**: EXPAND, DON'T REWRITE — V1 architecture extends naturally
> **Methodology**: Phase-based, TDD, context protocol, ADRs, skill guidelines
> **ADR**: ADR-009 (context/DECISIONS.md)
> **V1 Status**: Phases 0-5 ✅ COMPLETE | Phase 6 ❌ → P15 | Phase 7 ❌ → P15

---

## V1 → V2 CONTINUITY

### What V1 Built (Phases 0-5) — ALL KEPT
| V1 Asset | V2 Status | Phase |
|----------|-----------|-------|
| `skills` collection + $jsonSchema | EXPAND → `assets` with type discriminator | 8 |
| Atlas Search + Vector Search indexes | EXPAND → add `type` facet filter | 8 |
| Voyage AI embedding pipeline | EVOLVE → autoEmbed primary, manual fallback (ADR-010) | 8 |
| Hybrid search (lexical + vector + RRF) | KEEP → add type/dept facets | 8 |
| RBAC (4 roles, 11 permissions) | EXPAND → org/dept/team hierarchy | 11 |
| Auth.js v5 + GitHub OAuth | EXPAND → add SSO/SAML | 13 |
| Marketplace JSON endpoint | EXPAND → full plugin bundles | 10 |
| GitHub import (SKILL.md/AGENTS.md) | EXPAND → 11 format parser registry | 9 |
| Dashboard UI (sidebar, cards, search) | EXPAND → multi-asset UI | 8 |
| 109 tests, 0 mocks | EXPAND → target 250+ | all |

### V1 Phases Absorbed Into V2
| V1 Phase | Decision | Relocated To |
|----------|----------|-------------|
| Phase 6 — Chrome Extension | CANCELLED | Phase 15.5 (needs full asset model + parsers) |
| Phase 7 — Polish & Security | CANCELLED | Phase 15 (superset: + docs, API, launch) |

---

## DEPENDENCY MAP

```
P8  Asset Model + UI ──► P9  Import + Scan ──► P10 Marketplace + Export
                                                        │
P11 Org/Dept Hierarchy ◄────────────────────────────────┘
        │
P12 Security & Trust ◄──── P11
        │
P13 Enterprise Gov ◄────── P11, P12
        │
P14 Built-in Copilot ◄──── P8-P13
        │
P15 Polish, Chrome, Launch ◄── ALL
```

### Cross-Cutting Concerns (Built Incrementally)
| Concern | Starts | Matures |
|---------|--------|---------|
| Audit logging | P8 (lightweight CRUD logs) | P13 (SIEM, retention, compliance) |
| Security scanning | P9 (on-import: secrets, injection) | P12 (trust scores, approvals) |
| UI updates | P8 (skills→assets migration) | P15 (dark mode, a11y, polish) |
| Export formats | P10 (Cursor, Copilot, Windsurf, Roo, Gemini CLI) | P15 (SDK packages) |
| Embedding strategy | P8 (autoEmbed + manual fallback, ADR-010) | P15 (model upgrades, quantization) |
| Ambient activation | — | P14 (proactive config surfacing, ADR-011) |
| CLI for agents | — | P15 (`ac` CLI, ADR-011) |
| Usage/session tracking | — | P13 (which configs agents actually use, ADR-011) |
| Chrome extension | — | P15 (after parsers + all asset types) |

---

## PHASE 8: Asset Data Model + UI Migration
> Foundation — everything depends on this
> **Guidelines**: mongodb-schema-design, typescript-advanced-types, frontend-patterns

**8.1** Generalize `skills` → `assets` collection with `type` discriminator
- Types: `skill | agent | rule | plugin | mcp_config | hook | settings_bundle`
- Keep ALL existing fields, add type-specific metadata subobjects
- Migration script: add `type: "skill"` to all existing documents

**8.2** Expand $jsonSchema validators per asset type
- Base validator: shared fields (name, description, type, teamId, content)
- Type-specific validators: agent needs `whenToUse`; plugin needs `manifest`
- Backward compat: existing skills pass validation unchanged

**8.3** Update search indexes for multi-type querying + autoEmbed
- Add `type` to Atlas Search index (filterable facet)
- Compound indexes: `{ teamId: 1, type: 1, name: 1 }`
- Vector index: switch to `autoEmbed` type (ADR-010) — MongoDB generates embeddings automatically
  - Index field: `{ type: "autoEmbed", path: "searchText", model: "voyage-3-lite" }`
  - `searchText` field = concatenated name + description + tags + content (replaces manual `buildEmbeddingText`)
  - Fallback: keep manual `vector` index for M0/local dev (runtime detection)
- Search service: dual-mode query — text query (autoEmbed) vs queryVector (fallback)

**8.4** Generalized API routes: `/api/assets`
- GET `/api/assets` — list with `?type=skill&type=agent` multi-filter
- POST `/api/assets` — create any type (type-specific validation)
- GET/PATCH `/api/assets/[id]` — single asset CRUD
- Keep `/api/skills` as backward-compatible alias

**8.5** TypeScript types and services
- `src/types/asset.ts` — base `Asset` interface + discriminated unions
- `src/services/asset-service.ts` — generalized CRUD (auto-populates `searchText` field on create/update)
- Refactor embedding pipeline: autoEmbed detection + manual fallback (ADR-010)
- Search service dual-mode: `query: "text"` for autoEmbed, `queryVector` for manual

**8.6** Dashboard UI migration (skills → assets)
- Rename components: `skill-card` → `asset-card` (with type badge/icon)
- Add type filter tabs to assets list page
- Update search to include type facets in results
- Update import modal to show detected asset types
- Route: `/dashboard/skills` → `/dashboard/assets` (keep redirect)

**8.7** Lightweight audit logging foundation
- `audit_logs` collection with TTL index (90 days)
- Log all asset CRUD: `{ actor, action, targetId, targetType, timestamp }`
- Service: `src/services/audit-service.ts` (simple append-only)
- NOT full SIEM/export yet — that's Phase 13

**Tests**: ~25 new (asset CRUD per type, migration, UI components, audit logging)

---

## PHASE 9: Multi-Format Import Engine + Basic Security Scanning
> Content acquisition — parse ANY config format + catch dangers on import
> **Guidelines**: typescript-advanced-types, api-security-best-practices

**9.1** Parser registry architecture
- `src/services/parsers/registry.ts` — format detection + parser dispatch
- Auto-detect from: file extension, content patterns, directory structure

| Format | Source Tool | Asset Type | Detection |
|--------|-----------|------------|-----------|
| `SKILL.md` | Claude Code / Agent Skills | skill | YAML frontmatter + `name` |
| `agents/*.md` | Claude Code | agent | YAML frontmatter + `description` |
| `CLAUDE.md` | Claude Code | rule | Markdown, no frontmatter |
| `plugin.json` | Claude Code | plugin | JSON with `name` + `version` |
| `.cursorrules` | Cursor | rule | Plain text / Markdown |
| `.cursor/rules/*.mdc` | Cursor | rule | MDC format |
| `copilot-instructions.md` | GitHub Copilot | rule | Markdown in `.github/` |
| `.windsurfrules` | Windsurf | rule | Plain text / Markdown |
| `AGENTS.md` | Codex / OpenAI | rule | Markdown |
| `.mcp.json` | Claude Code | mcp_config | JSON with server defs |
| `hooks.json` | Claude Code | hook | JSON with event handlers |

**9.2** Individual parsers (one per format)
- Each: `parse(content: string, filename: string) → ParsedAsset`
- Extract: name, description, content, type, metadata, sourceFormat
- Edge cases: missing frontmatter, multiple assets per file, nested dirs

**9.3** GitHub/GitLab import expansion
- Expand `github-import.ts` to use parser registry
- Auto-scan repo for ALL recognized formats (not just SKILL.md)
- Batch import: "Import all configs from this repo"
- Support: public/private repos (with token), specific paths, branches
- With autoEmbed (ADR-010): just insert doc with `searchText` field — MongoDB embeds automatically
- With manual fallback: call `embedAsset()` after insert (non-blocking, per ADR-005)

**9.4** Basic security scanning on import
- `src/services/security-scanner.ts` — runs on every imported asset
- Detect: hardcoded API keys/tokens (regex patterns)
- Detect: prompt injection patterns (known attack strings)
- Detect: dangerous shell commands (`rm -rf /`, `curl | bash`, `eval`)
- Detect: suspicious URLs in MCP configs
- Result: `scanResult: { status: 'clean' | 'warning' | 'blocked', findings[] }`
- Block import if critical findings, warn if minor
- NOT full trust scoring yet — that's Phase 12

**9.5** URL/text import
- Paste raw content → auto-detect format → parse → scan → create
- Import from URL (fetch + parse)
- Bulk import from marketplace.json URL

**Tests**: ~30 new (one per parser + detection + batch + scanning patterns)

---

## PHASE 10: Plugin Marketplace + Export Engine
> Distribution — native marketplace.json + export to ANY tool
> **Guidelines**: api-security-best-practices, nextjs-app-router-patterns

**10.1** Full plugin bundle model
- Plugin = bundle of: skills + agents + hooks + MCP configs
- `type: "plugin"` in assets, with `manifest` and `bundledAssets: ObjectId[]`
- Plugin metadata: version (semver), dependencies, compatibility

**10.2** marketplace.json generation endpoint
- `GET /api/marketplace/[teamSlug]/marketplace.json`
- Full Claude Code compatible schema: name, owner, plugins[]
- Plugin entries: name, source (git URL), version, description, author, tags
- ETag + Cache-Control headers (built in V1)

**10.3** Plugin install protocol
- Platform serves plugin directory structure (skills/, agents/, .claude-plugin/)
- Claude Code: `/plugin marketplace add https://agentconfig.dev/api/marketplace/[team]`
- Individual install: `/plugin install [plugin]@[team]`

**10.4** Version management + upstream tracking
- Semver versioning for plugins
- Capability fingerprinting (SHA256 of canonicalized metadata)
- "Updates available" indicator (from ADR-008)
- Changelog tracking per version

**10.5** Export engine — format translators
- `src/services/exporters/registry.ts` — target tool → translator dispatch
- Each exporter: `export(asset: Asset) → { filename: string, content: string }`

| Target Tool | Export Format | Notes |
|------------|-------------|-------|
| Claude Code | SKILL.md / agents/*.md / CLAUDE.md | Native format, 1:1 |
| Cursor | .cursorrules / .cursor/rules/*.mdc | Flatten to single file or MDC |
| GitHub Copilot | .github/copilot-instructions.md | Merge rules into single file |
| Windsurf | .windsurfrules | Flatten to single file |
| Codex / OpenAI | AGENTS.md | Merge rules into single file |

**10.6** Export UI + API
- "Export" button per asset and per collection (plugin/dept harness)
- `GET /api/assets/[id]/export?format=cursor` → returns formatted content
- Bulk export: `GET /api/export/[teamSlug]?format=claude-code` → zip of all assets
- "Copy to clipboard" in target format

**Tests**: ~20 new (marketplace gen, plugin bundling, each exporter, version tracking)

---

## PHASE 11: Organization & Department System
> Enterprise structure — org/dept/team hierarchy + department harnesses
> **Guidelines**: mongodb-schema-design, vercel-composition-patterns

**11.1** Organization → Department → Team hierarchy
- `organizations` collection: { name, slug, plan, billing, settings }
- `departments` collection: { orgId, name, type, description, defaultAssets[] }
- Department types: `engineering_fe | engineering_be | devops | sales | product | legal | marketing | support | finance | hr | custom`
- Update `teams` to reference `departmentId` and `orgId`
- RBAC expansion: org_admin → dept_admin → team_admin → member

**11.2** Department templates (pre-built harnesses)
- Each template = curated plugin bundle (skills + agents + rules + MCP configs)

| Department | Template Contents |
|-----------|-----------------|
| **Engineering (FE)** | React/Next.js skills, code review agent, eslint rules, testing agent |
| **Engineering (BE)** | API design skills, DB skills, security agent, CI/CD rules |
| **DevOps** | Docker skills, K8s agent, monitoring rules, deployment hooks |
| **Sales** | Prospect research agent, outreach skill, CRM rules |
| **Product** | PRD writing skill, user research agent, roadmap rules |
| **Legal** | Contract review agent, compliance rules, privacy skill |
| **Marketing** | Content creation skill, analytics agent, brand voice rules |
| **Support** | Ticket triage agent, KB skill, escalation rules |

**11.3** Department onboarding flow
- "Create department" → select type → auto-provision template
- Import existing: scan team members' `.claude/` directories
- Cross-department sharing: request → approve → share

**11.4** Department dashboard views
- Per-department asset library with category tabs
- Department analytics: asset usage, team adoption, coverage gaps
- Cross-department discovery with approval gates

**11.5** Marketplace scoping
- marketplace.json now supports org-level and dept-level scoping
- `GET /api/marketplace/[orgSlug]/marketplace.json` — all org plugins
- `GET /api/marketplace/[orgSlug]/[deptSlug]/marketplace.json` — dept plugins

**Tests**: ~20 new (org hierarchy, dept templates, onboarding, scoped marketplace)

---

## PHASE 12: Security & Trust Layer
> Trust — full scanning, provenance, approval workflows
> **Guidelines**: api-security-best-practices

**12.1** Advanced security scanning (extends 9.4 basic scanner)
- Prompt injection: known attack patterns + LLM-based detection
- MCP config analysis: allowlisted domains, cert pinning checks
- Hook script static analysis: escalation patterns, data exfiltration
- Periodic re-scan: cron job re-scans all assets weekly
- Scan history tracking per asset

**12.2** Trust scores and provenance
- Trust score per asset: author reputation + scan results + usage + age + reviews
- Provenance: original source URL, commit hash, author identity
- Chain of custody: imported by → modified by → approved by
- Visual indicators: shield icons, verified badges, trust level (A/B/C/D)

**12.3** Approval workflows
- Configurable per department: auto-approve | single approval | multi-approval
- Review queue for imported assets
- Diff view for asset updates (what changed?)
- Approval audit trail (feeds into P13 audit system)

**12.4** Supply chain security
- Upstream monitoring: detect when source repo changes
- Dependency scanning for plugin bundles
- Fork detection: alert when upstream diverges from installed version
- Cross-marketplace dependency blocking (from Claude Code architecture)

**Tests**: ~20 new (advanced scanning, trust scoring, approval workflows, supply chain)

---

## PHASE 13: Enterprise Governance
> Enterprise requirements — SSO, SCIM, full audit, compliance
> **Guidelines**: api-security-best-practices

**13.1** SSO / SAML 2.0 integration
- SAML 2.0 IdP: Okta, Azure AD, OneLogin
- OIDC: Google Workspace, Auth0
- JIT user provisioning from IdP attributes
- Department mapping from IdP groups → org/dept hierarchy (Phase 11)

**13.2** SCIM 2.0 directory sync
- Automatic user provisioning/deprovisioning
- Group → Team/Department mapping
- Sync status dashboard

**13.3** Full audit logging (extends 8.7 lightweight audit)
- Expand to ALL actions: auth, share, import, export, install, scan, approve
- Structured entries: actor, action, target, timestamp, IP, user agent, metadata
- Configurable retention (90 day default, TTL index)
- Export to SIEM (Splunk, Datadog format)
- Audit search + filtering UI

**13.4** API token management
- Personal access tokens (hashed, revocable, scoped to teams/depts)
- Service account tokens for CI/CD integration
- Token usage tracking + anomaly detection

**13.5** Compliance dashboard
- Asset coverage per department (% of teams with configs)
- Policy compliance: required rules enforced?
- Security scan status across all assets
- Export reports (PDF/CSV) for auditors

**Tests**: ~15 new (SSO flow, SCIM sync, audit search, token management, compliance)

---

## PHASE 14: Built-in Copilot Agent
> AI-native UX — an agent that helps build/discover/configure inside the platform
> **Guidelines**: vercel-react-best-practices, vercel-composition-patterns

**14.1** Copilot architecture (Claude Agent SDK)
- TypeScript agent using `@anthropic-ai/agent-sdk`
- Loads platform context via `settingSources` (team assets, dept templates)
- Tools: `search_assets`, `create_asset`, `recommend_harness`, `import_from_repo`
- Streaming responses, tool use visualization

**14.1b** Ambient Activation pattern (inspired by CandleKeep ADR-011)
- When agent is working on a substantive task, proactively surface relevant configs
- Background search → silent citation: "Your team's *react-best-practices* skill recommends..."
- No noise if nothing found. Zero user action required.

**14.2** Copilot UI integration
- Chat panel in dashboard (slide-over, not page navigation)
- Context-aware: knows which page/asset user is viewing
- Quick actions: "Create a skill for X", "Find agents for Y", "Set up Sales team"

**14.3** Copilot skills (meta-skills)
- Skill authoring assistant: interview → generate SKILL.md
- Agent definition helper: interview → generate agent .md (all 15 fields)
- Department setup wizard: interview → create dept + provision templates
- Migration helper: "Convert my Cursor rules to Claude Code skills"

**14.4** Agentic tool selection (from MCPXplore research)
- Sub-agent analyzes natural language request
- Generates optimized search queries (hybrid: keywords + semantic)
- Ranks by relevance to context
- Progressive disclosure: summaries first, full content on demand

**Tests**: ~15 new (copilot tools, search integration, recommendations)

---

## PHASE 15: Performance, Chrome Extension, Polish & Launch
> Ship it — final audit, Chrome ext, docs, landing, public API
> **Guidelines**: ALL (full audit pass)

**15.1** Performance audit
- Core Web Vitals: LCP < 2.5s, FID < 100ms, CLS < 0.1
- MongoDB: explain() on all queries, no COLLSCAN
- Bundle: code splitting, lazy loading, tree shaking
- Edge caching for marketplace.json endpoints
- Search latency: < 200ms for hybrid search

**15.2** Dashboard UI polish
- Responsive audit (mobile, tablet, desktop)
- WCAG 2.1 AA compliance pass
- Dark mode support
- Skeleton loaders for ALL data states
- Error boundaries with recovery
- Empty states with guided actions

**15.3** Landing page + marketing site
- Value prop: "GitHub for AI Agent Configs"
- Feature showcase, department harness gallery
- Pricing: Free (1 team) → Pro (5 teams) → Enterprise (unlimited + SSO)
- Comparison table vs competitors

**15.4** Documentation site
- Getting started (5-minute setup)
- API reference (OpenAPI 3.1)
- Format specification (all 11 formats)
- Department harness guides
- Plugin authoring guide
- Migration guides (Cursor, Copilot, Windsurf → AgentConfig)

**15.5** Chrome Extension (MV3) — relocated from V1 Phase 6
- Manifest V3, "Save to Team" for ALL asset types
- Detects: SKILL.md, agents/, .cursorrules, .mcp.json, CLAUDE.md, plugin.json
- Uses parser registry (Phase 9) for format detection
- Team selector popup, import preview, one-click save
- Works on: GitHub, skills.sh, any raw markdown URL

**15.6** Public API + rate limiting
- RESTful API with API key auth
- Rate limiting: 100/min free, 1000/min pro, unlimited enterprise
- Webhook notifications (asset updates, security alerts)
- SDK: `@agentconfig/sdk` (TypeScript), `agentconfig` (Python)

**15.6b** `ac` CLI for agents (inspired by CandleKeep ADR-011)
- Rust or Node binary: `ac search "react" --type skill --json`
- `ac install owner/repo@skill --tool cursor` → export + install in one step
- `ac export .cursorrules --from <asset-id>` → export to any tool format
- Agents call this directly instead of going through web dashboard

**15.7** Launch checklist
- [ ] All tests passing (250+ tests, >80% coverage)
- [ ] Security scan clean (gitleaks, OWASP top 10)
- [ ] Performance targets met
- [ ] Documentation complete
- [ ] Landing page live
- [ ] Public API stable
- [ ] 3+ department harnesses populated with real content
- [ ] marketplace.json validates with Claude Code
- [ ] Chrome extension published to Chrome Web Store
- [ ] Export validated: assets install correctly in Cursor, Copilot, Windsurf

**Tests**: ~20 new (API rate limiting, webhooks, Chrome ext, E2E smoke tests)

---

## UNIFIED SUMMARY

| # | Phase | Tasks | Tests | Key Deliverable |
|---|-------|-------|-------|----------------|
| 0-5 | **V1 Foundation** | 46 | 109 | ✅ Full platform: auth, RBAC, search, dashboard, marketplace, import |
| 8 | Asset Model + UI | 7 | ~25 | `assets` collection, multi-type CRUD, UI migration, audit foundation |
| 9 | Import + Scanning | 5 | ~30 | 11 format parsers, basic security scanning on import |
| 10 | Marketplace + Export | 6 | ~20 | Plugin bundles, marketplace.json, export to 7 tools (ADR-011) |
| 11 | Org/Dept System | 5 | ~20 | Hierarchy, 8 dept templates, scoped marketplace |
| 12 | Security & Trust | 4 | ~20 | Advanced scanning, trust scores, approval workflows |
| 13 | Enterprise Gov | 5 | ~15 | SSO/SAML, SCIM, full audit, API tokens, compliance |
| 14 | Built-in Copilot | 4 | ~15 | AI assistant with Claude Agent SDK |
| 15 | Polish & Launch | 7 | ~20 | Performance, Chrome ext, docs, landing, public API |
| | **TOTAL** | **89** | **~274** | **Production-ready enterprise platform** |

### What Changed From Original Plan (Harmony Fixes)
1. ✅ V1 phases 4-5 marked COMPLETE (were incorrectly NOT_STARTED)
2. ✅ V1 phase 6 CANCELLED → absorbed into Phase 15.5
3. ✅ V1 phase 7 CANCELLED → absorbed into Phase 15
4. ✅ Phase 8 gained 8.6 (UI migration) + 8.7 (audit foundation)
5. ✅ Phase 9 gained 9.4 (basic security scanning on import)
6. ✅ Phase 10 gained 10.5-10.6 (export engine — was completely missing)
7. ✅ Phase 11 gained 11.5 (marketplace scoping by org/dept)
8. ✅ Phase 12 (was 13) moved UP — security before governance
9. ✅ Phase 13 (was 12) moved DOWN — governance needs security first
10. ✅ Cross-cutting concerns documented (audit, scanning, UI, export built incrementally)
