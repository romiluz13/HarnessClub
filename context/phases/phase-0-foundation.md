# Phase 0 — Project Foundation

## Status: ✅ COMPLETE

## Objective
Initialize the project with Next.js 15, MongoDB Atlas M0 connection, Voyage AI client, and proper project structure.

## Tasks
- [x] 0.1 Initialize Next.js Project (Next.js 16.2.2 — latest via create-next-app)
- [x] 0.2 MongoDB Atlas M0 Connection Singleton (src/lib/db.ts — singleton, globalThis cache, M0 pool config)
- [x] 0.3 Voyage AI Embedding Client (src/lib/voyage.ts — voyage-3-lite, 1024 dims, batch support)
- [x] 0.4 Environment & Config (src/lib/config.ts + .env.local.example — type-safe config with validation)
- [x] 0.5 Foundation Tests (15 tests passing — config, voyage, db modules)

## Skill Guidelines Active This Phase
- **mongodb-connection**: Singleton pattern, pool sizing (maxPoolSize=5, minPoolSize=0, maxIdleTimeMS=30000)
- **mongodb-mcp-setup**: Env var pattern for connection string
- **vercel-react-best-practices**: No barrel files (bundle-barrel-imports), direct imports only

## Pre-Phase Checklist
- [ ] MongoDB Atlas M0 cluster created
- [ ] Voyage AI API key obtained
- [ ] GitHub OAuth app created (for Phase 3, but good to have early)

## Work Log

### Task 0.1 — Initialize Next.js Project ✅
- Created Next.js 16.2.2 (latest) with App Router, TypeScript strict, Tailwind CSS 4, ESLint 9
- Package manager: bun (1.2.18)
- Structure: src/app, src/lib, src/components, src/services, src/types, tests/
- Fixed turbopack.root warning in next.config.ts
- Replaced boilerplate page.tsx with SkillsHub placeholder
- Build passes clean (Turbopack, ~1.8s compile)
- **Note**: Plan said "Next.js 15" but create-next-app@latest installs 16.2.2 — this is fine, it's the latest stable

## Lessons Learned
- create-next-app@latest installs Next.js 16 now (not 15). Plan references updated.
- bun is significantly faster than npm for installs and builds (~1.5s compile)
- Vitest 4.x works perfectly with Next.js 16 and path aliases via vitest.config.ts
- MongoDB driver 7.1.1 — no breaking changes from 6.x for our use case
- Tailwind CSS 4 uses @tailwindcss/postcss instead of old config pattern

## Errors Encountered
- create-next-app refused to run in directory with existing files (AGENTS.md, context/)
  → Workaround: temporarily move files to /tmp, restore after
- Turbopack root warning on dev/build
  → Fixed with turbopack.root in next.config.ts
