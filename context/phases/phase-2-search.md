# Phase 2 — Search Infrastructure

## Status: ✅ COMPLETE

## Objective
Implement hybrid search: Atlas Search (lexical) + Vector Search (semantic) + $rankFusion. Build the Voyage AI embedding pipeline.

## Tasks
- [x] 2.1 Atlas Search Index — src/lib/search-indexes.ts (autocomplete+text on name, text on description/content, token on tags)
- [x] 2.2 Vector Search Index — src/lib/search-indexes.ts (1024-dim cosine, filter by teamId+isPublished)
- [x] 2.3 Embedding Pipeline — src/services/embedding-pipeline.ts (buildEmbeddingText, embedSkill, reembedTeamSkills)
- [x] 2.4 Hybrid Search API — src/services/search.ts + search-hybrid.ts (lexical, semantic, hybrid RRF, autocomplete)
- [x] 2.5 Search Tests — 20 new tests (index defs, embedding pipeline, RRF logic). Total: 64 tests passing

## Skill Guidelines Active This Phase
- **mongodb-search-and-ai**: Lexical index (autocomplete, fuzzy), vector index (1024-dim cosine), hybrid $rankFusion. Never $regex/$text.
- **mongodb-natural-language-querying**: Validate fields against schema. $match early. Project only needed fields.
- **vercel-react-best-practices**: async-parallel for embedding + DB write. async-api-routes for search endpoint.

## Key Technical Notes
- Atlas Search and Vector Search indexes must be created via Atlas UI or API (not driver)
- $rankFusion requires MongoDB 8.1+ / atlas-local:preview — NOT available on M0 free tier
- Embedding pipeline: Voyage API → 1024-dim vector → store in skills.embedding
- Team isolation: all search queries MUST pre-filter by teamId

## Work Log
### All Tasks Completed — 2026-04-01
- Search index definitions exported as typed objects (for Atlas API/UI creation)
- Embedding pipeline: buildEmbeddingText combines metadata+content+tags for rich vectors
- Hybrid search: application-level RRF (k=60) since $rankFusion needs MongoDB 8.0
- Autocomplete: separate function for search-as-you-type UX
- Fixed RRF test: rank 0 in semantic list beats rank 0 in lexical (symmetric RRF)

## Lessons Learned
- Atlas Search/Vector Search indexes CANNOT be created via MongoDB driver — must use Atlas UI or Admin API
- Application-level RRF is simpler and more portable than MongoDB $rankFusion pipeline
- RRF k=60 is the standard constant — items in both lists always rank higher than single-list items
- Autocomplete needs separate function (different $search operator) from full-text search
- Test RRF math carefully — conflicting assertions caught a bug in ranking expectations
