# Phase 1 — MongoDB Schema & Data Layer

## Status: ✅ COMPLETE

## Objective
Design and implement MongoDB collections following mongodb-schema-design patterns. Proper embed vs reference decisions, schema validation, and index strategy.

## Tasks
- [x] 1.1 Skills Collection — src/types/skill.ts + skillsValidator (embed metadata+content+vector, source tracking for ADR-008)
- [x] 1.2 Teams Collection — src/types/team.ts + teamsValidator (bounded memberIds<1000, CachedUserRef for owner)
- [x] 1.3 Users Collection — src/types/user.ts + usersValidator (teamMemberships[] bounded<50, auth provider enum)
- [x] 1.4 Activity Collection — src/types/activity.ts (pattern-bucket daily buckets, pattern-computed counts)
- [x] 1.5 Index Strategy — 11 indexes total: Skills=5 (ESR), Teams=2 (unique slug), Users=2 (unique email+auth), Activity=2 (skill+team date)
- [x] 1.6 Data Layer Tests — 29 new tests (schema validators + setup-db + type sanity). Total: 44 tests passing

## Skill Guidelines Active This Phase
- **mongodb-schema-design**: Embed vs reference per access patterns. $jsonSchema validation. 16MB guard. pattern-bucket for events. pattern-computed for counters. pattern-extended-reference for caching.
- **mongodb-query-optimizer**: ESR compound indexes. Max 20 per collection. No unnecessary indexes.

## Key Schema Decisions (RESOLVED)
- Skills: ✅ Embed content + vector together (always accessed together, well under 16MB)
- Teams: ✅ memberIds[] bounded to 1000 (generous for enterprise teams)
- Users: ✅ teamMemberships[] with embedded role+joinedAt (bounded to 50 teams per user)
- Analytics: ✅ Bucketed documents (pattern-bucket, daily granularity) — no time series collection needed for MVP volume
- Skills.source: ✅ Added upstream tracking (repoUrl, commitHash, lastSyncedAt) per ADR-008

## Work Log
### All Tasks Completed — 2026-04-01
- Created 4 type files: src/types/skill.ts, team.ts, user.ts, activity.ts
- Created schema validators: src/lib/schema.ts (3 $jsonSchema validators)
- Created setup-db module: src/lib/setup-db.ts (collection creation + 11 indexes)
- Created 3 test files: schema.test.ts, setup-db.test.ts, types.test.ts

## Lessons Learned
- $jsonSchema doesn't support all JSON Schema keywords — "minLength" works but "pattern" is limited
- Using `bsonType: "int"` requires values to be stored as NumberInt in MongoDB (not JavaScript number)
- pattern-bucket (daily buckets) is simpler and more efficient than time series for our event volumes
- Separating types/ from lib/schema.ts keeps TypeScript interfaces clean while validators can be stricter
