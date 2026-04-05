# Phase 8 — Asset Data Model + UI Migration

## Status: NOT_STARTED

## Objective
Generalize skills → assets to support 7 asset types. Migrate all UI components. Add lightweight audit logging. Implement autoEmbed strategy (ADR-010).

## Dependencies
- V1 Phases 0-5 (all complete)
- ADR-009 (V2 pivot decision)
- ADR-010 (MongoDB Automated Embedding with fallback)

## Tasks
- [ ] 8.1 Generalize `skills` → `assets` collection with `type` discriminator
- [ ] 8.2 Expand $jsonSchema validators per asset type
- [ ] 8.3 Update search indexes: multi-type querying + autoEmbed vector index (ADR-010)
- [ ] 8.4 Generalized API routes: `/api/assets`
- [ ] 8.5 TypeScript types and services (`Asset` interface + discriminated unions + autoEmbed/manual dual-mode search)
- [ ] 8.6 Dashboard UI migration (skills → assets components + type filters)
- [ ] 8.7 Lightweight audit logging foundation (`audit_logs` collection)

## Asset Types
| Type | Key Fields | Source |
|------|-----------|--------|
| skill | name, description, content | SKILL.md |
| agent | name, whenToUse, tools, model, memory | agents/*.md |
| rule | name, content, scope | CLAUDE.md, .cursorrules |
| plugin | name, version, manifest, bundledAssets[] | plugin.json |
| mcp_config | name, serverDefs, transport | .mcp.json |
| hook | name, events[], scripts | hooks.json |
| settings_bundle | name, settings, targetTool | settings.json presets |

## Embedding Strategy (ADR-010)
- **autoEmbed (primary)**: `{ type: "autoEmbed", path: "searchText", model: "voyage-3-lite" }` in vectorSearch index
- **searchText field**: Auto-populated on create/update: `Name: X\nDescription: Y\nTags: Z\nContent: ...`
- **Query**: `$vectorSearch` with `query: "text string"` (not `queryVector`)
- **Fallback (M0/local)**: Keep manual Voyage pipeline — runtime detection
- **Model upgrade path**: Switch to `voyage-4-lite` when GA (just update index, re-embed automatically)

## Skill Guidelines Active
- **mongodb-schema-design**: $jsonSchema validators, ESR indexes, 16MB limit awareness
- **mongodb-search-and-ai**: autoEmbed index type, vector search queries
- **typescript-advanced-types**: discriminated unions for asset types, generic CRUD
- **frontend-patterns**: component rename, type badges, filter tabs

## Work Log
(Updated as tasks complete)

## Lessons Learned
(Updated after phase completion)
