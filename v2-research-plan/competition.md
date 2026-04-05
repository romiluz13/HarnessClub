# Competitive Landscape — AI Agent Skills & Config Management (April 2026)

## Market Overview

The AI agent skills ecosystem exploded from 0 → 733K+ indexed skills in under 6 months.
Every major player (Microsoft, Google, Vercel, Anthropic, GitHub, Expo) is publishing skills.
The market is splitting into: **open directories**, **enterprise registries**, and **cross-tool distributors**.

---

## 1. skills.sh (Vercel Labs) — THE INCUMBENT

| Attribute | Details |
|-----------|---------|
| URL | https://skills.sh |
| Total Skills | 91,490 (all-time installs tracked) |
| CLI | `npx skills add <owner/repo@skill>` |
| Backed By | Vercel (built by Vercel Labs) |
| Open Source | Yes — GitHub-based repos |
| Pricing | Free |
| Enterprise | ❌ None |

### What They Do Well
- **Beautiful UI** — ASCII art hero, leaderboard, clean dark theme
- **Brand power** — Vercel name = instant credibility
- **Official section** — curated "official" skills from Anthropic, Microsoft, Google, etc.
- **Audits section** — security reviews of popular skills (NEW)
- **CLI simplicity** — one command install: `npx skills add vercel-labs/agent-skills@react-best-practices`
- **Leaderboard** — all-time + 24h trending, gamifies publishing
- **Install tracking** — every skill shows install count

### What They DON'T Do
- ❌ No team/org management
- ❌ No RBAC, SSO, SCIM
- ❌ No private registries
- ❌ No cross-tool support (Claude Code only via npx skills)
- ❌ No versioning UI (relies on GitHub)
- ❌ No API for programmatic access
- ❌ No search (just a leaderboard)
- ❌ No enterprise features whatsoever

### Steal
- Leaderboard / trending concept
- Audit/security review section
- "Official" curated tier
- ASCII aesthetic (brand differentiation)

---

## 2. localskills.sh — THE ENTERPRISE CHALLENGER

| Attribute | Details |
|-----------|---------|
| URL | https://localskills.sh |
| CLI | `npm i -g @localskills/cli` (`localskills` command) |
| Tools Supported | 8: Cursor, Claude Code, Windsurf, Cline, Copilot, Codex, OpenCode, Aider |
| Pricing | Free tier + Teams + Enterprise (pricing not public) |
| Stage | Public Beta |

### What They Do Well
- **8 tools supported** — biggest cross-tool coverage (Cursor, Claude Code, Windsurf, Cline, Copilot, Codex, OpenCode, Aider)
- **Full enterprise stack** — SSO (SAML 2.0), SCIM 2.0, RBAC (4 roles: owner/admin/member/view-only)
- **API tokens** — 256-bit entropy, hashed storage, revocable (for CI/CD)
- **Audit logging** — every action logged, 90-day retention
- **Visibility controls** — public, private, unlisted
- **Versioning** — every publish = new version, rollback from dashboard
- **Analytics** — download tracking by source, daily trends
- **Anonymous sharing** — Ed25519 keypair for quick shares (limit 10)
- **Team dashboard** — web UI for team management

### What They DON'T Do
- ❌ No marketplace/discovery (publish-only, not browse)
- ❌ No semantic search
- ❌ No skill categories or curation
- ❌ No security audits/reviews
- ❌ No department-level organization (flat teams only)
- ❌ No plugin support (skills and rules only, no agents/hooks/MCP bundling)
- ❌ Pricing not transparent

### Steal
- SAML 2.0 + SCIM 2.0 integration pattern
- 4-role RBAC model (owner/admin/member/view-only)
- API token management with hashed storage
- Audit logging architecture
- Multi-tool CLI targeting (8 tools)
- Anonymous sharing concept (Ed25519 keypair)
- Versioning with rollback

---

## 3. SkillsMP (Skills Marketplace) — THE GITHUB CRAWLER

| Attribute | Details |
|-----------|---------|
| URL | https://skillsmp.com |
| Total Skills | 733,496 (up from 66K in Jan 2026) |
| API | REST API with API keys |
| Search | Keyword + AI semantic search (Cloudflare AI) |
| Open Source | Partially (MCP server is open source) |

### What They Do Well
- **Massive scale** — 733K+ skills indexed from GitHub
- **Category taxonomy** — Tools (175K), Business (131K), Development (119K), Data & AI (75K), Testing (73K), DevOps (61K), Content (46K), Research (25K), Blockchain (7K)
- **AI semantic search** — powered by Cloudflare AI embeddings
- **REST API** — programmatic access with API keys (500 req/day)
- **MCP server** — search skills from within Claude Code
- **Occupation-based filtering** — filter by role/job function
- **Star count filtering** — trust signal from GitHub
- **Manus integration** — "Run any Skill in Manus with one click"

---

## 4. SkillsGate — THE TRUST-FOCUSED INDEXER

| Attribute | Details |
|-----------|---------|
| URL | skillsgate.dev (likely) |
| Total Skills | 60,000+ indexed (150K+ waiting) |
| Focus | Discovery + Trust/Security |
| Search | Semantic search (vector embeddings) |

### What They Do Well
- **Security focus** — trust scores, security metadata enrichment
- **LLM-enriched metadata** — skills indexed with AI-generated descriptions
- **Semantic search** — vector embeddings for natural language queries
- **Transparency** — shows what you're actually installing

### What They DON'T Do
- ❌ No enterprise features
- ❌ No team management
- ❌ Smaller index than SkillsMP
- ❌ No cross-tool distribution

### Steal
- Trust/security scoring concept
- LLM-enriched metadata for better searchability

---

## 5. SkillsHub (comeonoliver) — THE OPEN REGISTRY

| Attribute | Details |
|-----------|---------|
| Total Skills | 5,900+ |
| Search | BM25 scoring (upgraded from TF-IDF) |
| Rate Limiting | Upstash Redis |
| Features | SKILL.md export, bilingual docs (EN/CN) |

### What They Do Well
- **BM25 search** — better relevance than TF-IDF
- **Rate limiting** — production-ready with Upstash Redis
- **Featured skill packs** — curated collections
- **SKILL.md export** — bulk export format

### What They DON'T Do
- ❌ Everything enterprise
- ❌ Small scale
- ❌ No cross-tool support

---

## 6. Other Notable Players

### Braid ($125/mo)
- Cross-agent prompt distribution
- Works across Claude Code, Cursor, Windsurf
- Focus on "rules" not skills
- Enterprise pricing but limited features

### RuleSync
- Sync CLAUDE.md across repos
- GitHub App integration
- Very narrow scope (just CLAUDE.md files)

### PRPM (7,500+ skills)
- "Universal" registry
- Cross-tool install
- Smaller player

### Universal Skills Manager (jacob-bd)
- Multi-source aggregator (SkillsMP + SkillHub + ClawHub)
- 10 AI tools supported
- Cross-tool sync status reporting
- Shows the market wants aggregation

### SkillSync MCP (adityasugandhi)
- MCP server for SkillsMP
- **60+ security threat patterns** — prompt injection, reverse shells, credential theft
- Only tool that gates installation behind security scan
- Shows security-first approach has demand

---

## COMPETITIVE MATRIX

| Feature | skills.sh | localskills | SkillsMP | SkillsGate | Us (Target) |
|---------|-----------|-------------|----------|------------|-------------|
| Total Skills | 91K | ? | 733K | 60K | TBD |
| Cross-Tool | ❌ | ✅ 8 tools | ❌ | ❌ | ✅ 10+ tools |
| SSO/SAML | ❌ | ✅ | ❌ | ❌ | ✅ |
| SCIM | ❌ | ✅ | ❌ | ❌ | ✅ |
| RBAC | ❌ | ✅ 4 roles | ❌ | ❌ | ✅ dept-scoped |
| Audit Logs | ❌ | ✅ | ❌ | ❌ | ✅ |
| Semantic Search | ❌ | ❌ | ✅ | ✅ | ✅ (Voyage AI) |
| Security Audit | ✅ (new) | ❌ | ❌ | ✅ | ✅ |
| Private Registry | ❌ | ✅ | ❌ | ❌ | ✅ |
| API Access | ❌ | ✅ | ✅ (limited) | ❌ | ✅ |
| Plugin Support | ❌ | ❌ | ❌ | ❌ | ✅ |
| Agents/Hooks/MCP | ❌ | ❌ | ❌ | ❌ | ✅ |
| Department Org | ❌ | ❌ | Category only | ❌ | ✅ |
| Multi-Dept (non-dev) | ❌ | ❌ | ❌ | ❌ | ✅ |
| Marketplace Protocol | ❌ | ❌ | ❌ | ❌ | ✅ (Claude native) |
| Pricing | Free | Freemium | Free | Free | Enterprise SaaS |

---

## KEY INSIGHT: THE GAP

**Nobody combines ALL of these:**
1. Enterprise governance (SSO + SCIM + RBAC + Audit) — only localskills has this
2. Discovery & search (semantic + categories) — only SkillsMP has scale
3. Security auditing — only skills.sh and SkillsGate touch this
4. Cross-tool distribution — only localskills has breadth (8 tools)
5. Beyond skills (plugins, agents, hooks, MCP) — NOBODY does this
6. Beyond developers (sales, product, legal, marketing) — NOBODY does this
7. Claude Code native marketplace protocol — NOBODY uses this

**Our position: the ONLY platform that does 1-7 together.**
