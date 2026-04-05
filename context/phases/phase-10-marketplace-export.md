# Phase 10 — Plugin Marketplace + Export Engine

## Status: ✅ COMPLETE

## Objective
Full plugin bundle model, native marketplace.json, and export to 5 tool formats.

## Dependencies
- Phase 8 (asset types), Phase 9 (import + parser registry)

## Tasks
- [ ] 10.1 Full plugin bundle model (bundledAssets[], manifest, semver)
- [ ] 10.2 marketplace.json generation endpoint (Claude Code compatible)
- [ ] 10.3 Plugin install protocol (serve plugin directory structure)
- [ ] 10.4 Version management + upstream tracking (capability fingerprinting)
- [ ] 10.5 Export engine — format translators (Cursor, Copilot, Windsurf, Codex)
- [ ] 10.6 Export UI + API (per-asset, per-collection, bulk zip)

## Export Targets
| Tool | Format | Notes |
|------|--------|-------|
| Claude Code | SKILL.md / agents/*.md / CLAUDE.md | Native 1:1 |
| Cursor | .cursorrules / .cursor/rules/*.mdc | Flatten or MDC |
| GitHub Copilot | .github/copilot-instructions.md | Merge rules |
| Windsurf | .windsurfrules | Flatten |
| Codex / OpenAI | AGENTS.md | Merge rules |

## Skill Guidelines Active
- **api-security-best-practices**: marketplace endpoint auth, export validation
- **nextjs-app-router-patterns**: streaming downloads, caching headers

## Work Log
- 10.1 ✅ Plugin bundle model: PluginManifest (semver, compatibility, dependencies, fingerprint, changelog). Schema + validator updated.
- 10.2 ✅ Marketplace endpoint: type-aware listings, assetCount, typeBreakdown, export URLs, ?type= filter
- 10.3 ✅ Plugin install protocol: /api/assets/[id]/install serves file tree for Claude Code plugin install
- 10.4 ✅ Version management: generateFingerprint() (SHA256), checkForUpdates(), semver validation
- 10.5 ✅ Export engine: 5 exporters (Claude Code, Cursor, Copilot, Windsurf, Codex). ExporterPlugin interface, registry.
- 10.6 ✅ Export API: /api/assets/[id]/export?format=cursor. 19 new tests. Build verified. 241 total tests.

## Lessons Learned
- Exporter registry pattern mirrors parser registry (Phase 9) — proven architecture scales well
- MDC format for Cursor requires frontmatter with `alwaysApply` flag
- Exhaustive switch cases with `never` guard catch missing type handlers at compile time
