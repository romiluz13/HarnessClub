# Built-In Copilot — Platform AI Agent Research (April 2026)

## THE IDEA
Our platform doesn't just STORE agent configs — it has an AI agent BUILT IN that helps users:
1. Discover the right assets for their needs
2. Compose department harnesses (bundles of skills + rules + agents + MCP + settings)
3. Generate custom SKILL.md / CLAUDE.md / rules from natural language descriptions
4. Translate configs between tools (Claude Code → Cursor → Copilot → Windsurf)
5. Onboard new team members with guided setup
6. Review/audit existing configs for quality and security

## THREE VIABLE APPROACHES TO BUILD IT

### Option 1: Claude Agent SDK (TypeScript)
```bash
npm install @anthropic-ai/claude-agent-sdk
```
- **What**: Claude Code's full autonomous agent loop as a library
- **Powers**: File read/write, bash execution, tool use, subagents
- **Key Feature**: Can load our platform's own skills and plugins via `settingSources`
- **Subagents**: Can spawn specialized sub-agents (e.g., "security reviewer", "format translator")
- **API**: `query()` function with streaming, max_turns, custom tools
- **Cost**: Requires Anthropic API key (cannot use claude.ai subscription for third-party products)
- **V2 Preview**: Simplified `send()` and `stream()` patterns available

**Why this fits**: Our copilot IS a Claude Code agent that has our platform's SKILL.md files loaded.
It knows how to search, compose, and recommend because WE wrote the skills for it.
The agent runs in our Next.js backend via the TypeScript SDK.

### Option 2: OpenCode (Go-based, model-agnostic)
```bash
brew install opencode
```
- **What**: Open-source terminal AI coding agent, 101K+ GitHub stars
- **75+ providers**: OpenAI, Anthropic, Google, Ollama, local models
- **Agent system**: `opencode agent create/list` — define agents with system prompts + tools
- **Skills support**: Reads .claude/ skills + AGENTS.md natively
- **ACP support**: Agent Client Protocol — can run inside editors
- **Key insight**: `OPENCODE_DISABLE_CLAUDE_CODE=true` env var = it reads Claude configs!

**Why this fits**: If we want model-agnostic copilot, OpenCode lets users bring their own API key.
But we lose the deep Claude Code integration.

### Option 3: Pydantic AI (Python, type-safe)
```bash
pip install pydantic-ai
```
- **What**: Python agent framework from the Pydantic team
- **Capabilities**: Composable bundles of tools + hooks + instructions (like our "department harnesses"!)
- **MCP + A2A**: Built-in Model Context Protocol and Agent-to-Agent support
- **Durable execution**: Temporal/DBOS/Prefect for long-running agents
- **Type safety**: Full Pydantic validation on all boundaries
- **Deep agents**: Autonomous multi-step with planning + file ops + delegation

**Why this fits**: If our backend moves to Python or we want durable agent workflows.
The "capabilities" concept maps perfectly to our department harnesses.

## RECOMMENDATION: Claude Agent SDK (Option 1)

### Why
1. **We're already Next.js/TypeScript** — no Python backend needed
2. **It loads our own skills** — `settingSources: ["project"]` picks up our SKILL.md files
3. **Subagents** — we can define specialized agents for different copilot tasks
4. **Plugin support** — `plugins: ["/path/to/our-plugin"]` loads our custom functionality
5. **Same ecosystem** — our platform distributes Claude Code configs, our copilot IS Claude Code

### Architecture
```
User types: "Set up my sales team's AI environment"
    ↓
Platform Copilot (Claude Agent SDK)
    ├── Loads platform skills: search-assets, compose-harness, translate-format
    ├── Searches our MongoDB asset registry (via MCP server connected to our DB)
    ├── Finds: SDR skills, outreach agents, CRM MCP configs, sales CLAUDE.md templates
    ├── Composes a "Sales Department Harness" bundle
    ├── Generates install commands for each team member's tool (Claude Code, Cursor, etc.)
    └── Returns: Ready-to-deploy department config package
```

### Cost Model
- API key per organization (they bring their own Anthropic key)
- OR we proxy through our account and bill per usage
- OR free tier with limited queries, paid tier for unlimited

---

## DEPARTMENT HARNESS CONCEPT (Validated by Community)

### Someone Already Built This! (Reddit: r/ClaudeCode)
A user built 30 SKILL.md files organized into 5 business teams:
- **Sales**: SDR, BDR, bid-writer, sales-enablement, account-manager, sales-ops
- **Marketing**: campaign-manager, conversion-copywriter, email-marketing, SEO, social-media, brand
- **Finance**: budget-analyst, cashflow, bookkeeper, accounts-assistant, management-accountant
- **Content**: content-writer, brand-strategist, content-marketing-manager
- **Research**: market-researcher, competitive-analyst

### What a Department Harness Actually Contains
A complete "harness" for a department is NOT just skills. It's:

| Asset Type | Example for Sales Team |
|------------|----------------------|
| **Skills** | SDR playbook, outreach writing, call prep, deal analysis |
| **Agents** | Account researcher, email composer, CRM updater |
| **CLAUDE.md** | Sales methodology, CRM conventions, communication standards |
| **Rules** | Email formatting rules, data handling for PII, CRM field standards |
| **MCP Servers** | Salesforce MCP, HubSpot MCP, LinkedIn MCP, Outreach MCP |
| **Settings** | Allowed tools, model preferences, cost limits |
| **Hooks** | Auto-log calls to CRM, auto-format emails before send |
| **Plugins** | Complete sales plugin bundle with all above |

### Also Found: 204-Skill Library Across 13 Departments (borghei/Claude-Skills)
- engineering/ (61 skills + 177 Python tools)
- marketing/ (35 skills + 106 Python tools)
- product-team/ (8 skills)
- c-level-advisor/ (26 skills)
- compliance/ (21 skills)
- business-growth/ (17 skills)
- hr-operations/ (4 skills)
- sales-success/ (5 skills)
- finance/ (1 skill)
- 11 production agents

This proves the multi-department model works and has demand.

---

## ALSO FOUND: Sundial Hub (sundialhub.com)
New competitor — open registry with:
- Security scans on publish
- Versioning
- `npx sundial-hub push` one-command publishing
- `Read https://sundialhub.com/raw/<author>/<skill>` — direct URL for agents to read
- Claims "largest open registry" but directory shows empty (just launched?)
- Has "Assistants" concept separate from skills

**ADD TO COMPETITION.md**: New entrant, security-first, but seems very early stage.
