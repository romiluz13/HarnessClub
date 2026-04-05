# Phase 6 — Chrome Extension

## Status: ❌ CANCELLED (ADR-009)

## Reason
V2 pivot (ADR-009) absorbed Chrome extension into Phase 15 (Performance, Polish & Launch).
The extension should support ALL asset types (not just skills), so it makes more sense to build
it after the full asset model, import engine, and department system are complete.

## Relocated To
- **Phase 15.5**: Chrome Extension (MV3) — "Save to Team" for all asset types from GitHub/skills.sh
- Extension will detect SKILL.md, agents/, .cursorrules, .mcp.json, CLAUDE.md, plugin.json etc.
- Uses parser registry from Phase 9 for format detection
