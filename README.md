# AgentConfig

**Open-source AI agent configuration and harness management for teams.**

Manage skills, rules, agents, plugins, and MCP configs across your entire organization. Import from GitHub, export to any AI coding tool, enforce security policies, and maintain governance — all from a single platform.

## Features

- **Multi-format support** — Skills, rules, agents, plugins, MCP configs, hooks, settings bundles
- **Universal export** — Claude Code, Cursor MDC, GitHub Copilot, Windsurf, Codex
- **GitHub import** — Import configs directly from any GitHub repository
- **Semantic search** — Full-text + vector search powered by MongoDB Atlas and Voyage AI
- **Security scanning** — Base + type-specific scans (secrets, injections, unsafe commands)
- **Trust scores** — A/B/C/D grading based on content quality, provenance, and scans
- **AI Copilot** — Powered by [Pi](https://github.com/badlogic/pi-mono) agent framework with tool calling
- **RBAC** — Organization → Department → Team hierarchy with role-based permissions
- **SSO** — SAML 2.0 and OIDC with JIT provisioning and group mapping
- **SCIM** — Directory sync for automated user provisioning
- **Webhooks** — Real-time event notifications with HMAC signing
- **Compliance** — Audit logging, SIEM export, compliance reports
- **Approval workflows** — Single-review and multi-review approval gates
- **Department harnesses** — Pre-built config bundles for engineering, DevOps, sales, and more

## Quick Start

### 1. Choose your MongoDB mode

- **MongoDB Atlas (recommended for full feature parity)**: best option for hybrid/vector search and production-like behavior.
- **`mongodb-atlas-local:preview` (recommended local parity)**: use `docker-compose.atlas-local.yml` when you want Atlas Search and Vector Search locally.
- **Plain MongoDB (`mongo:7`)**: works for core CRUD/import/export flows, but Atlas Search and Vector Search features are degraded or unavailable.

### 2. Configure required environment variables

```bash
cp .env.example .env.local
```

Fill in:

- `MONGODB_URI`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

Optional but recommended:

- `VOYAGE_API_KEY` for semantic/hybrid search
- `COPILOT_*` provider variables for the AI copilot

### 3. Start your database

Atlas local preview:

```bash
docker compose -f docker-compose.atlas-local.yml up -d
```

Plain MongoDB:

```bash
docker compose up mongo -d
```

### 4. Start the app

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with GitHub, then create your organization and team.

### 5. Verify the deployment

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/v1
```

`/api/health` verifies the app and MongoDB connection. `/api/v1` exposes the public API discovery document.

## Production Notes

- This app uses Next.js standalone output. Build with `npm run build`, then run with `npm run start`.
- `npm run start` expects a completed build and uses the standalone server output.
- GitHub OAuth is required for interactive sign-in. The app can boot without OAuth, but the UI will intentionally block sign-in until the provider is configured.
- If you use plain MongoDB instead of Atlas or atlas-local, text search still works, but Atlas Search / Vector Search capabilities will not match the full product experience.

## Architecture

```
src/
├── app/              # Next.js 15 App Router
│   ├── api/          # 19 API route groups (all wired, zero dead code)
│   └── dashboard/    # Dashboard UI
├── services/         # 19 business logic services
│   ├── asset-service.ts        # CRUD + webhooks + audit
│   ├── search.ts               # Text search
│   ├── search-hybrid.ts        # Atlas Search + Vector
│   ├── security-scanner.ts     # Base security scanning
│   ├── type-scanner.ts         # Type-specific scanning
│   ├── trust-score.ts          # A-D trust grading
│   ├── supply-chain.ts         # Upstream monitoring
│   ├── sso-service.ts          # SAML/OIDC SSO
│   ├── scim-service.ts         # Directory sync
│   ├── webhook-service.ts      # Event webhooks
│   ├── compliance-service.ts   # Compliance reports
│   ├── approval-service.ts     # Approval workflows
│   ├── copilot/                # Pi-based AI agent
│   └── ...
├── lib/              # Shared utilities (db, auth, rbac)
└── types/            # TypeScript interfaces
```

**Tech stack:** Next.js 16, MongoDB, Voyage AI, Pi Agent Framework, TypeScript (strict mode)

## Testing

```bash
npm run test               # Run all tests
npm run test:live          # Real-provider copilot validation (requires live env vars)
npm run typecheck           # TypeScript check
node scripts/wiring-audit.mjs  # Verify no dead services
```

The default test suite is deterministic and contains no hidden skips. `npm run test:live` is a separate, explicit live-provider lane for Grove/OpenAI-compatible copilot validation.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, code standards, and testing requirements.

## License

Apache 2.0 — see [LICENSE](LICENSE)
