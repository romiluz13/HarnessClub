# SkillsHub — Skills Quick Reference

> Which skill guideline to consult for each type of work.

## Skill → Phase Mapping

| Skill | Phases | Key Rules to Follow |
|-------|--------|-------------------|
| **vercel-react-best-practices** | 0, 2, 4, 5, 7 | No barrel imports. Promise.all() for parallel ops. next/dynamic for heavy components. startTransition for non-urgent updates. Suspense boundaries. |
| **vercel-composition-patterns** | 4, 5 | RSC composition. Server/client boundaries. Compound components. Slot patterns. Context providers. |
| **nextjs-app-router-patterns** | 0, 3, 4, 5 | Layouts, loading.tsx, error.tsx, parallel routes, intercepting routes, server actions, route handlers. |
| **tailwind-design-system** | 4, 5, 6 | Design tokens, consistent spacing/colors, component variants, responsive utilities, dark mode. |
| **typescript-advanced-types** | ALL | Strict mode. Generics for reusable services. Utility types. Discriminated unions. No `any`. Interfaces over types. |
| **mongodb-schema-design** | 1 | Embed data accessed together. Bounded arrays only. $jsonSchema validation. Monitor 16MB limit. pattern-bucket for events. pattern-extended-reference for caching. |
| **mongodb-connection** | 0, 7 | Singleton client. maxPoolSize=5 for M0. minPoolSize=0. maxIdleTimeMS=30000. Init outside handler in serverless. |
| **mongodb-search-and-ai** | 2 | Atlas Search for lexical (autocomplete, fuzzy). Vector Search for semantic (1024-dim cosine). Hybrid via $rankFusion. Never use $regex/$text for search. |
| **mongodb-query-optimizer** | 1, 7 | ESR compound indexes. explain() to verify. No COLLSCAN. Max 20 indexes/collection. Check index coverage. |
| **mongodb-natural-language-querying** | 2 | Validate fields against schema. Prefer find over aggregation. Project only needed fields. $match early in pipelines. |
| **mongodb-mcp-setup** | 0 | Connection string via env var. ~/.mcp-env for credentials. chmod 600. |
| **atlas-stream-processing** | Post-MVP | Real-time analytics pipeline. No free tier — deferred. |
| **frontend-patterns** | 4, 6, 7 | Error→Loading→Empty→Data. WCAG 2.1 AA. 44px touch targets. No emoji icons. cursor-pointer on clickables. prefers-reduced-motion. Skeleton > Spinner for known shapes. |
| **api-security-best-practices** | 3, 5, 7 | Input validation. Auth on all routes. Rate limiting. CSP headers. CORS. SQL/NoSQL injection prevention. |
| **chrome-extension-development** | 6 | MV3 manifest. Content scripts. Background service workers. Storage API. Message passing. Permissions model. |
| **web-design-guidelines** | 4, 6 | UI design decisions. Visual hierarchy. Typography. Color systems. Layout composition. |

## Per-Task Quick Lookup

### When writing a React component:
- frontend-patterns → Loading states, accessibility, forms
- vercel-react-best-practices → Bundle size, re-renders, server components
- vercel-composition-patterns → RSC boundaries, compound components, slots
- tailwind-design-system → Design tokens, component styling, responsive

### When writing TypeScript:
- typescript-advanced-types → Generics, utility types, strict patterns, discriminated unions

### When building Next.js pages/routes:
- nextjs-app-router-patterns → Layouts, loading/error boundaries, parallel routes, server actions

### When writing a MongoDB query:
- mongodb-query-optimizer → Index design, explain()
- mongodb-natural-language-querying → Query patterns, validation

### When designing a collection:
- mongodb-schema-design → Embed vs reference, validation, patterns

### When building search:
- mongodb-search-and-ai → Index types, query patterns, hybrid search

### When building API routes:
- api-security-best-practices → Input validation, auth, rate limiting, CORS
- vercel-react-best-practices → async-api-routes, server-auth-actions

### When building Chrome extension:
- chrome-extension-development → MV3, content scripts, service workers, permissions

### When setting up infrastructure:
- mongodb-connection → Pool config, singleton pattern
- mongodb-mcp-setup → Env var management

### When designing UI:
- web-design-guidelines → Visual direction, hierarchy, typography
- tailwind-design-system → Token system, consistent spacing/colors
