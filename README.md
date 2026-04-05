# AgentConfig

**Enterprise-grade AI agent configuration management for teams.**

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

### Option 1: Docker (recommended)

```bash
git clone https://github.com/YOUR_ORG/agentconfig.git
cd agentconfig
cp .env.example .env
# Edit .env — fill in NEXTAUTH_SECRET and GitHub OAuth credentials
docker compose up
# Visit http://localhost:3000
```

### Option 2: Local development

```bash
git clone https://github.com/YOUR_ORG/agentconfig.git
cd agentconfig
npm install
cp .env.example .env.local
# Edit .env.local — fill in required values

# Start MongoDB (local or Atlas)
docker compose up mongo -d

# Seed starter data
npx tsx scripts/seed.ts

# Start dev server
npm run dev
```

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

**Tech stack:** Next.js 15, MongoDB, Voyage AI, Pi Agent Framework, TypeScript (strict mode)

## Testing

```bash
npm run test               # Run all tests
npm run typecheck           # TypeScript check
node scripts/wiring-audit.mjs  # Verify no dead services
```

All services have integration tests with real MongoDB round-trips. The wiring audit ensures every service file is reachable from at least one API route.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, code standards, and testing requirements.

## License

Apache 2.0 — see [LICENSE](LICENSE)
