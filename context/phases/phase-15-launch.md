# Phase 15 — Performance, Chrome Extension, Polish & Launch

## Status: SUPERSEDED / HISTORICAL DRAFT

This file was not kept in sync after `phase-15-polish.md` became the maintained Phase 15 record.

## Objective
Final audit pass, Chrome extension (relocated from V1 Phase 6), documentation,
landing page, public API, and launch preparation.

## Dependencies
- Phases 8-14 (ALL must be complete — this is the final pass)

## Tasks
- [ ] 15.1 Performance audit (Core Web Vitals, MongoDB explain(), bundle analysis)
- [ ] 15.2 Dashboard UI polish (responsive, WCAG 2.1 AA, dark mode, skeletons)
- [ ] 15.3 Landing page + marketing site (value prop, pricing, comparison)
- [ ] 15.4 Documentation site (getting started, API ref, format spec, migration guides)
- [ ] 15.5 Chrome Extension MV3 (relocated from V1 Phase 6 — all asset types)
- [ ] 15.6 Public API + rate limiting + SDK packages
- [ ] 15.7 Launch checklist verification

## Absorbed From V1
- **Phase 6 (Chrome Extension)**: Now supports ALL asset types, uses parser registry
- **Phase 7 (Polish & Security)**: Performance audit, a11y, security hardening

## Chrome Extension Spec (15.5)
- Manifest V3, "Save to Team" for all asset types
- Detects: SKILL.md, agents/, .cursorrules, .mcp.json, CLAUDE.md, plugin.json
- Uses parser registry (Phase 9) for format detection
- Team selector popup, import preview, one-click save
- Works on: GitHub file views, skills.sh pages, raw markdown URLs

## Launch Checklist (15.7)
- [ ] 250+ tests passing, >80% coverage
- [ ] Security scan clean (gitleaks, OWASP top 10)
- [ ] Performance targets met (LCP <2.5s, search <200ms)
- [ ] Documentation complete
- [ ] Landing page live
- [ ] Public API stable
- [ ] 3+ department harnesses populated with real content
- [ ] marketplace.json validates with Claude Code
- [ ] Chrome extension published to Chrome Web Store
- [ ] Export validated: assets install correctly in Cursor, Copilot, Windsurf
- [ ] Copilot tested with real user scenarios

## Skill Guidelines Active
- ALL guidelines (this is the full audit pass)

## Work Log
(Updated as tasks complete)

### 2026-04-05 — Post-audit product strategy research
- Ran a live external research sprint plus 3 parallel sub-agent reports to test where the product could become genuinely differentiated without overbuilding.
- Strong convergence: the durable opportunity is an **agent control plane** for assets and releases, not a new agent runtime.
- Repeated market gap across Anthropic/OpenAI/LangGraph/AWS/Microsoft/Google ecosystems: teams can build agents, but still lack a single governed source of truth for prompts, MCP servers, tool permissions, approvals, eval gating, rollback, and org policy.
- MongoDB increasingly solves the substrate problem (documents + search/vector + automated embedding), but not the operational semantics enterprises need for production agent systems.
- Recommended wedge from research: **GitHub for AI agent assets, releases, and governed memory**, built on top of MongoDB rather than in competition with it.

### 2026-04-05 — OSS-first launch planning adjustment
- Release strategy shifted toward **open-source-first** instead of immediate hosted SaaS assumptions.
- “Works perfectly out of the box” now becomes a launch requirement: setup, docs, scripts, env files, seed data, validation, and local/cloud deployment stories must align.
- Current gap called out explicitly: the repo presents plain `mongo:7` Docker as the default local setup, while important platform capabilities rely on Atlas Search / Vector Search / local Atlas features. This needs a supported-tier story before launch claims are credible.
- Added roadmap artifacts:
  - `docs/plans/2026-04-05-oss-release-design.md`
  - `docs/plans/2026-04-05-oss-release-implementation.md`

## Lessons Learned
(Updated after phase completion)
