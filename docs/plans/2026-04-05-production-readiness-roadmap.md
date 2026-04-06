# Production Readiness Roadmap

**Date:** 2026-04-05
**Status:** Active
**Audience:** Maintainers shipping OSS 1.0 of AgentConfig

## North Star

Ship an **open-source, self-hosted agent configuration and harness hub** that:

1. installs honestly
2. works safely out of the box on supported MongoDB environments
3. feels internally coherent across UI, API, docs, and extension surfaces
4. leaves room for real differentiation without overengineering the 1.0 release

This roadmap assumes the registry foundation is real and worth keeping. The work now is about making it **trustworthy, installable, and strategically sharp**.

## Definition of Done for OSS 1.0

OSS 1.0 is not “done” when only CI is green. It is done when all of the following are true:

- `lint`, `typecheck`, `tests`, and `build` pass
- no high-severity authz or secret-handling findings remain
- the main user flows work end-to-end on the documented supported environments
- docs, env files, extension setup, and route contracts match the actual product
- a first-time maintainer can understand what is supported, what is degraded, and what is intentionally deferred

## Gate 1: Trust Floor

### Goal

Remove the blockers that make the product unsafe, misleading, or operationally brittle.

### Scope

#### Security and runtime correctness
- fix silent scoped conversation save failures in copilot memory
- make auth provider availability visible in the sign-in UX
- replace or re-scope process-local proxy rate limiting claims
- finish remaining authz review for org-scoped and team-scoped routes
- verify private/read-sensitive surfaces stay protected: versions, approvals, SSO, audit, org settings

#### Contract truthfulness
- remove remaining legacy `/dashboard/skills` drift from UI routes, redirects, tests, and docs
- verify search semantics match route naming and UI language
- confirm extension request formats match API contracts
- verify page-level optimistic claims against real route behavior

#### Validation discipline
- add a release script or checklist that runs:
  - lint
  - typecheck
  - tests
  - build
  - targeted smoke checks for sign-in, onboarding, create/import asset, approval review, search, export

### Exit Criteria

- no open P0 issues
- no known silent data-loss paths
- no major runtime/setup mismatch hidden behind green CI
- route comments and docs stop overstating security guarantees

### Complexity

**High**, because this cuts across auth, runtime behavior, and product truth.

## Gate 2: OSS Installability

### Goal

Make the app genuinely usable by a stranger without chat history or private tribal knowledge.

### Scope

#### Supported environment matrix
- document and support:
  - **Tier A:** Atlas cloud
  - **Tier B:** local Atlas deployment
  - **Tier C:** plain Mongo fallback with explicit feature degradation

#### First-run experience
- add env validation / doctor command
- verify `.env.example` is complete and truthful
- add deterministic seed/bootstrap path
- document extension setup against a local or hosted AgentConfig instance
- document search/vector prerequisites and degraded fallback behavior

#### Documentation alignment
- rewrite README quick start
- align CONTRIBUTING, docs site, and setup scripts
- add “what works where” matrix for search, embeddings, copilot, extension, marketplace, and export

### Exit Criteria

- a maintainer can clone, configure, run, and sign in on a supported environment without guesswork
- README no longer implies plain Docker + plain Mongo delivers full feature parity
- extension setup is documented and honest

### Complexity

**Medium**, with very high leverage.

## Gate 3: Platform Completion

### Goal

Finish the product story you already started, without turning 1.0 into a giant rewrite.

### Scope Decisions

Promote only the highest-value partial concepts into first-class product surfaces for OSS 1.0.

#### Strong candidates
- **templates** as editable managed assets or at least explicit harness presets
- **harness bundles** as first-class user-facing concepts rather than implied collections of assets
- **prompts** if they are clearly needed to complete the agent harness story

#### Likely defer unless very clean
- full first-class tool registry
- full policy engine
- heavyweight release orchestration

#### Existing surfaces to finish
- marketplace compatibility/provenance metadata
- export/install trust metadata
- naming consistency across “assets”, “harnesses”, “skills”, and “plugins”

### Exit Criteria

- no core product concept is only explained verbally while hidden in string fields or code constants
- the UI tells a coherent story about what AgentConfig manages
- export/marketplace/install semantics reflect the real first-class vocabulary

### Complexity

**Medium to High**, depending on how many concepts are promoted before 1.0.

## Gate 4: Release Kit

### Goal

Make the repo feel complete, maintained, and credible the first time someone sees it.

### Scope

- polished README with screenshots and support matrix
- architecture doc for asset model, search modes, auth model, and deployment tiers
- reproducible demo harnesses / starter orgs
- manual smoke checklist
- changelog + release checklist
- stable public naming before launch

### Exit Criteria

- first-time readers can understand the product and run it without opening chat logs
- release artifacts are reproducible
- the repo looks like a maintained OSS project, not a private experiment

### Complexity

**Medium**.

## Post-1.0 Differentiation

### Goal

Become the most innovative system in this landscape by adding the right missing layer, not the biggest pile of features.

### Strategic Thesis

The strongest wedge is still an **agent control plane**:

- release gates
- replay/evals
- governed memory
- stronger MCP/tool/policy semantics

### Rules

- do not start here while Gate 1 or Gate 2 is incomplete
- build differentiation on top of a trustworthy OSS base
- prefer leverage over surface area

### Best Candidates

1. **Release states for assets/harnesses**
   - draft
   - review
   - approved
   - released
   - rolled back
2. **Replay and eval attachments**
   - trace links
   - approval evidence
   - regression comparison
3. **Governed memory**
   - memory candidates
   - promote to team/org memory
   - provenance
   - TTL
   - deletion/forget flows

## Concrete Execution Queue

### Batch A: Fix now
- copilot scoped save no-op
- provider-aware sign-in/install UX
- hydration-safe sidebar collapse state
- proxy/rate-limit deployment truth and docs
- remaining `/dashboard/skills` naming drift audit

### Batch B: Trust audit completion
- review org-scoped routes for existence-vs-authorization drift
- review extension request/response contracts against current routes
- verify search route semantics, team scoping, and UI wording
- add manual smoke checklist to release gate

### Batch C: OSS setup
- README rewrite
- support matrix
- env doctor
- deterministic seed/bootstrap flow
- local Atlas / Atlas cloud docs

### Batch D: 1.0 scope lock
- decide whether prompts become first-class now
- decide whether templates/harness bundles become first-class now
- decide whether extension is in 1.0 or “best-effort preview”

### Batch E: Release kit
- screenshots
- examples
- changelog
- contributor docs
- launch checklist

## What We Are Explicitly Not Doing Yet

- full hosted SaaS
- billing
- giant orchestration runtime
- massive policy engine
- every possible first-class asset type in one release

## Success Criteria

If this roadmap works, the first public reaction should be:

- “This actually installs”
- “The model is clear”
- “The security story is not fake”
- “This is the right foundation for agent harnesses”

Only after that do we earn the right to become the most innovative layer in the space.
