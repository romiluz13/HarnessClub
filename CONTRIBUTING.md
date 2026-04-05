# Contributing to AgentConfig

Thank you for your interest in contributing! This guide will help you get started.

## Quick Start

```bash
# 1. Fork and clone
git clone https://github.com/YOUR_USERNAME/agentconfig.git
cd agentconfig

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env.local
# Fill in MONGODB_URI, NEXTAUTH_SECRET, GitHub OAuth

# 4. Start MongoDB (Docker or local)
docker compose up mongo -d

# 5. Seed the database
npx tsx scripts/seed.ts

# 6. Start dev server
npm run dev
```

## Development Workflow

1. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/your-feature
   ```

2. **Write code** following the standards below.

3. **Write tests** — integration tests required for any new service or route.

4. **Run checks**:
   ```bash
   npm run typecheck      # TypeScript compilation
   npm run test           # All tests (vitest)
   node scripts/wiring-audit.mjs  # Ensure no dead services
   ```

5. **Open a PR** against `main`. All CI checks must pass.

## Code Standards

### TypeScript
- **Strict mode** — no `any` types, use `unknown` or proper generics
- **Interfaces over types** for object shapes
- **No barrel files** — import directly from source modules

### React / Next.js
- **Server Components** by default, `'use client'` only when needed
- `Promise.all()` for independent async operations
- `next/dynamic` for heavy components

### MongoDB
- **Connection singleton** — create once, reuse
- M0 constraints: `maxPoolSize=5`, `minPoolSize=0`, `maxIdleTimeMS=30000`
- ESR compound indexes (Equality → Sort → Range)
- `$jsonSchema` validation on all collections

### File Size Limits
- Components: 200 lines max
- Utilities: 300 lines max
- Services: 400 lines max
- No file over 500 lines — split into modules

## Testing Requirements

### Integration Tests Required
Every new service or API route **must** have integration tests that:
- Hit a real MongoDB instance (use `getTestDb()` from test helpers)
- Test the full round-trip: insert → query → verify
- Clean up test data in `afterAll`

### Forbidden Test Patterns
- ❌ `expect(typeof x).toBe("string")` — tests nothing
- ❌ `expect(someString).toContain("keyword")` — proves only strings exist
- ❌ Tests that pass without MongoDB running
- ✅ Real DB operations with real assertions on returned data

### Wiring Audit
Every service in `src/services/` must be imported by at least one API route
in `src/app/api/`. The wiring audit script enforces this:

```bash
node scripts/wiring-audit.mjs
# Must output: ✅ PASS: All N services are wired
```

If you add a new service file, you **must** wire it to a route.

## Architecture

```
src/
├── app/           # Next.js App Router (pages + API routes)
│   ├── api/       # API endpoints
│   └── dashboard/ # UI pages
├── components/    # React components
├── lib/           # Shared utilities (db, auth, rbac)
├── services/      # Business logic (one file per domain)
└── types/         # TypeScript interfaces
```

### Adding a New Service

1. Create `src/services/my-feature.ts`
2. Create API route `src/app/api/my-feature/route.ts` that calls the service
3. Add integration test `tests/integration/my-feature.test.ts`
4. Run `node scripts/wiring-audit.mjs` — must pass
5. Run `npm run typecheck` — must compile clean

## Getting Help

- Open an issue for bugs or feature requests
- Use Discussions for questions
- Check existing issues before creating new ones

## License

By contributing, you agree that your contributions will be licensed under the Apache 2.0 License.
