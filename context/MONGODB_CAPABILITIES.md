# MongoDB Capabilities Master List

> **Purpose**: Every MongoDB capability that exists, with doc links and SkillsHub applicability.
> **Approach**: Skills first, official docs complementary. No capability left behind.
> **Last Updated**: 2026-04-02

## Legend
- 🟢 **USING** — Already implemented in SkillsHub
- 🔴 **MUST_USE** — Natural fit, not using it yet (gap)
- 🟡 **SHOULD_USE** — Strong fit, adds showcase value
- ⚪ **NICE_TO_HAVE** — Could use, not critical
- ⬛ **NOT_APPLICABLE** — Doesn't fit this project

---

## 1. CRUD Operations

| # | Capability | Description | Status | SkillsHub Use Case | Doc URL |
|---|-----------|-------------|--------|-------------------|---------|
| 1.1 | `insertOne` | Insert a single document | 🟢 | Team creation, skill creation | |
| 1.2 | `insertMany` | Insert multiple documents in one call | 🟡 | Batch skill import from lock file | |
| 1.3 | `findOne` | Find a single document by filter | 🟢 | Get team by slug, user by email | |
| 1.4 | `find` | Find multiple documents with cursor | 🟢 | List skills for team, list teams | |
| 1.5 | `updateOne` | Update a single document | 🟢 | Update member role, team settings | |
| 1.6 | `updateMany` | Update multiple documents at once | 🟡 | Bulk publish/unpublish skills | |
| 1.7 | `deleteOne` | Delete a single document | 🟡 | Remove a skill | |
| 1.8 | `deleteMany` | Delete multiple documents | 🟡 | Cascade delete team's skills | |
| 1.9 | `replaceOne` | Replace entire document | ⚪ | Full skill content replace | |
| 1.10 | `bulkWrite` | Execute multiple write operations in order | 🟡 | Batch operations (import, cleanup) | |
| 1.11 | `findOneAndUpdate` | Atomically find and update, return result | 🔴 | Increment view count + return skill | |
| 1.12 | `findOneAndDelete` | Atomically find and delete, return result | ⚪ | Delete and return for undo | |
| 1.13 | `findOneAndReplace` | Atomically find and replace | ⚪ | Full skill update | |
| 1.14 | `countDocuments` | Count documents matching filter | 🟡 | Dashboard stats, pagination | |
| 1.15 | `estimatedDocumentCount` | Fast approximate count (no filter) | 🟡 | Quick total skill count | |
| 1.16 | `distinct` | Get distinct values of a field | 🟡 | Get all unique tags for filter UI | |

## 2. Query Operators — Comparison

| # | Capability | Description | Status | SkillsHub Use Case | Doc URL |
|---|-----------|-------------|--------|-------------------|---------|
| 2.1 | `$eq` | Equals (implicit in filter) | 🟢 | teamId match, slug match | |
| 2.2 | `$ne` | Not equal | 🟡 | Exclude current user from member list | |
| 2.3 | `$gt` / `$gte` | Greater than / greater-or-equal | 🟡 | Skills with > N installs, date ranges | |
| 2.4 | `$lt` / `$lte` | Less than / less-or-equal | 🟡 | Date range queries for analytics | |
| 2.5 | `$in` | Match any value in array | 🟡 | Skills matching multiple tags | |
| 2.6 | `$nin` | Match none in array | ⚪ | Exclude skills with certain tags | |

## 3. Query Operators — Logical

| # | Capability | Description | Status | SkillsHub Use Case | Doc URL |
|---|-----------|-------------|--------|-------------------|---------|
| 3.1 | `$and` | All conditions must match | 🟢 | Compound filters (team + published) | |
| 3.2 | `$or` | Any condition matches | 🟡 | Search name OR description | |
| 3.3 | `$not` | Negate a condition | ⚪ | Inverse filters | |
| 3.4 | `$nor` | None of the conditions match | ⚪ | Complex exclusion filters | |

## 4. Query Operators — Element

| # | Capability | Description | Status | SkillsHub Use Case | Doc URL |
|---|-----------|-------------|--------|-------------------|---------|
| 4.1 | `$exists` | Field exists or not | 🟡 | Skills with/without embeddings | |
| 4.2 | `$type` | Field is of specific BSON type | ⚪ | Data validation queries | |

## 5. Query Operators — Evaluation

| # | Capability | Description | Status | SkillsHub Use Case | Doc URL |
|---|-----------|-------------|--------|-------------------|---------|
| 5.1 | `$expr` | Use aggregation expressions in queries | 🔴 | "Skills where views > installs×10" (viral) | |
| 5.2 | `$jsonSchema` | Validate documents against schema | 🟢 | Collection validators (skills, teams, users) | |
| 5.3 | `$mod` | Modulo operation | ⬛ | No natural fit | |
| 5.4 | `$regex` | Regular expression match | ⬛ | NEVER for search (per skill). Only admin debug | |
| 5.5 | `$text` | Text search operator | ⬛ | NEVER (per search-and-ai skill) | |

## 6. Query Operators — Array

| # | Capability | Description | Status | SkillsHub Use Case | Doc URL |
|---|-----------|-------------|--------|-------------------|---------|
| 6.1 | `$all` | Array contains all specified elements | 🟡 | Skills matching ALL selected tags | |
| 6.2 | `$elemMatch` (query) | Array element matches all conditions | 🔴 | Find user's membership for specific team+role | |
| 6.3 | `$size` | Array has exact length | ⚪ | Teams with exactly 1 member (solo) | |


## 7. Update Operators — Field

| # | Capability | Description | Status | SkillsHub Use Case | Doc URL |
|---|-----------|-------------|--------|-------------------|---------|
| 7.1 | `$set` | Set field value | 🟢 | Update team settings, member role | |
| 7.2 | `$unset` | Remove a field | 🟡 | Remove optional metadata fields | |
| 7.3 | `$inc` | Increment numeric field | 🔴 | Increment viewCount, installCount | |
| 7.4 | `$mul` | Multiply numeric field | ⬛ | No natural fit | |
| 7.5 | `$min` | Set to value only if less than current | ⚪ | Track earliest access date | |
| 7.6 | `$max` | Set to value only if greater than current | ⚪ | Track latest access date | |
| 7.7 | `$rename` | Rename a field | ⚪ | Schema migration | |
| 7.8 | `$setOnInsert` | Set only during upsert insert | 🔴 | Upsert activity buckets (set createdAt only on create) | |
| 7.9 | `$currentDate` | Set field to current date | 🟡 | updatedAt timestamps (server-side) | |

## 8. Update Operators — Array

| # | Capability | Description | Status | SkillsHub Use Case | Doc URL |
|---|-----------|-------------|--------|-------------------|---------|
| 8.1 | `$push` | Add element to array | 🟢 | Add team membership, add event to bucket | |
| 8.2 | `$pull` | Remove elements matching condition | 🟢 | Remove team membership | |
| 8.3 | `$addToSet` | Add element only if not present | 🟢 | Add memberId (no duplicates) | |
| 8.4 | `$pop` | Remove first or last array element | ⚪ | Remove oldest event from bucket | |
| 8.5 | `$pullAll` | Remove all matching values | ⚪ | Bulk tag removal | |
| 8.6 | `$each` | Modifier for $push/$addToSet with multiple | 🟡 | Push multiple tags at once | |
| 8.7 | `$position` | Insert at specific array index | ⚪ | Reorder skills | |
| 8.8 | `$slice` | Limit array size after push | 🔴 | Cap activity events per bucket (bounded arrays) | |
| 8.9 | `$sort` (array) | Sort array after push | ⚪ | Keep events sorted by timestamp | |
| 8.10 | `$ (positional)` | Update first matching array element | 🟢 | Update specific membership role | |
| 8.11 | `$[]` (all positional) | Update all array elements | ⚪ | Bulk update all memberships | |
| 8.12 | `$[<id>]` (filtered) | Update elements matching arrayFilters | 🟡 | Update memberships matching condition | |

## 9. Aggregation Pipeline — Core Stages

| # | Capability | Description | Status | SkillsHub Use Case | Doc URL |
|---|-----------|-------------|--------|-------------------|---------|
| 9.1 | `$match` | Filter documents (like find) | 🟢 | Filter by teamId, published | |
| 9.2 | `$project` | Shape output fields | 🟢 | Return only needed fields | |
| 9.3 | `$group` | Group + aggregate (sum, avg, count) | 🔴 | Installs by day, views by skill, tag cloud | |
| 9.4 | `$sort` | Sort pipeline results | 🟢 | Sort by relevance, date, name | |
| 9.5 | `$limit` | Limit results | 🟢 | Pagination, top-N | |
| 9.6 | `$skip` | Skip N results | 🟡 | Offset-based pagination | |
| 9.7 | `$unwind` | Flatten array into documents | 🔴 | Flatten tags for tag-cloud, events for timeline | |
| 9.8 | `$lookup` | Left outer join | 🔴 | Join skills↔users, skills↔teams | |
| 9.9 | `$addFields` / `$set` | Add computed fields | 🟡 | isOwner flag, computed scores | |
| 9.10 | `$replaceRoot` | Replace doc with subdocument | ⚪ | Flatten nested results | |
| 9.11 | `$count` | Count pipeline results | 🟡 | Total matching count for pagination | |
| 9.12 | `$sample` | Random documents | 🟡 | "Discover random skills" feature | |
| 9.13 | `$redact` | Field-level access control | ⚪ | Hide fields based on role | |
| 9.14 | `$out` | Write results to collection | 🟡 | Generate static leaderboard | |
| 9.15 | `$merge` | Upsert results into collection | 🔴 | Materialized analytics views | |
| 9.16 | `$unionWith` | Union with another collection | 🟡 | Combine skills + imported skills | |
| 9.17 | `$sortByCount` | Group + count + sort (shorthand) | 🟡 | Most popular tags | |

## 10. Aggregation Pipeline — Advanced Stages

| # | Capability | Description | Status | SkillsHub Use Case | Doc URL |
|---|-----------|-------------|--------|-------------------|---------|
| 10.1 | `$facet` | Multiple pipelines, one query | 🔴 | Search: results + tag counts + total count | |
| 10.2 | `$bucket` | Group into fixed-range buckets | 🔴 | Install histogram (0-10, 10-100, 100+) | |
| 10.3 | `$bucketAuto` | Auto-range bucketing | 🟡 | Auto-distributed analytics bins | |
| 10.4 | `$graphLookup` | Recursive graph traversal | 🔴 | Skill dependency trees | |
| 10.5 | `$densify` | Fill gaps in sequence | 🔴 | Complete time series (fill zero-view days) | |
| 10.6 | `$fill` | Fill null/missing values | 🟡 | Fill gaps in analytics data | |
| 10.7 | `$setWindowFields` | Window functions (running totals, rank) | 🔴 | Running install total, skill ranking | |
| 10.8 | `$changeStream` | Watch for real-time changes | 🔴 | Live skill updates in dashboard | |
| 10.9 | `$collStats` | Collection statistics | ⚪ | Admin dashboard metrics | |
| 10.10 | `$indexStats` | Index usage statistics | 🟡 | Verify indexes are being used | |

## 11. Atlas Search & Vector Search

| # | Capability | Description | Status | SkillsHub Use Case | Doc URL |
|---|-----------|-------------|--------|-------------------|---------|
| 11.1 | `$search` | Atlas Search (lexical) | 🟢 | Full-text skill search | |
| 11.2 | `$vectorSearch` | Vector Search (semantic) | 🟢 | Semantic skill discovery | |
| 11.3 | `$searchMeta` | Search metadata (facet counts) | 🔴 | Faceted search results (count by tag) | |
| 11.4 | `$rankFusion` | Native hybrid search (Preview/8.1+) | 🟢 | Implemented with M0 fallback to app-level RRF | |
| 11.5 | `$scoreFusion` | Score-based hybrid (Preview/8.1+) | 🟡 | Alternative fusion strategy | |
| 11.6 | `autocomplete` | Search-as-you-type | 🟢 | Skill name autocomplete | |
| 11.7 | `fuzzy` | Fuzzy matching (typo tolerance) | 🟢 | Fuzzy skill search | |
| 11.8 | `compound` | Multi-clause search queries | 🟢 | must + filter compound queries | |
| 11.9 | `facet` (search) | Faceted search results | 🔴 | Tag facets, author facets | |
| 11.10 | `highlight` | Search result highlighting | 🟢 | Highlight matching terms | |
| 11.11 | `moreLikeThis` | Find similar documents | 🔴 | "Skills similar to this one" | |
| 11.12 | `near` (search) | Proximity-based scoring | ⚪ | Boost recently updated skills | |
| 11.13 | `phrase` | Exact phrase matching | 🟡 | Search for exact skill names | |
| 11.14 | `wildcard` (search) | Wildcard pattern matching | ⚪ | Pattern-based search | |
| 11.15 | `queryString` | Lucene query syntax | ⚪ | Advanced search for power users | |
| 11.16 | `embeddedDocuments` | Search in nested documents | 🟡 | Search within skill metadata | |
| 11.17 | `storedSource` | Store fields in search index for retrieval | 🔴 | Return skill data without $lookup (perf) | |
| 11.18 | `returnStoredSource` | Retrieve stored fields from search | 🔴 | Faster search results without DB round-trip | |
| 11.19 | `scoreDetails` | Detailed relevance score breakdown | 🟡 | Debug search ranking, tune relevance | |
| 11.20 | `returnScope` | Query nested arrays as individual docs | 🟡 | Search within skill sections/chapters | |
| 11.21 | `hasRoot` / `hasAncestor` | Query parent fields in returnScope | 🟡 | Filter nested results by parent metadata | |
| 11.22 | Search on Views | Run $search/$searchMeta on Views (8.1+) | 🟡 | Search over published-skills view | |
| 11.23 | `vectorSearch` operator | Lexical prefilter for Vector Search (preview) | 🟡 | Pre-filter vectors by text before similarity | |

## 12. Index Types

| # | Capability | Description | Status | SkillsHub Use Case | Doc URL |
|---|-----------|-------------|--------|-------------------|---------|
| 12.1 | Single Field Index | Index on one field | 🟢 | email, slug | |
| 12.2 | Compound Index | Multi-field index (ESR) | 🟢 | teamId+name, teamId+updatedAt | |
| 12.3 | Multikey Index | Index on array fields | 🟢 | tags, memberIds | |
| 12.4 | Unique Index | Enforce uniqueness | 🟢 | email, slug, auth provider | |
| 12.5 | TTL Index | Auto-delete after time | 🔴 | Expire invite tokens, sessions | |
| 12.6 | Partial Index | Index subset of documents | 🔴 | Only published skills for marketplace | |
| 12.7 | Sparse Index | Index only docs with field | 🟡 | Skills with embeddings | |
| 12.8 | Wildcard Index | Index all/any fields | 🟡 | Flexible metadata search | |
| 12.9 | Hashed Index | Hash-based sharding | ⬛ | Not needed at M0 scale | |
| 12.10 | 2dsphere Index | Geospatial queries | ⬛ | No geo features | |
| 12.11 | Hidden Index | Test index removal safely | 🟡 | Safe index optimization | |
| 12.12 | Collation on Index | Case-insensitive index | 🔴 | Case-insensitive skill name sort | |

## 13. Platform Features

| # | Capability | Description | Status | SkillsHub Use Case | Doc URL |
|---|-----------|-------------|--------|-------------------|---------|
| 13.1 | Transactions | Multi-document ACID atomicity | 🔴 | createTeam+addMember, removeTeam cascade | |
| 13.2 | Change Streams | Real-time data change notifications | 🔴 | Live skill updates, team activity feed | |
| 13.3 | Schema Validation | $jsonSchema on collections | 🟢 | skills, teams, users validators | |
| 13.4 | Retryable Writes | Auto-retry transient write failures | 🟢 | retryWrites=true in connection | |
| 13.5 | Retryable Reads | Auto-retry transient read failures | 🟢 | retryReads=true in connection | |
| 13.6 | Connection Pooling | Reuse connections across requests | 🟢 | Singleton, globalThis cache | |
| 13.7 | Read Concern | Control read isolation level | 🟡 | "majority" for consistent reads | |
| 13.8 | Write Concern | Control write acknowledgement | 🟡 | w:"majority" for durable writes | |
| 13.9 | Read Preference | Route reads to specific nodes | ⚪ | secondaryPreferred for analytics | |
| 13.10 | Collation | Language-aware string comparison | 🔴 | Case-insensitive sorting, locale-aware | |
| 13.11 | Time Series Collections | Optimized time-ordered data | 🔴 | API telemetry, search latency tracking | |
| 13.12 | Capped Collections | Fixed-size, insertion-order | 🟡 | Recent activity log (last 1000 events) | |
| 13.13 | Views | Read-only virtual collections | 🔴 | Published skills view, team stats view | |
| 13.14 | On-Demand Materialized Views | $merge-based precomputed views | 🔴 | Daily/weekly/monthly analytics rollups | |
| 13.15 | GridFS | Store files > 16MB | ⚪ | Large skill bundles (if needed) | |
| 13.16 | Upserts | Insert-or-update atomically | 🔴 | Activity bucket creation (upsert daily) | |
| 13.17 | Bulk Operations | Batched writes for performance | 🟡 | Bulk skill import, batch analytics | |
| 13.18 | Cursor Methods | iterate, forEach, map, toArray | 🟢 | Processing query results | |
| 13.19 | Explain Plans | Query execution analysis | 🟡 | Verify index usage in tests | |
| 13.20 | `$planCacheStats` | Plan cache analysis | ⚪ | Performance debugging | |

## 14. Schema Design Patterns (from mongodb-schema-design skill)

| # | Pattern | Description | Status | SkillsHub Use Case | Skill Ref |
|---|---------|-------------|--------|-------------------|-----------|
| 14.1 | Embedded (1:1) | Nest related 1:1 data | 🟢 | owner in team, auth in user | fundamental-embed-vs-reference |
| 14.2 | Embedded (1:few) | Bounded arrays | 🟢 | teamMemberships in user (max 50) | fundamental-embed-vs-reference |
| 14.3 | Reference (1:many) | FK in child document | 🟢 | skill.teamId → teams | fundamental-embed-vs-reference |
| 14.4 | Bucket | Group events into time buckets | 🟢 | Daily activity buckets (type defined) | pattern-bucket |
| 14.5 | Computed | Pre-calculate aggregates | 🟢 | installCount, viewCount on skill | pattern-computed |
| 14.6 | Polymorphic | Different shapes, same collection | 🟡 | Activity events with varying meta | pattern-polymorphic |
| 14.7 | Attribute | Key-value pairs for varied attributes | 🟡 | Flexible skill metadata fields | pattern-attribute |
| 14.8 | Extended Reference | Cache frequently-accessed ref data | 🟢 | owner {userId, name, email} in team | pattern-extended-reference |
| 14.9 | Outlier | Handle documents that break patterns | ⚪ | Skills with extreme event counts | pattern-outlier |
| 14.10 | Approximation | Trade precision for performance | ⚪ | Approximate view counts | pattern-approximation |
| 14.11 | Document Versioning | Full edit history of documents | 🔴 | Skill edit history (who changed what) | pattern-document-versioning |
| 14.12 | Schema Versioning | Handle schema evolution | 🔴 | Migrate skill schema v1→v2 | pattern-schema-versioning |
| 14.13 | Archive | Move old data to cold storage | 🟡 | Archive old activity data | pattern-archive |
| 14.14 | Time Series | Native time series collections | 🔴 | Telemetry, latency metrics | pattern-time-series-collections |

## 15. Aggregation Expressions (commonly needed)

| # | Capability | Description | Status | SkillsHub Use Case | Doc URL |
|---|-----------|-------------|--------|-------------------|---------|
| 15.1 | `$sum` | Sum values in group | 🔴 | Total installs per team | |
| 15.2 | `$avg` | Average values | 🔴 | Average installs per skill | |
| 15.3 | `$max` / `$min` | Max/min in group | 🟡 | Most/least popular skill | |
| 15.4 | `$first` / `$last` | First/last in group | ⚪ | Most recent event | |
| 15.5 | `$arrayElemAt` | Get array element by index | ⚪ | First tag, primary author | |
| 15.6 | `$filter` | Filter array elements | 🟡 | Filter memberships by role | |
| 15.7 | `$map` | Transform array elements | 🟡 | Extract field from embedded array | |
| 15.8 | `$reduce` | Reduce array to single value | ⚪ | Flatten nested tags | |
| 15.9 | `$concatArrays` | Merge arrays | ⚪ | Combine tags from multiple sources | |
| 15.10 | `$cond` | If-then-else | 🟡 | Conditional field values | |
| 15.11 | `$switch` | Multi-branch conditional | ⚪ | Map role to permission level | |
| 15.12 | `$dateToString` | Format dates | 🔴 | Group analytics by "YYYY-MM-DD" | |
| 15.13 | `$dateTrunc` | Truncate date to period | 🔴 | Group by week/month for analytics | |
| 15.14 | `$toObjectId` / `$toString` | Type conversion | ⚪ | Cross-type joins | |
| 15.15 | `$ifNull` | Default for null values | 🟡 | Default 0 for missing counts | |
| 15.16 | `$median` | Median of numeric values (7.0+) | 🟡 | Median installs per skill | |
| 15.17 | `$percentile` | Percentile calculation (7.0+) | 🟡 | P50/P95/P99 search latency | |
| 15.18 | `$getField` | Dynamic field access | ⚪ | Access computed field names | |
| 15.19 | `$setField` | Dynamic field setting | ⚪ | Set computed field names | |

---

## Summary Counts

| Status | Count | Meaning |
|--------|-------|---------|
| 🟢 USING | 34 | Already implemented |
| 🔴 MUST_USE | 28 | Natural fit, critical gap |
| 🟡 SHOULD_USE | 38 | Strong fit, adds value |
| ⚪ NICE_TO_HAVE | 20 | Could use, not critical |
| ⬛ NOT_APPLICABLE | 6 | Doesn't fit this project |
| **TOTAL** | **126** | |

## Priority Action Items (🔴 MUST_USE)

### Immediate (infrastructure)
1. **Transactions** (13.1) — createTeam, addMember, removeMember need atomicity
2. **Upserts** (13.16) — Activity bucket creation
3. **$inc** (7.3) — Atomic counter increments
4. **$setOnInsert** (7.8) — Upsert pattern for buckets
5. **findOneAndUpdate** (1.11) — Atomic read-modify for view counting

### Search (showcase)
6. ~~**$rankFusion** (11.4) — ✅ DONE: Implemented with M0 fallback~~
7. **$searchMeta** (11.3) — Faceted search result counts
8. **facet search** (11.9) — Tag/author faceted results
9. **moreLikeThis** (11.11) — Similar skills recommendation
9b. **storedSource** (11.17/11.18) — Return search data without $lookup

### Analytics (showcase)
10. **$group** (9.3) — Analytics aggregation
11. **$unwind** (9.7) — Tag cloud, event timeline
12. **$lookup** (9.8) — Join collections for rich responses
13. **$facet** (10.1) — Multi-pipeline queries
14. **$bucket** (10.2) — Histogram analytics
15. **$graphLookup** (10.4) — Skill dependency trees
16. **$densify** (10.5) — Fill time series gaps
17. **$setWindowFields** (10.7) — Running totals, rankings
18. **$merge** (9.15) — Materialized views

### Real-time (showcase)
19. **Change Streams** (13.2) — Live updates

### Data modeling (showcase)
20. **Document Versioning** (14.11) — Skill edit history
21. **Schema Versioning** (14.12) — Schema evolution
22. **Time Series Collections** (13.11) — Telemetry
23. **Views** (13.13) — Virtual collections

### Indexes (showcase)
24. **TTL Index** (12.5) — Auto-expire tokens
25. **Partial Index** (12.6) — Published skills only
26. **Collation Index** (12.12) — Case-insensitive sorting

### Expressions
27. **$expr** (5.1) — Cross-field queries

---

## Doc Fetch Status

- [ ] All Doc URLs populated
- [ ] All docs fetched to docs/mongodb/
- [ ] Skills cross-referenced with each capability
