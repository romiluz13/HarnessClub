# Phase 5 — Marketplace Protocol & Import

## Status: ✅ COMPLETE

## Objective
Claude Code marketplace.json generation + skill import from GitHub/skills.sh.

## Tasks
- [x] 5.1 Marketplace JSON API — /api/marketplace/[teamSlug] with ETag + Cache-Control
- [x] 5.2 GitHub Import Service — SKILL.md/AGENTS.md/CLAUDE.md detection, YAML frontmatter parsing
- [x] 5.3 Import API + UI — /api/import with RBAC check, Import modal on Skills page
- [x] 5.4 Marketplace Tests — published/unpublished filtering, empty marketplace, team slug lookup

## Work Log
- Built `src/services/github-import.ts` — fetches GitHub repos, detects config files, parses YAML frontmatter
- Built `/api/marketplace/[teamSlug]/route.ts` — generates marketplace.json with ETag + Cache-Control
- Built `/api/import/route.ts` — POST endpoint with RBAC ownership check
- Built `import-skill-modal.tsx` — GitHub URL input, preview, import flow
- Integration tests: real GitHub fetches, marketplace generation, import pipeline
- 109 tests total passing at phase completion

## Lessons Learned
- ETag generation from content hash is cheap and effective for cache validation
- GitHub API raw content fetch is more reliable than tree API for single files
- Note: skills.sh integration deferred — format covered by parser registry in V2 Phase 9
