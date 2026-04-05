# OSS Release Design

**Date:** 2026-04-05
**Status:** Proposed
**Scope:** Open-source-first release planning for the agent configuration platform

## Product Definition

This product is an **open-source hub for agent configuration and harness management**.

It stores, versions, searches, reviews, exports, and publishes the building blocks teams use to run AI-assisted work:

- skills
- rules
- agents
- MCP configs
- hooks
- settings bundles
- plugin bundles

The platform is not a model runtime, not an AI gateway, and not a generic observability vendor. It is the system of record and control surface for configuration assets and harnesses.

## Release Goal

Ship a version that any technical team can clone, configure, and run reliably with either:

1. **MongoDB Atlas cloud** for full feature parity
2. **Local Atlas-style deployment** for serious local development

The OSS release must work honestly, not aspirationally. If a capability requires Atlas Search, Vector Search, local Atlas, or preview features, the docs and setup must say so clearly.

## User Promise

The first OSS release should let a team:

1. start the app locally without hidden setup traps
2. sign in and create an organization
3. invite teammates
4. import or create assets
5. version and review changes
6. publish approved assets to a marketplace endpoint
7. export assets to supported tools
8. search assets successfully in the supported environments

## Core Design Principles

### 1. Truth over breadth

Do not claim support that depends on broken flows, undocumented preview features, or half-wired contracts.

### 2. OSS-first, not SaaS-first

Prioritize local/cloud setup, deterministic seeds, docs, env validation, and a clean self-hosted path before SaaS concerns like billing or hosted multi-tenancy polish.

### 3. Registry first, control plane second

The codebase already has a real asset registry. The next release should first make that registry trustworthy and complete before expanding into heavier “agent control plane” concepts.

### 4. Use official sources for unstable tech

For post-2024 and rapidly moving technologies, roadmap and setup decisions must use live official docs, not model memory.

## Supported Environment Tiers

### Tier A: Atlas cloud

Recommended for the first production-quality OSS experience.

Why:
- clearest path to Atlas Search and Vector Search
- closest to real production behavior
- easiest support story

### Tier B: Local Atlas deployment

Recommended for advanced local development and search-heavy feature work.

Why:
- closest local approximation of Atlas Search/Vector Search behavior
- useful for hybrid search, rank fusion, and local development loops

### Tier C: Plain MongoDB fallback

Allowed only as a degraded path for partial development.

Rules:
- do not market it as feature parity
- docs must clearly call out limitations
- tests and setup must indicate which features are unavailable or downgraded

## In Scope for OSS 1.0

- secure asset CRUD
- secure team/member/org flows
- truthful local/cloud setup
- import/export stability
- marketplace publishing
- version history and approvals that actually work
- onboarding and seeded starter harnesses
- documentation that matches the repo
- extension only if it is functional and supportable

## Explicitly Out of Scope for OSS 1.0

- hosted SaaS operations
- billing
- full enterprise SSO/SCIM polish beyond working core paths
- first-class governed long-term memory
- replayable eval workspace
- full policy engine
- full agent runtime/orchestration layer

## Product Gaps To Close Before 1.0

### Security and trust gaps

- route-level RBAC is inconsistent
- approval routes trust caller-supplied ids too much
- version history access is under-protected
- some org-scoped routes check existence rather than authorization

### Product correctness gaps

- SSO UI and API contract are mismatched
- create-asset flow and some dashboard naming/routes drift
- multi-team search is not actually multi-team
- extension auth/bootstrap flow is incomplete

### OSS DX gaps

- README and scripts overstate what plain Docker + Mongo supports
- validation commands are incomplete or inconsistent
- install path is not yet deterministic enough for first-time adopters

### Platform completion gaps

- prompts are not first-class
- tools are not first-class
- policies are not first-class
- templates are code constants, not managed assets

## Recommended Roadmap Shape

### Phase 1: Stabilization

Fix trust and correctness first.

### Phase 2: OSS installation and developer experience

Make setup and docs deterministic for Atlas cloud and local Atlas.

### Phase 3: Platform completion

Promote the most important partial concepts into properly modeled product surfaces.

### Phase 4: Release kit

Ship docs, demo data, smoke checks, and packaging as if strangers will judge the repo by first-run experience.

### Phase 5: Post-1.0 differentiation

Build release gates, replay/evals, and governed memory only after the foundation is trustworthy.

## Official Sources Used

- MongoDB Atlas local deployment docs: [mongodb.com](https://www.mongodb.com/docs/atlas/cli/current/atlas-cli-deploy-local/)
- MongoDB automated embedding docs: [mongodb.com](https://www.mongodb.com/docs/atlas/atlas-vector-search/crud-embeddings/create-embeddings-automatic/)
- MCP Registry docs: [modelcontextprotocol.io](https://modelcontextprotocol.io/registry/about)
- OpenAI trace grading docs: [developers.openai.com](https://developers.openai.com/api/docs/guides/trace-grading)
