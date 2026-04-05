# V3 Roadmap — Cabinet-Inspired Enhancements

> Source: https://github.com/hilash/cabinet (cloned to /Users/rom.iluz/Dev/cabinet/)
> Analysis date: 2026-04-04

## What Cabinet Is
A self-hosted AI startup OS — knowledge base + live AI agent orchestration. Everything is markdown on disk, no cloud, no database. Electron-like Next.js + node-pty terminal + Tiptap editor.

## Key Difference
Cabinet = **agent EXECUTION** platform (runs agents live with heartbeats, memory, inter-agent chat).
AgentConfig = **agent CONFIGURATION** platform (manages, secures, distributes configs across tools/teams).
They are complementary. We take inspiration from their UX/architecture, NOT their execution model.

---

## Phase 16: Interactive Onboarding Wizard
**Inspiration**: `cabinet/src/components/onboarding/onboarding-wizard.tsx`
Cabinet asks 5 questions → auto-generates an entire AI team with personas, goals, memory.

### Tasks
- 16.1 Wizard UI component (multi-step form, progress indicator)
  - REF: `cabinet/src/components/onboarding/onboarding-wizard.tsx` lines 1-200
  - 3-5 questions: team purpose, department type, tool preference, team size, security level
- 16.2 AI-powered template customization
  - REF: `cabinet/src/lib/agents/persona-manager.ts` (how Cabinet auto-generates personas)
  - Our version: take answers → select department template → customize starter assets → populate
- 16.3 First-run detection + redirect
  - If team has 0 assets and 0 completed onboarding → show wizard
  - Store onboarding completion in team document
- 16.4 Tests + verification

**Impact**: Massive first-run UX improvement. Currently users see empty dashboard.

---

## Phase 17: Asset Version History + Diff Viewer
**Inspiration**: Cabinet uses git auto-commit on every save. Full diff viewer to restore any version.

### Tasks
- 17.1 Version history schema on AssetDocument
  - Add `versions: [{ content, metadata, changedBy, changedAt, changeType }]` (capped array, last 50)
  - REF: Cabinet's git-based approach — we use MongoDB instead
- 17.2 Diff computation service
  - Line-by-line diff between any two versions
  - REF: `cabinet/src/components/layout/app-shell.tsx` (their diff viewer integration)
- 17.3 Version history API endpoints
  - GET /api/assets/{id}/versions — list versions
  - GET /api/assets/{id}/versions/{versionId}/diff — compute diff
  - POST /api/assets/{id}/revert/{versionId} — rollback
- 17.4 Diff viewer UI for approval workflows
  - When reviewer opens an approval request → show side-by-side diff of what changed
  - REF: Integrates with existing Phase 12 approval-service.ts
- 17.5 Tests + verification

**Impact**: Critical for enterprise. Approvals without diffs are useless. Rollback = safety net.

---

## Phase 18: Team Activity Feed (Slack-like)
**Inspiration**: `cabinet/src/lib/agents/slack-manager.ts`, `cabinet/src/lib/agents/task-inbox.ts`
Cabinet has full internal Slack — channels, threads, @mentions, task delegation between agents.

### Tasks
- 18.1 Activity event schema + service
  - Events: asset created/updated/published, member joined/left, approval requested/completed, scan alert
  - REF: `cabinet/src/lib/agents/slack-manager.ts` — their channel/message model
  - REF: `cabinet/src/types/agents.ts` lines 20-60 — SlackMessage type with messageType enum
- 18.2 Real-time feed API (polling initially, SSE later)
  - GET /api/teams/{teamId}/feed — recent activity
  - Per-user read cursors (what you've seen)
- 18.3 Feed UI component
  - Chronological feed in sidebar or dedicated tab
  - Filter by event type, user, asset
  - REF: `cabinet/src/components/agents/agents-workspace.tsx` lines 700-800 (their channel view)
- 18.4 @mention notifications
  - Tag team members in comments on assets
  - Badge count on sidebar
- 18.5 Tests + verification

**Impact**: Transforms from "tool" to "workspace". Teams actually collaborate, not just store configs.

---

## Phase 19: Agent Goals & Adoption Metrics
**Inspiration**: `cabinet/src/lib/agents/goal-manager.ts`
Cabinet tracks per-agent KPIs: `{ metric, target, current, unit, floor, stretch }`.

### Tasks
- 19.1 Department/team KPI schema
  - Metrics: % configs scanned, % trust A/B, adoption rate, export count, active users
  - REF: `cabinet/src/lib/agents/goal-manager.ts` — GoalMetric interface
- 19.2 Metrics computation service
  - Aggregate from assets, scans, audit logs, usage stats
  - Weekly trend snapshots
- 19.3 Dashboard metrics widget
  - Sparkline charts, progress bars, floor alerts (metric dropping)
- 19.4 Department comparison view
  - Side-by-side dept metrics for org admins
- 19.5 Tests + verification

**Impact**: Enterprise buyers need ROI metrics. "Your DevOps dept has 94% scan coverage vs 67% for Engineering."


---

## Phase 20: Structured Copilot + Chained Actions
**Inspiration**: `cabinet/src/lib/agents/conversation-runner.ts`, `cabinet/src/lib/agents/heartbeat.ts`

### Tasks
- 20.1 Structured response parser (action blocks: ASSET_CREATE, SEARCH, EXPORT, SCAN)
  - REF: `cabinet/src/lib/agents/heartbeat.ts` lines 50-120 — output block parsing
- 20.2 Copilot memory (conversation history per team, TTL 30d)
  - REF: `cabinet/src/lib/agents/persona-manager.ts` — agent context
- 20.3 Proactive suggestions based on team state
- 20.4 Tests + verification

---

## Phase 21: Live Asset Preview + Rich Rendering
**Inspiration**: Cabinet renders embedded HTML apps as iframes in KB pages.

### Tasks
- 21.1 Markdown/JSON preview renderers per asset type
- 21.2 Export preview (side-by-side multi-tool comparison)
- 21.3 MCP config validator + tester (live domain/transport checks)
- 21.4 Tests + verification

---

## Priority Matrix

| Phase | Feature | Effort | Impact | Priority |
|-------|---------|--------|--------|----------|
| 16 | Onboarding Wizard | Medium | 🔴 Critical | P0 |
| 17 | Asset Versioning + Diffs | Medium | 🔴 Critical | P0 |
| 18 | Team Activity Feed | Medium | 🟡 High | P1 |
| 19 | Agent Goals & Metrics | Medium | 🟡 High | P1 |
| 20 | Structured Copilot | Low-Med | 🟢 Medium | P2 |
| 21 | Live Previews | Medium | 🟢 Medium | P2 |

## Execution Order: 16 → 17 → 18 → 19 → 20 → 21

## Cabinet Files Quick Reference
| File | What It Contains | Our Inspiration |
|------|-----------------|-----------------|
| `onboarding/onboarding-wizard.tsx` | 5-question setup wizard | Phase 16 |
| `lib/agents/persona-manager.ts` | Auto-generates agent personas | Phase 16 |
| `lib/agents/goal-manager.ts` | KPI tracking with floor/stretch | Phase 19 |
| `lib/agents/heartbeat.ts` | Cron-based execution + output parsing | Phase 20 |
| `lib/agents/conversation-runner.ts` | Agent conversation management | Phase 20 |
| `lib/agents/slack-manager.ts` | Internal Slack-like messaging | Phase 18 |
| `lib/agents/task-inbox.ts` | Cross-agent task delegation | Phase 18 |
| `types/agents.ts` | Agent/channel/message types | Phases 18-20 |
| `components/agents/agents-workspace.tsx` | 1546-line main workspace UI | Phase 18 |
| `components/agents/agent-live-panel.tsx` | Real-time agent status view | Phase 19 |
