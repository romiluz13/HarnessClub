# OSS Release Roadmap Implementation Plan

> **For Claude:** REQUIRED: Follow this plan task-by-task using TDD where code changes are made.
> **Design:** See `docs/plans/2026-04-05-oss-release-design.md` for full specification.

**Goal:** Ship a trustworthy open-source release of the agent configuration platform that works out of the box on supported MongoDB environments.

**Architecture:** Keep the existing asset-registry architecture, but stabilize it first. The work is organized into four tracks: stabilization, OSS DX, platform completion, and release readiness. Differentiation work is intentionally deferred until the core product is secure and installable.

**Tech Stack:** Next.js 16, React 19, MongoDB, Atlas Search / Vector Search, Auth.js, Vitest, Docker/Atlas local tooling.

**Prerequisites:** Existing asset model, onboarding flow, org/team hierarchy, marketplace/export engine, versioning, approvals, and context folder.

---

## Relevant Codebase Files

### Patterns to Follow
- `src/types/asset.ts` - polymorphic asset model and current supported asset types
- `src/services/asset-service.ts` - asset creation/update/searchText/embedding flow
- `src/services/version-service.ts` - current versioning model
- `src/services/approval-service.ts` - current approval state model
- `src/services/copilot/memory-service.ts` - existing short-term conversation memory pattern

### High-Risk API Surfaces
- `src/app/api/assets/route.ts` - asset create/list contract
- `src/app/api/assets/[id]/route.ts` - asset read/write/delete authz
- `src/app/api/assets/[id]/versions/route.ts` - version history access
- `src/app/api/approvals/route.ts` - approval request listing/creation
- `src/app/api/approvals/[requestId]/review/route.ts` - approval review actions
- `src/app/api/orgs/[orgId]/sso/route.ts` - SSO API contract
- `src/app/dashboard/settings/sso/page.tsx` - broken SSO UI contract
- `src/app/api/search/route.ts` - “multi-team” search behavior

### OSS Setup / Docs / Packaging
- `README.md`
- `CONTRIBUTING.md`
- `.env.example`
- `docker-compose.yml`
- `docker-compose.atlas-local.yml`
- `extension/manifest.json`
- `extension/background.js`

### Related Context
- `context/STATE.md`
- `context/DECISIONS.md`
- `context/GOTCHAS.md`
- `context/phases/phase-15-launch.md`

## Phase 1: Stabilization and Trust Floor

### Outcome

The platform is secure enough and internally consistent enough to deserve continued release work.

### Tasks

1. Fix route-level authorization gaps in team member management, asset mutation, version history, approvals, org-scoped reads, and token revocation.
2. Fix broken UI/API contracts, starting with SSO and create-asset.
3. Make lint, typecheck, and build truthful release gates.
4. Align test expectations with actual supported behavior.

### Exit Criteria

- `eslint` passes
- `tsc --noEmit` passes
- `vitest` passes
- build passes without hidden environment/runtime errors
- top authz findings are closed

### Complexity

**High**, because the work crosses auth, API design, and release trust.

## Phase 2: OSS Installation and Developer Experience

### Outcome

A stranger can clone the repo and get to a working first run without archaeology.

### Tasks

1. Define and document supported environment tiers: Atlas cloud, local Atlas, plain Mongo fallback.
2. Replace the misleading “recommended Docker” story with a truthful setup matrix.
3. Add setup scripts or a doctor command for env validation and first-run checks.
4. Add deterministic seed/bootstrap flows for organization, team, and initial admin.
5. Add a clear support matrix for search, vector search, copilot, and extension support.

### Exit Criteria

- README quick start is truthful
- CONTRIBUTING matches actual commands
- env setup is validated before runtime failure
- first-run flow is documented for both Atlas cloud and local Atlas

### Complexity

**Medium**, but extremely high leverage.

## Phase 3: Platform Completion

### Outcome

The product fully delivers on the “agent harness/configuration hub” promise without major conceptual holes.

### Tasks

1. Decide which concepts become first-class assets for OSS 1.0:
   - prompts
   - templates
   - tools
   - policies
2. Promote the chosen concepts into the asset model and UI intentionally, not all at once.
3. Make harness bundles a first-class user concept instead of only implied combinations of assets.
4. Strengthen marketplace and export metadata around compatibility, provenance, and trust.
5. Decide whether the extension is part of 1.0 or deferred until its auth/bootstrap flow is complete.

### Exit Criteria

- asset model reflects the actual product story
- no critical product concept lives only as a hidden string field or code constant
- marketplace/export/install surfaces reflect the final supported asset vocabulary

### Complexity

**Medium to High**, depending on how many new first-class concepts are included in 1.0.

## Phase 4: Release Kit and OSS Polish

### Outcome

The repository feels complete, maintained, and safe to adopt.

### Tasks

1. Rewrite README around real install paths and real capabilities.
2. Add architecture docs and feature support matrix.
3. Add browser smoke-check guidance for main flows.
4. Add demo org/team/harness fixtures for screenshots and first-run value.
5. Add release checklist for tags, changelog, and compatibility notes.
6. Ensure naming is stable before public release.

### Exit Criteria

- docs match code
- screenshots and examples are reproducible
- release checklist exists and is realistic
- the repo is understandable without reading chat history

### Complexity

**Medium**.

## Phase 5: Post-1.0 Differentiation

### Outcome

The project evolves from “good OSS registry” into the control-plane direction with real differentiation.

### Tasks

1. Add release gates: draft, review, eval, release, rollback.
2. Add replayable trace/eval workspace.
3. Add governed memory promotion with provenance, scope, TTL, and approvals.
4. Add stronger policy semantics around MCP/tool usage and promotion.

### Exit Criteria

- differentiation is built on a trustworthy base
- control-plane features are additive, not compensating for broken fundamentals

### Complexity

**High**.

## Risk Assessment

| Risk | Probability | Impact | Score | Mitigation |
|------|-------------|--------|-------|------------|
| Shipping with broken authz | 4 | 5 | 20 | Make stabilization the first gate |
| Misleading OSS setup claims | 5 | 4 | 20 | Define environment tiers and rewrite setup/docs |
| Overbuilding first-class concepts too early | 3 | 4 | 12 | Promote only the minimum concepts needed for 1.0 |
| Local Atlas preview drift | 3 | 3 | 9 | Keep Atlas cloud as primary supported path |
| Extension consuming roadmap time without launch value | 4 | 3 | 12 | Make extension optional unless core bootstrap is complete |

## Validation Levels

### Level 1: Syntax and style
- `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run lint`
- `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npx tsc --noEmit`

### Level 2: Unit and integration
- `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH bun run vitest run`

### Level 3: Environment verification
- Atlas cloud setup walkthrough
- local Atlas setup walkthrough
- plain Mongo fallback limitations verified and documented

### Level 4: Manual product walkthrough
- sign in
- create org/team
- create/import asset
- review/version/publish asset
- search asset
- export asset
- open marketplace endpoint

## Recommended Execution Order

1. Phase 1 first
2. Phase 2 second
3. Reassess 1.0 scope before Phase 3
4. Treat Phase 4 as mandatory, not optional polish
5. Do not start Phase 5 until the OSS release is honestly shippable
