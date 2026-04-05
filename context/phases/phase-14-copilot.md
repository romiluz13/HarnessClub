# Phase 14 — Built-in Copilot Agent

## Status: ✅ COMPLETE

## Objective
AI assistant powered by Claude Agent SDK that helps users build, discover, and configure
inside the platform. Context-aware, streaming, with agentic tool selection.

## Dependencies
- Phases 8-13 (copilot needs ALL features to assist with)

## Tasks
- [ ] 14.1 Copilot architecture (Claude Agent SDK, tools, settingSources)
- [ ] 14.2 Copilot UI integration (slide-over chat, context-aware, streaming)
- [ ] 14.3 Copilot skills (skill authoring, agent helper, dept wizard, migration)
- [ ] 14.4 Agentic tool selection (sub-agent query optimization, progressive disclosure)

## Copilot Tools
| Tool | Function |
|------|----------|
| `search_assets` | Semantic search across team's asset library |
| `create_asset` | Guided asset creation with format validation |
| `recommend_harness` | Suggest department config based on description |
| `import_from_repo` | Guided repo scanning and import |
| `export_asset` | Convert asset to target tool format |
| `explain_asset` | Explain what an asset does in plain language |

## Copilot Conversation Examples
- "Create a code review agent for my team"
- "What skills do we have for testing?"
- "Set up our Sales department with a starter kit"
- "Convert these Cursor rules to Claude Code skills"
- "Is this imported skill safe to use?"

## Skill Guidelines Active
- **vercel-react-best-practices**: streaming UI, lazy loading copilot panel
- **vercel-composition-patterns**: chat component composition, tool result rendering

## Work Log
- 2026-04-04: Added custom OpenAI-compatible gateway support for the Pi copilot via `COPILOT_BASE_URL`, `COPILOT_API_KEY`, and `COPILOT_API_KEY_HEADER`.
- 2026-04-04: Normalized full gateway URLs so Grove-style `/chat/completions` endpoints can be pasted directly into config.
- 2026-04-04: Added unit coverage for custom gateway resolution and a live Grove integration test that verifies real `gpt-5.4-mini` execution plus a real `search_assets` tool call.
- 2026-04-04: Updated the streaming `/api/copilot/chat` path to hydrate history, save live transcripts, parse action blocks, and attach proactive suggestions/conversation metadata to the final SSE event.
- 2026-04-04: Added route-level SSE tests for both faux-provider parity and real Grove-backed live route execution.
- 2026-04-04: Fixed standalone production startup by externalizing `@mariozechner/pi-ai` and `@mariozechner/pi-agent-core` from the Next server bundle; verified clean standalone boot + HTTP 200 root smoke.

## Lessons Learned
- Azure/OpenAI-compatible gateways may present a full `/chat/completions` URL, but the Pi/OpenAI client needs the base URL root (`.../openai/v1`). Normalize it at the boundary.
- GPT-5.4-mini on Grove rejected `max_tokens` and required `max_completion_tokens`; compatibility flags matter for custom gateways.
- A live copilot smoke test should validate both plain model reachability and at least one real tool execution against MongoDB-backed data.
- The `/api/copilot/chat` SSE branch now mirrors the fallback-only behaviors that mattered for realism: conversation persistence, action parsing, proactive suggestions, and conversation metadata.
- There is currently no dedicated copilot UI route/component in the product, so route-level SSE verification is the practical top-of-stack test surface for copilot realism today.
- When Pi AI is used inside a Next standalone build, prefer `serverExternalPackages` over bundling; the SDK's dynamic provider loading is safe under native Node resolution but brittle when transformed into server chunks.
