# Phase 9 — Multi-Format Import Engine + Basic Security Scanning

## Status: ✅ COMPLETE

## Objective
Build parser registry for 11 config formats from 5 tools. Add security scanning on import.

## Dependencies
- Phase 8 (asset data model + autoEmbed index must exist)
- ADR-010 (auto-embedding eliminates manual embedSkill calls on import for M10+)

## Tasks
- [ ] 9.1 Parser registry architecture (format detection + dispatch)
- [ ] 9.2 Individual parsers (one per format, 11 total)
- [ ] 9.3 GitHub/GitLab import expansion (auto-scan repos, embedding handled by autoEmbed or fallback)
- [ ] 9.4 Basic security scanning on import (secrets, injection, dangerous commands)
- [ ] 9.5 URL/text import + bulk import from marketplace.json URL

## Supported Formats
| Format | Source Tool | Asset Type |
|--------|-----------|------------|
| SKILL.md | Claude Code / Agent Skills | skill |
| agents/*.md | Claude Code | agent |
| CLAUDE.md | Claude Code | rule |
| plugin.json | Claude Code | plugin |
| .cursorrules | Cursor | rule |
| .cursor/rules/*.mdc | Cursor | rule |
| copilot-instructions.md | GitHub Copilot | rule |
| .windsurfrules | Windsurf | rule |
| AGENTS.md | Codex / OpenAI | rule |
| .mcp.json | Claude Code | mcp_config |
| hooks.json | Claude Code | hook |

## Embedding on Import (ADR-010)
- **autoEmbed active**: Just insert document with `searchText` field populated. MongoDB embeds automatically. No `embedSkill()` call needed.
- **Manual fallback**: After insert, call `embedAsset()` (generalized from `embedSkill()`). Non-blocking — import succeeds even if embedding fails.
- **Detection**: Check if autoEmbed index exists at startup, set flag for pipeline mode.

## Skill Guidelines Active
- **typescript-advanced-types**: parser interface generics, ParsedAsset union type
- **api-security-best-practices**: scanning patterns, input validation

## Work Log
(Updated as tasks complete)

## Lessons Learned
(Updated after phase completion)
