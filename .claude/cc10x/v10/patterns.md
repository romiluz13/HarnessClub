# Patterns

## User Standards
- Next.js 15 App Router with Server Components by default
- MongoDB Atlas M0 with strict pool constraints (maxPoolSize=5)
- Voyage AI embeddings for semantic search
- TDD approach, >80% coverage target
- WCAG 2.1 AA compliance
- No barrel files, direct imports only
- Strict TypeScript, no `any` types
- ESR compound indexes (Equality → Sort → Range)
- $jsonSchema validation on all collections
- SVG icons only (Lucide), no emoji

## Common Gotchas
- `escapeRegex()` exists in `src/app/api/assets/route.ts:19-21` but is NOT shared — 5 other regex injection sites do not use it
- `proxy.ts` security middleware is dead code — not wired to Next.js middleware convention, so zero headers/rate limiting in production
- 5 collections missing from `setup-db.ts` (approval_requests, copilot_conversations, api_tokens, metrics_snapshots, webhooks) — all COLLSCAN
- `requireAuth()` called inconsistently: some routes pass `request`, others don't — standardize on `requireAuth(request)`
- Settings tokens route passes `userId` as `teamId` in audit log — corrupts team_timestamp index queries
- N+1 in `listConversations` (`memory-service.ts:140`) — fetches N docs then N individual findOnes for message count
- `@testing-library/dom` is in production `dependencies` instead of `devDependencies`
- `window.location.href` in sidebar.tsx keyboard shortcuts bypasses SPA navigation
- [Deferred]: Content-Disposition header in export route uses unsanitized filename — header injection risk
- [Deferred]: In-memory rate limit store in proxy.ts has no cleanup for stale entries
- escapeRegex shared util pattern: `src/lib/utils.ts` (planned)
- middleware.ts re-export pattern for proxy.ts (planned)
- module augmentation pattern for NextAuth session types at `src/types/next-auth.d.ts` (planned)

## Project SKILL_HINTS
- vercel-react-best-practices
- nextjs-app-router-patterns
- mongodb-schema-design
- mongodb-connection
- mongodb-search-and-ai
- mongodb-query-optimizer
- api-security-best-practices
- tailwind-design-system
- typescript-advanced-types
- frontend-patterns

## Last Updated
2026-04-06T00:00:00Z
