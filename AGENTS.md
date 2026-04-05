# SkillsHub — Agent Instructions

## What Is This Project?
SkillsHub is an enterprise-grade AI skills management platform for teams. It provides private registries, RBAC, semantic search, and Claude Code marketplace protocol integration. Built with Next.js 15, MongoDB Atlas M0, and Voyage AI embeddings.

## CRITICAL: Context Engineering Protocol

### Before ANY Work
You MUST read the context folder before starting any task:

1. **Read `context/STATE.md`** — Know what phase/task we're on, what's done, what's blocked
2. **Read `context/phases/phase-X-*.md`** — Current phase details, active skill guidelines
3. **Read `context/GOTCHAS.md`** — Avoid known pitfalls (saves hours of debugging)
4. **Read `context/PATTERNS.md`** — Use established patterns, don't reinvent

### After ANY Work
You MUST update the context folder after completing any task:

1. **Update `context/STATE.md`** — Mark progress, set what's next
2. **Update the phase file** — Log what was built, what was learned
3. **If you hit a bug** → Add to `context/GOTCHAS.md`
4. **If you established a pattern** → Add to `context/PATTERNS.md`
5. **If you made an architecture decision** → Add to `context/DECISIONS.md`

### Full Protocol
See `context/CONTEXT_PROTOCOL.md` for format standards, entry templates, and phase retrospective guidelines.

## Project Architecture

```
skills-hub/
├── AGENTS.md              ← You are here
├── context/               ← Living memory (READ/WRITE every task)
│   ├── STATE.md           ← Current state
│   ├── DECISIONS.md       ← Architecture decisions (ADR-style)
│   ├── PATTERNS.md        ← Proven patterns
│   ├── GOTCHAS.md         ← Bugs and pitfalls
│   ├── SKILLS_REFERENCE.md← Which skill guideline for which work
│   └── phases/            ← Per-phase logs
├── src/
│   ├── app/               ← Next.js 15 App Router pages + API routes
│   ├── lib/               ← Shared utilities, DB client, Voyage client
│   ├── components/        ← React components (NO barrel files)
│   ├── services/          ← Business logic layer
│   └── types/             ← TypeScript interfaces
├── tests/                 ← All tests (unit, integration, e2e)
└── extension/             ← Chrome Extension (Phase 6)
```

## Master Plan (8 Phases, 46 Tasks)
See task list for full details. Summary:
- **Phase 0**: Project foundation (Next.js 15, MongoDB, Voyage AI)
- **Phase 1**: MongoDB schema design (collections, indexes, validation)
- **Phase 2**: Search infrastructure (Atlas Search + Vector Search + hybrid)
- **Phase 3**: Authentication & RBAC (NextAuth.js, team roles)
- **Phase 4**: Dashboard UI (responsive, accessible, all states)
- **Phase 5**: Marketplace protocol (Claude Code integration, GitHub import)
- **Phase 6**: Chrome extension (Save to Team from GitHub/skills.sh)
- **Phase 7**: Performance, security & polish (full audit pass)

## Skill Guidelines (MUST Follow)

These installed skills contain rules that MUST be followed during development:

| Skill | When to Consult |
|-------|----------------|
| `vercel-react-best-practices` | Writing ANY React/Next.js code |
| `vercel-composition-patterns` | RSC composition, server/client boundaries |
| `nextjs-app-router-patterns` | Layouts, loading/error boundaries, parallel routes |
| `tailwind-design-system` | Tailwind CSS design tokens, component styling |
| `typescript-advanced-types` | Generics, utility types, strict type patterns |
| `mongodb-schema-design` | Designing or modifying collections |
| `mongodb-connection` | Database connection config |
| `mongodb-search-and-ai` | Building search features |
| `mongodb-query-optimizer` | Writing queries, creating indexes |
| `frontend-patterns` | Building UI components |
| `web-design-guidelines` | UI design decisions |
| `api-security-best-practices` | API route security, input validation, auth |
| `chrome-extension-development` | Chrome MV3 extension (Phase 6) |

Quick lookup: `context/SKILLS_REFERENCE.md`

## Code Standards

### TypeScript
- Strict mode enabled
- No `any` types — use proper generics or `unknown`
- Interfaces over types for object shapes

### React / Next.js
- Server Components by default, `'use client'` only when needed
- NO barrel files — import directly from source modules
- `Promise.all()` for independent async operations
- `startTransition` for non-urgent UI updates
- `next/dynamic` for heavy components

### MongoDB
- Connection singleton (create once, reuse everywhere)
- M0 constraints: maxPoolSize=5, minPoolSize=0, maxIdleTimeMS=30000
- ESR compound indexes (Equality → Sort → Range)
- $jsonSchema validation on all collections
- No COLLSCAN — verify with explain()

### UI
- State order: Error → Loading (no data) → Empty → Success
- WCAG 2.1 AA compliance
- Skeleton loaders for known content shapes
- 44px minimum touch targets
- SVG icons only (Lucide) — no emoji
- `cursor-pointer` on all clickable elements
- Honor `prefers-reduced-motion`

### Testing
- TDD approach
- >80% coverage target
- Tests in `/tests` folder
- Unit → Integration → E2E progression
