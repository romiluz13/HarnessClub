# V2 Research — Resource Index

> Master index of all extracted documentation and intelligence gathered for the V2 planning phase.
> Last updated: 2026-04-02

---

## 1. PRIMARY SOURCES (Extracted & Verified)

### 1A. Inside Claude Code: The Architecture (CandleKeep)
- **ID**: `cmnft2cot0163qh0zskpzuphq`
- **Coverage**: 21 chapters + 3 appendices, complete architectural analysis
- **Key Extractions**:
  - Ch1: Singleton state, sticky-on latch, atomic session switching
  - Ch2: Query engine — async generator, infinite loop, output token capping
  - Ch3: Context management — 5 layers (detection → micro → auto → full → session memory)
  - Ch4: System prompt — cache boundary (static/dynamic split), section framework
  - Ch5: Permission system — 7 modes, 3-step pipeline, bypass-immune paths
  - Ch6: YOLO classifier — fast path, 2-stage classification, circuit breaker
  - Ch7: Hooks — **14 hook events** (PreToolUse, PostToolUse, SessionStart, PermissionRequest, FileChanged, etc.)
  - Ch8: Tool patterns — deferred tools, synthetic output, LSP, REPL
  - Ch9: **Agent Definition Schema** — 15+ fields (type, whenToUse, tools, model, memory, isolation, background, color, criticalReminder)
  - Ch10: **Agent Sourcing Hierarchy** — 6 levels (Built-in → Plugin → User → Project → Flag → Policy)
  - Ch11: 5 built-in agents (General, Explore, Plan, Verification, Guide)
  - Ch12: Parent model agent selection — static/dynamic split for cache, "when NOT to use"
  - Ch13: **Coordinator Mode** — 4-phase workflow (Research → Synthesis → Implementation → Verification), continue vs spawn matrix
  - Ch14: Fork subagent — prompt cache sharing, "don't peek" rule
  - Ch15: **Memory system** — 3 scopes (user/project/local), remote memory for containers
  - Ch16: **Skill system** — 5 sources, conditional activation (path patterns), dynamic discovery (ancestor dirs), MCP security boundary
  - Ch17: Command system — 3 types (prompt/local/local-JSX), lazy loading, explicit registry ⚠️ DEPRECATED in latest Claude Code
  - Ch18: Plugin system — manifest schema, dependency resolution, MCP deduplication, built-in plugin registry
  - Ch19: **MCP integration** — 7 config scopes, 6 transport types, plugin-provided servers, channels, OAuth, enterprise allowlisting
  - Ch20: Transport layer — WebSocket/HTTP hybrid, buffering, sleep/wake, rate limits
  - Ch21: Bridge & remote control — FlushGate state machine, crash recovery
  - AppA: Buddy system (April Fools companion)
  - AppB: **Architectural patterns glossary** (Module-as-Singleton, DAG Leaf, Sticky-On Latch, Circuit Breaker, Passthrough, Bubble Permission, Content-Based Dedup, Reconciler, Capacity Wake, FlushGate)
  - AppC: Agent Definition Quick Reference (full field table)

### 1B. Agent Skills Specification (GitHub: agentskills/agentskills)
- **File**: `docs/specification.mdx`
- **Key Extractions**:
  - SKILL.md format: YAML frontmatter (name, description, license, compatibility, metadata, allowed-tools) + Markdown body
  - Name constraints: 1-64 chars, lowercase + hyphens, must match directory name
  - Description: 1-1024 chars, must describe what + when
  - **Progressive Disclosure**: Metadata (~100 tokens) → Instructions (<5000 tokens) → Resources (on demand)
  - Optional dirs: `scripts/`, `references/`, `assets/`
  - Validation via `skills-ref validate`

### 1C. Claude Code: Best Practices for Agentic Coding (CandleKeep)
- **ID**: `cmni0b1s20ioxqh0zvb6rsraz` | 11 pages
- **Key Extractions**:
  - Ch1: Context window is THE fundamental constraint (not intelligence)
  - Ch2: Verification = highest leverage (2-3x quality improvement)
  - Ch3: Explore → Plan → Implement → Commit workflow
  - Ch4: Specific prompts, @-mentions, pipe data, rich content
  - Ch5: CLAUDE.md (include/exclude guide), permissions, CLI tools, MCP, hooks, **skills creation**, **custom subagents**
  - Ch6: Codebase questions, interview pattern (AskUserQuestion)
  - Ch7: Course-correct early, /clear, /compact, subagents for investigation, checkpoints
  - Ch8: Headless mode (`claude -p`), parallel sessions, **fan-out pattern**, writer/reviewer pattern

### 1D. Claude Code: Official Docs (CandleKeep)
- **ID**: `cmmml5w1z00kwo70zxipzy9es` | 272 pages
- **Key Extractions (marketplace protocol)**:
  - `marketplace.json` schema: name, owner, plugins[], metadata
  - Plugin entries: name, source (relative/github/url/git-subdir/npm), version, author, category, tags, strict mode
  - Plugin sources: relative path (`./`), github (`{repo, ref, sha}`), url, git-subdir (sparse clone), npm
  - 3 install scopes: user, project, local
  - Plugin caching at `~/.claude/plugins/cache`
  - Reserved marketplace names (anthropic-*, claude-code-*, agent-skills)
  - Version management: semver, CHANGELOG.md
  - Component types: commands, agents, hooks, mcpServers, lspServers


## 2. ANTHROPIC ENGINEERING GUIDES (CandleKeep)

### 2A. Effective Context Engineering for AI Agents
- **ID**: `cmljgr6n5004nmn0zovcu47ca` | By Anthropic Applied AI Team
- **Key Extractions**:
  - Context = tokens at inference time (system + tools + history + retrieved data)
  - **Context Rot**: accuracy degrades as context grows (n² attention relationships)
  - Goal: "smallest possible set of high-signal tokens"
  - **Just-In-Time Context**: lightweight identifiers → load on demand
  - **Progressive Disclosure**: incrementally discover context through exploration
  - **Hybrid Strategy**: CLAUDE.md (pre-loaded) + tools (runtime exploration)
  - Long-horizon: Compaction, Structured Note-Taking, Sub-Agent Architectures
  - **Our search must return smallest high-signal results, not dump everything**

### 2B. Writing Effective Tools for Agents
- **ID**: `cmljgr20k0043mn0zj85ycyu3` | 16 Anthropic authors
- **Key Extractions**:
  - 3-phase: Prototype → Evaluate → Optimize
  - **Search over Listing** — our APIs must search, not list
  - **Consolidation** — fewer powerful endpoints > many granular ones
  - **Description engineering** — tool descriptions ARE prompts
  - **Token efficiency** — pagination, filtering, truncation with guidance
  - **Our marketplace API must follow these tool design principles**

### 2C. Other Available Resources
- **UI/UX Design Principles** (`cmni0b2120iy5qh0zya1r6bjy`) — 170+ actionable rules
- **Anthropic Prompting Best Practices** (`cmni0b1xf0itnqh0zbtike30u`) — For copilot
- **Demystifying Evals** (`cmljgutno005tmn0zukpk5ho6`) — Evaluation methodology
- **Code Review for AI Agents** (`cmn0o20r901ccqo0znj3zzqh9`) — 231 rules
- **OWASP Security Guide** (`cmni0b1sy0ipaqh0zr4hmpzpa`) — 155 pages

---

## 3. KEY INSIGHTS FOR V2

1. **Skills are ONE of 15+ asset types** — agents, hooks, MCP, LSP, plugins, commands, rules, tasks, channels
2. **Plugins are THE distribution primitive** — bundles with `plugin.json` manifest
3. **marketplace.json is the protocol** — self-hostable, git/npm/url sources, 3 scopes
4. **Agent schema has 15+ fields** — memory, isolation, background, critical reminders
5. **6-level sourcing hierarchy** — Built-in → Plugin → User → Project → Flag → Policy
6. **Department Harnesses = Plugin bundles** — validated (204 skills across 13 departments)
7. **Context Engineering > Prompt Engineering** — search = smallest high-signal token set
8. **Progressive Disclosure is the pattern** — metadata → instructions → resources
9. **Enterprise governance is THE gap** — nobody combines RBAC + search + security + cross-tool
10. **Our V1 architecture extends perfectly** — MongoDB docs, Voyage embeddings, RBAC all carry forward
11. **MongoDB Automated Embedding** (Public Preview Jan 2026) — `autoEmbed` index type replaces manual client-side embedding. ADR-010 adopted dual-mode: autoEmbed (M10+) + manual fallback (M0/local)
12. **CandleKeep Cloud investigation** — Complementary product (books vs configs). Adopted 5 innovations: ambient activation, CLI for agents, multi-tool (+Roo, +Gemini), background enrichment, usage tracking. ADR-011. NOT a competitor — different domain entirely.

---

## 4. READY FOR PLANNING

**Total research**: ~2,500 lines in 6 files + ~50,000 tokens from 7 CandleKeep sources + GitHub
**Coverage**: Competition ✅ | Architecture ✅ | Protocol ✅ | Schema ✅ | Spec ✅ | Tool Design ✅ | Context Engineering ✅ | UI/UX ✅ | Methodology ✅
**Next**: Synthesize into Phase 8-15 plan with ADRs
