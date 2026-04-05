# Claude Code Configuration Ecosystem — Current State (April 2026)

## CONFIRMED: Docs Navigation Structure (from docs.anthropic.com)

The official docs organize Claude Code into these sections:
- **Agents**: sub-agents, agent-teams
- **Tools and plugins**: MCP, discover-plugins, plugins (create), **skills**
- **Automation**: hooks-guide, channels, scheduled-tasks, headless

### CRITICAL: Slash Commands → Skills (REDIRECT CONFIRMED)
The docs have a permanent redirect: `/en/slash-commands` → `/en/skills`
**Old "slash commands" (.claude/commands/) are now called "skills".**
The concept didn't die — it got renamed and promoted.

---

## ALL 14 CONFIGURABLE ASSET TYPES (Confirmed Active)

### Layer 1: Instructions & Rules

#### 1. CLAUDE.md (Memory Files)
- **Location**: Root, any subfolder, parent directories (up to 5 levels)
- **Scope**: Auto-loaded on every conversation, folder-scoped
- **Purpose**: Project instructions, coding standards, conventions
- **Hierarchy**: User `~/.claude/CLAUDE.md` → Project root → Subfolder → Parent chain
- **Enterprise**: Managed CLAUDE.md via MDM (`/Library/Application Support/ClaudeCode/CLAUDE.md`)
- **Status**: ✅ ACTIVE — core feature, heavily used

#### 2. Rules (.claude/rules/*.md)
- **Location**: `.claude/rules/` directory
- **Format**: Markdown with YAML frontmatter for `globs` and `alwaysApply`
- **Scope**: Path-specific rules (e.g., only for `*.test.ts` files)
- **Purpose**: Scoped coding standards, per-pattern instructions
- **Status**: ✅ ACTIVE — primary way to add scoped instructions

### Layer 2: Skills & Agents

#### 3. Skills (SKILL.md)
- **Location**: `.claude/skills/*/SKILL.md` or `~/.claude/skills/*/SKILL.md`
- **Format**: Markdown with description, triggers, instructions
- **Install**: `npx skills add <owner/repo@skill>` or via plugins
- **Purpose**: Reusable procedural knowledge — teaches agent HOW to do things
- **Ecosystem**: 91K+ on skills.sh, 733K+ on SkillsMP
- **Status**: ✅ ACTIVE — THE primary extensibility mechanism

#### 4. Agents / Sub-agents (.claude/agents/*.md)
- **Location**: `.claude/agents/` directory (project) or `~/.claude/agents/` (user)
- **Format**: Markdown defining agent persona, tools, and capabilities
- **Invoked**: Automatically by Claude Code when matching task detected
- **Features**: Custom tool permissions, specialized personas, team composition
- **Status**: ✅ ACTIVE — growing, supports "agent teams"

#### 5. Commands (.claude/commands/*.md) — LEGACY, USE SKILLS
- **Location**: `.claude/commands/` directory
- **Format**: Markdown with `$ARGUMENTS` placeholder
- **Invoked**: Via `/command-name` in Claude Code prompt
- **Status**: ⚠️ LEGACY — official SDK docs say: "commands/ is a legacy format. Use skills/ for new plugins"
- **NOTE**: Still works for backward compat but ALL new development should use skills/
- **SOURCE**: docs.claude.com/en/api/agent-sdk/plugins confirms this explicitly

### Layer 3: Plugins & Marketplace

#### 6. Plugins (Major Feature — Public Beta)
- **What**: Bundled packages of skills + agents + hooks + MCP servers + LSP servers
- **Structure**: `.claude-plugin/plugin.json` manifest at root, with sibling dirs:
  ```
  my-plugin/
  ├── .claude-plugin/
  │   └── plugin.json          # Required: name, version, description
  ├── skills/                   # SKILL.md files (primary)
  │   └── my-skill/
  │       └── SKILL.md
  ├── commands/                 # Legacy: use skills/ instead
  ├── agents/                   # Custom subagent definitions (.md)
  ├── hooks/                    # hooks.json event handlers
  ├── .mcp.json                 # MCP server configurations
  └── scripts/                  # Shell scripts for automation
  ```
- **Install**: `/plugin install plugin-name@marketplace` or `--plugin-dir` for dev
- **Key Rule**: NEVER put content dirs inside `.claude-plugin/` — only plugin.json goes there
- **Official Marketplace**: `claude-plugins-official` auto-available on startup
  - Includes: figma, vercel, firebase, supabase, slack, sentry, commit-commands
- **Status**: ✅ PUBLIC BETA — THE extensibility mechanism going forward

#### 7. Plugin Marketplace (Self-Hostable)
- **Format**: `.claude-plugin/marketplace.json` in any git repo or URL
- **Protocol**: Claude Code natively discovers and installs from any marketplace
- **Commands**: `/plugin marketplace add <owner/repo>`, then `/plugin` to browse
- **Self-host**: ANY organization can host their own marketplace
- **Community**: claude-market/marketplace on GitHub (open source, curated)
- **Enterprise**: Companies can host private marketplaces with internal plugins
- **Status**: ✅ ACTIVE — this is THE distribution primitive we should build around

### Layer 4: Tool Integrations

#### 8. MCP Servers (Model Context Protocol)
- **Config**: In `.claude/settings.json` under `mcpServers` or `.mcp.json`
- **Purpose**: Connect Claude to external tools (databases, APIs, etc.)
- **Ecosystem**: 2,000+ servers on registry.modelcontextprotocol.io
- **Status**: ✅ ACTIVE — fundamental infrastructure

#### 9. Hooks (Pre/Post Tool Execution)
- **Location**: In settings or plugin config
- **Events**: PreToolUse, PostToolUse, Notification, Stop, SubagentStop
- **Purpose**: Automation triggers (lint on save, notify on error, etc.)
- **Status**: ✅ ACTIVE — powerful automation primitive

### Layer 5: Settings & Permissions

#### 10. Project Settings (.claude/settings.json)
- **Location**: `.claude/settings.json` (git-committed)
- **Controls**: Allowed/denied tools, MCP servers, model preferences
- **Status**: ✅ ACTIVE

#### 11. User Settings (~/.claude/settings.json)
- **Location**: `~/.claude/settings.json`
- **Controls**: Personal preferences, API keys, default behaviors
- **Status**: ✅ ACTIVE

#### 12. Managed Settings (Enterprise MDM)
- **Location**: `/Library/Application Support/ClaudeCode/managed-settings.json`
- **Purpose**: Organization-wide policy enforcement via MDM
- **Controls**: Can restrict tools, enforce models, set permissions
- **Status**: ✅ ACTIVE — enterprise governance

### Layer 6: Automation (NEW)

#### 13. Channels (Research Preview — v2.1.80+)
- **What**: MCP server that pushes events INTO a running Claude Code session
- **Use Cases**: CI failure alerts, webhook forwarding, monitoring alerts
- **Status**: ⚠️ RESEARCH PREVIEW — rolling out gradually, syntax may change
- **Enterprise**: Off by default on Team/Enterprise plans (admin-controlled)
- **Pairs With**: Scheduled Tasks — channels push events, tasks poll on schedule

#### 14. Scheduled Tasks (v2.1.72+)
- **Three Modes**:
  - **Cloud Tasks**: Run on Anthropic infrastructure, survive machine restarts
  - **Desktop Tasks**: Run on local machine, access local files/tools
  - **`/loop` command**: Quick polling within a session (not persistent)
- **Available On**: Pro, Max, Team, Enterprise plans
- **Use Cases**: Nightly security scans, PR babysitting, deployment polling, log analysis
- **MCP Connectors**: Tasks can use connected MCP servers (Slack, Linear, Google Drive)
- **Status**: ✅ ACTIVE — transforms Claude from tool-you-invoke to agent-that-works

#### 15. Agent SDK (Headless/Programmatic — `-p` flag)
- **CLI**: `claude -p "your task"` for non-interactive execution
- **Python/TypeScript**: Full programmatic SDKs for embedding Claude Code
- **`--bare` mode**: Skip auto-discovery (hooks, skills, plugins, MCP, memory) for CI
- **Previously called**: "headless mode" — now called "Agent SDK"
- **Use Cases**: CI/CD, cron jobs, automated code reviews, bulk refactors
- **Status**: ✅ ACTIVE — critical for enterprise automation

---

## WHAT THIS MEANS FOR OUR PLATFORM

### Every Asset Type = A Manageable, Shareable, Distributable Unit

Our platform should handle ALL 14 types, not just skills:

| Asset Type | Shareable | Enterprise Need | Priority |
|-----------|-----------|----------------|----------|
| CLAUDE.md | ✅ | CRITICAL — org coding standards | P0 |
| Rules | ✅ | HIGH — scoped standards | P0 |
| Skills | ✅ | HIGH — reusable capabilities | P0 |
| Agents | ✅ | MEDIUM — specialized workers | P1 |
| Plugins | ✅ | HIGH — full packages | P0 |
| Marketplace | ✅ | HIGH — distribution | P0 |
| MCP configs | ✅ | HIGH — tool integrations | P1 |
| Hooks | ✅ | MEDIUM — automation | P2 |
| Settings templates | ✅ | HIGH — standardization | P1 |
| Managed Settings | MDM | CRITICAL — policy | P0 |
| Managed CLAUDE.md | MDM | CRITICAL — org rules | P0 |
| Channels config | ✅ | MEDIUM — integration | P2 |
| Scheduled Tasks | ✅ | MEDIUM — automation | P2 |
| Agent SDK configs | ✅ | HIGH — CI/CD automation | P1 |

### Cross-Tool Format Translation

Our platform needs to translate between formats:
- CLAUDE.md → .cursorrules → .windsurfrules → copilot-instructions.md → AGENTS.md
- Skills → formatted for each tool's skill/rule system
- MCP configs → each tool's MCP config format
