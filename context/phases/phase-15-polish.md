# Phase 15: Performance, Chrome Extension, Polish & Launch

## Status: ⚠️ REOPENED — skeptical audit found launch blockers

## Goal
Ship-ready platform. Performance, Chrome extension, docs, landing page, public API, CLI, launch checklist.

## Subtasks
- 15.1 Performance audit (Core Web Vitals, MongoDB explain, bundle, caching)
- 15.2 Dashboard UI polish (responsive, a11y, dark mode, skeletons, error boundaries)
- 15.3 Landing page + marketing (value prop, features, pricing)
- 15.4 Documentation site (getting started, API ref, format specs, migration guides)
- 15.5 Chrome Extension MV3 (Save to Team, format detection, team selector)
- 15.6 Public API + rate limiting + CLI (`ac` command)
- 15.7 Launch checklist verification

## Dependencies
All previous phases (8-14) complete.

## Work Log
- 15.1 ✅ Edge middleware: CSP, HSTS, X-Frame-Options, Permissions-Policy. 4-tier rate limiting (api/auth/marketplace/copilot). TtlCache with getOrSet, invalidatePrefix, eviction. next.config optimizations.
- 15.2 ✅ ErrorBoundary with retry. 6 skeleton loaders (AssetCard, AssetList, TeamCard, Stats, Marketplace, Detail). EmptyState. Dashboard loading.tsx + error.tsx. All WCAG 2.1 AA, motion-reduce safe.
- 15.3 ✅ Landing page: hero, 5-tool showcase, 6-feature grid, 3-tier pricing, dark mode, responsive, 44px touch targets.
- 15.4 ✅ Docs hub with 7 sections. Getting Started guide with 5-step onboarding flow + API code examples.
- 15.5 ✅ Chrome Extension MV3: manifest.json, content.js (9 config patterns, GitHub SPA-aware), background.js (service worker, auth, raw fetch), popup (status UI, save).
- 15.6 ✅ Public API v1 discovery, token management API, webhook service (HMAC-SHA256 signing, fire-and-forget delivery).
- 15.7 ✅ 13 new tests (cache, webhooks, token format, copilot verification). 305/305 total. Build verified.
- 2026-04-05 audit ❌ Launch claim re-opened. `vitest` still passes (508/510), but `lint` and `tsc` fail, build exits 0 while logging `MONGODB_URI` errors, and review found security/authorization gaps plus broken UI/API contracts in create asset, SSO, approvals, member management, and extension flows.
- 2026-04-05 stabilization wave 1 ✅ Reconciled the SSO dashboard with `/api/orgs/:orgId/sso`, added org RBAC to SSO read/write/delete, hardened asset mutation/version/rollback authz, tightened approval create/review permissions, and added `tests/integration/stabilization-routes.test.ts` to lock the negative authorization cases. Focused lint passed and focused tests (`stabilization-routes`, `governance`, `e2e-versioning`) are green.
- 2026-04-05 stabilization wave 3 ✅ Cleared the remaining global TypeScript failure, aligned the stricter copilot memory auth test fixtures with team membership checks, made Auth.js + Mongo/Voyage integrations env-aware so `next build` no longer logs runtime stack traces without configured secrets, migrated `src/middleware.ts` to `src/proxy.ts` per Next 16, and removed the lingering SearchBar `act(...)` warning. Full gates are now green: `tsc`, `eslint` (error-free), `vitest`, and `next build`.
- 2026-04-05 Atlas Local Preview reality pass ✅ Reset the `mongodb/mongodb-atlas-local:preview` stack to a fresh volume, waited for container health, then validated the repo against the real Atlas-local lane: `search-hybrid.test.ts` proved native `$rankFusion`, `e2e-onboarding.test.ts` + `e2e-platform.test.ts` passed with zero mocks, and the full gate matrix (`tsc`, `eslint`, `vitest`, `next build`) stayed green while pointed at `mongodb://localhost:27018/?directConnection=true`. Live copilot suites remain skipped until `COPILOT_LIVE_TEST`, `COPILOT_MODEL`, `COPILOT_BASE_URL`, and `COPILOT_API_KEY` are supplied in `.env.test`.

## Lessons Learned
- Edge middleware is the right place for security headers and rate limiting — runs before all routes.
- In-memory rate limiting is per-instance on Edge — for production, use Redis or Vercel KV.
- Skeleton loaders are much better UX than spinners — users see the content shape immediately.
- Green integration tests do not prove launch readiness. UI/API contract drift, missing authorization checks, and stale TypeScript/test surfaces can survive a fully passing Vitest run.
- `next build` can still look "green" while route/auth/provider modules emit runtime env initialization stack traces during page-data collection. Treat clean build logs as part of the launch gate.
- Optional integrations (Mongo adapter, OAuth providers, Voyage client) should be gated at module init so server components can import auth/search code during build without eagerly crashing when deploy-time secrets are absent.
