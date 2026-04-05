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
- 2026-04-05 stabilization wave 2 ✅ Hardened `/api/teams/:teamId/members` with role-hierarchy enforcement, fixed personal API token revocation ownership, added bearer-token support to `requireAuth(request)` for extension/CLI-style routes, repaired the create-asset page to send the active `teamId`, and replaced the extension’s fake hardcoded bootstrap with a configurable base-url/token/team setup flow. Focused lint passed and focused tests (`stabilization-routes`, `governance`, `api-helpers`) are green.

## Lessons Learned
- Edge middleware is the right place for security headers and rate limiting — runs before all routes.
- In-memory rate limiting is per-instance on Edge — for production, use Redis or Vercel KV.
- Skeleton loaders are much better UX than spinners — users see the content shape immediately.
- Green integration tests do not prove launch readiness. UI/API contract drift, missing authorization checks, and stale TypeScript/test surfaces can survive a fully passing Vitest run.
- `next build` exiting 0 is not enough when page-data collection logs runtime env/DB initialization errors. Treat build logs as part of the release gate, not just the exit code.
