# MongoDB Capabilities — Complete Reference

> **Purpose**: Comprehensive catalog of every MongoDB capability across all versions through 8.0/8.1+.
> **Scope**: General-purpose — not tied to any specific project. Use as a checklist for any MongoDB app.
> **Sources**: Official MongoDB docs, MongoDB skills (schema-design, search-and-ai, connection, query-optimizer).
> **Last Updated**: 2026-04-02
> **Covers**: MongoDB Server 5.0–8.0 GA + 8.1/8.2 Preview • Atlas M0–M80 • Node.js Driver 6.x/7.x • Atlas Search/Vector Search through Jan 2026

## How to Use This Document

1. **Audit**: Walk each section. For every capability, ask: "Does my app use this? Should it?"
2. **Discover**: Find capabilities you didn't know existed (especially Sections 10–11, 16–17).
3. **Version-gate**: Check the `Since` column before using — preview features need `--setParameter` flags.
4. **Index**: Use section numbers (e.g., "9.7 `$unwind`") as shorthand in code reviews and PRs.

---

## 1. CRUD Operations

| # | Capability | Description | Since | Doc URL |
|---|-----------|-------------|-------|---------|
| 1.1 | `insertOne` | Insert a single document | 3.2 | [docs](https://www.mongodb.com/docs/manual/reference/method/db.collection.insertOne.md) |
| 1.2 | `insertMany` | Insert multiple documents in one call (ordered/unordered) | 3.2 | [docs](https://www.mongodb.com/docs/manual/reference/method/db.collection.insertMany.md) |
| 1.3 | `findOne` | Find a single document by filter | 2.0 | [docs](https://www.mongodb.com/docs/manual/reference/method/db.collection.findOne.md) |
| 1.4 | `find` | Find multiple documents, returns cursor | 2.0 | [docs](https://www.mongodb.com/docs/manual/reference/method/db.collection.find.md) |
| 1.5 | `updateOne` | Update first document matching filter | 3.2 | [docs](https://www.mongodb.com/docs/manual/reference/method/db.collection.updateOne.md) |
| 1.6 | `updateMany` | Update all documents matching filter | 3.2 | [docs](https://www.mongodb.com/docs/manual/reference/method/db.collection.updateMany.md) |
| 1.7 | `deleteOne` | Delete first document matching filter | 3.2 | [docs](https://www.mongodb.com/docs/manual/reference/method/db.collection.deleteOne.md) |
| 1.8 | `deleteMany` | Delete all documents matching filter | 3.2 | [docs](https://www.mongodb.com/docs/manual/reference/method/db.collection.deleteMany.md) |
| 1.9 | `replaceOne` | Replace entire document (preserves `_id`) | 3.2 | [docs](https://www.mongodb.com/docs/manual/reference/method/db.collection.replaceOne.md) |
| 1.10 | `bulkWrite` | Execute multiple write ops in order or unordered | 3.2 | [docs](https://www.mongodb.com/docs/manual/reference/method/db.collection.bulkWrite.md) |
| 1.11 | `findOneAndUpdate` | Atomically find and update, return before/after | 3.2 | [docs](https://www.mongodb.com/docs/manual/reference/method/db.collection.findOneAndUpdate.md) |
| 1.12 | `findOneAndDelete` | Atomically find and delete, return deleted doc | 3.2 | [docs](https://www.mongodb.com/docs/manual/reference/method/db.collection.findOneAndDelete.md) |
| 1.13 | `findOneAndReplace` | Atomically find and replace | 3.2 | [docs](https://www.mongodb.com/docs/manual/reference/method/db.collection.findOneAndReplace.md) |
| 1.14 | `countDocuments` | Accurate count of docs matching filter (uses aggregation) | 4.0.3 | [docs](https://www.mongodb.com/docs/manual/reference/method/db.collection.countDocuments.md) |
| 1.15 | `estimatedDocumentCount` | Fast approximate count (metadata-based, no filter) | 4.0.3 | [docs](https://www.mongodb.com/docs/manual/reference/method/db.collection.estimatedDocumentCount.md) |
| 1.16 | `distinct` | Get distinct values of a field across documents | 2.0 | [docs](https://www.mongodb.com/docs/manual/reference/method/db.collection.distinct.md) |

## 2. Query Operators — Comparison

| # | Capability | Description | Since | Doc URL |
|---|-----------|-------------|-------|---------|
| 2.1 | `$eq` | Equals (implicit in `{ field: value }`) | 3.0 | [docs](https://www.mongodb.com/docs/manual/reference/operator/query/eq.md) |
| 2.2 | `$ne` | Not equal | 2.0 | [docs](https://www.mongodb.com/docs/manual/reference/operator/query/ne.md) |
| 2.3 | `$gt` | Greater than | 2.0 | [docs](https://www.mongodb.com/docs/manual/reference/operator/query/gt.md) |
| 2.4 | `$gte` | Greater than or equal | 2.0 | [docs](https://www.mongodb.com/docs/manual/reference/operator/query/gte.md) |
| 2.5 | `$lt` | Less than | 2.0 | [docs](https://www.mongodb.com/docs/manual/reference/operator/query/lt.md) |
| 2.6 | `$lte` | Less than or equal | 2.0 | [docs](https://www.mongodb.com/docs/manual/reference/operator/query/lte.md) |
| 2.7 | `$in` | Match any value in array | 2.0 | [docs](https://www.mongodb.com/docs/manual/reference/operator/query/in.md) |
| 2.8 | `$nin` | Match none in array | 2.0 | [docs](https://www.mongodb.com/docs/manual/reference/operator/query/nin.md) |

## 3. Query Operators — Logical

| # | Capability | Description | Since | Doc URL |
|---|-----------|-------------|-------|---------|
| 3.1 | `$and` | All conditions must match (implicit with comma) | 2.0 | [docs](https://www.mongodb.com/docs/manual/reference/operator/query/and.md) |
| 3.2 | `$or` | Any condition matches | 2.0 | [docs](https://www.mongodb.com/docs/manual/reference/operator/query/or.md) |
| 3.3 | `$not` | Negate a condition | 2.0 | [docs](https://www.mongodb.com/docs/manual/reference/operator/query/not.md) |
| 3.4 | `$nor` | None of the conditions match | 2.0 | [docs](https://www.mongodb.com/docs/manual/reference/operator/query/nor.md) |

## 4. Query Operators — Element & Evaluation

| # | Capability | Description | Since | Doc URL |
|---|-----------|-------------|-------|---------|
| 4.1 | `$exists` | Field exists or not | 2.0 | [docs](https://www.mongodb.com/docs/manual/reference/operator/query/exists.md) |
| 4.2 | `$type` | Field is of specific BSON type | 2.0 | [docs](https://www.mongodb.com/docs/manual/reference/operator/query/type.md) |
| 4.3 | `$expr` | Use aggregation expressions in query filter | 3.6 | [docs](https://www.mongodb.com/docs/manual/reference/operator/query/expr.md) |
| 4.4 | `$jsonSchema` | Validate documents against JSON Schema | 3.6 | [docs](https://www.mongodb.com/docs/manual/reference/operator/query/jsonSchema.md) |
| 4.5 | `$mod` | Modulo operation on field value | 2.0 | [docs](https://www.mongodb.com/docs/manual/reference/operator/query/mod.md) |
| 4.6 | `$regex` | Regular expression match (⚠️ avoid for search — use Atlas Search) | 2.0 | [docs](https://www.mongodb.com/docs/manual/reference/operator/query/regex.md) |
| 4.7 | `$text` | Legacy text search (⚠️ deprecated in favor of Atlas Search) | 2.6 | [docs](https://www.mongodb.com/docs/manual/reference/operator/query/text.md) |
| 4.8 | `$where` | JavaScript expression evaluation (⚠️ security risk, avoid) | 2.0 | [docs](https://www.mongodb.com/docs/manual/reference/operator/query/where.md) |

## 5. Query Operators — Array

| # | Capability | Description | Since | Doc URL |
|---|-----------|-------------|-------|---------|
| 5.1 | `$all` | Array contains all specified elements | 2.0 | [docs](https://www.mongodb.com/docs/manual/reference/operator/query/all.md) |
| 5.2 | `$elemMatch` (query) | Array element matches all conditions | 2.0 | [docs](https://www.mongodb.com/docs/manual/reference/operator/query/elemMatch.md) |
| 5.3 | `$size` | Array has exact length | 2.0 | [docs](https://www.mongodb.com/docs/manual/reference/operator/query/size.md) |

## 6. Query Operators — Bitwise & Geospatial

| # | Capability | Description | Since | Doc URL |
|---|-----------|-------------|-------|---------|
| 6.1 | `$bitsAllSet` | All bit positions have value 1 | 3.2 | [docs](https://www.mongodb.com/docs/manual/reference/operator/query/bitsAllSet.md) |
| 6.2 | `$bitsAllClear` | All bit positions have value 0 | 3.2 | [docs](https://www.mongodb.com/docs/manual/reference/operator/query/bitsAllClear.md) |
| 6.3 | `$bitsAnySet` | Any bit position has value 1 | 3.2 | [docs](https://www.mongodb.com/docs/manual/reference/operator/query/bitsAnySet.md) |
| 6.4 | `$bitsAnyClear` | Any bit position has value 0 | 3.2 | [docs](https://www.mongodb.com/docs/manual/reference/operator/query/bitsAnyClear.md) |
| 6.5 | `$geoWithin` | Geometry within bounding region | 2.4 | [docs](https://www.mongodb.com/docs/manual/reference/operator/query/geoWithin.md) |
| 6.6 | `$geoIntersects` | Geometry intersects GeoJSON | 2.4 | [docs](https://www.mongodb.com/docs/manual/reference/operator/query/geoIntersects.md) |
| 6.7 | `$near` | Proximity to point (requires geo index) | 2.0 | [docs](https://www.mongodb.com/docs/manual/reference/operator/query/near.md) |
| 6.8 | `$nearSphere` | Proximity on sphere surface | 2.0 | [docs](https://www.mongodb.com/docs/manual/reference/operator/query/nearSphere.md) |


## 7. Update Operators — Field

| # | Capability | Description | Since | Doc URL |
|---|-----------|-------------|-------|---------|
| 7.1 | `$set` | Set field value | 2.0 | [docs](https://www.mongodb.com/docs/manual/reference/operator/update/set.md) |
| 7.2 | `$unset` | Remove a field | 2.0 | [docs](https://www.mongodb.com/docs/manual/reference/operator/update/unset.md) |
| 7.3 | `$inc` | Increment numeric field atomically | 2.0 | [docs](https://www.mongodb.com/docs/manual/reference/operator/update/inc.md) |
| 7.4 | `$mul` | Multiply numeric field | 2.6 | [docs](https://www.mongodb.com/docs/manual/reference/operator/update/mul.md) |
| 7.5 | `$min` | Set to value only if less than current | 2.6 | [docs](https://www.mongodb.com/docs/manual/reference/operator/update/min.md) |
| 7.6 | `$max` | Set to value only if greater than current | 2.6 | [docs](https://www.mongodb.com/docs/manual/reference/operator/update/max.md) |
| 7.7 | `$rename` | Rename a field | 2.0 | [docs](https://www.mongodb.com/docs/manual/reference/operator/update/rename.md) |
| 7.8 | `$setOnInsert` | Set only during upsert insert (not on update) | 2.4 | [docs](https://www.mongodb.com/docs/manual/reference/operator/update/setOnInsert.md) |
| 7.9 | `$currentDate` | Set field to current date (Date or Timestamp) | 2.6 | [docs](https://www.mongodb.com/docs/manual/reference/operator/update/currentDate.md) |

## 8. Update Operators — Array

| # | Capability | Description | Since | Doc URL |
|---|-----------|-------------|-------|---------|
| 8.1 | `$push` | Append element to array | 2.0 | [docs](https://www.mongodb.com/docs/manual/reference/operator/update/push.md) |
| 8.2 | `$pull` | Remove elements matching condition | 2.0 | [docs](https://www.mongodb.com/docs/manual/reference/operator/update/pull.md) |
| 8.3 | `$addToSet` | Add element only if not already present | 2.0 | [docs](https://www.mongodb.com/docs/manual/reference/operator/update/addToSet.md) |
| 8.4 | `$pop` | Remove first (-1) or last (1) array element | 2.0 | [docs](https://www.mongodb.com/docs/manual/reference/operator/update/pop.md) |
| 8.5 | `$pullAll` | Remove all matching values from array | 2.0 | [docs](https://www.mongodb.com/docs/manual/reference/operator/update/pullAll.md) |
| 8.6 | `$each` | Modifier for `$push`/`$addToSet` with multiple values | 2.4 | [docs](https://www.mongodb.com/docs/manual/reference/operator/update/each.md) |
| 8.7 | `$position` | Insert at specific array index (with `$push`) | 2.6 | [docs](https://www.mongodb.com/docs/manual/reference/operator/update/position.md) |
| 8.8 | `$slice` | Limit array size after `$push` (bounded arrays) | 2.4 | [docs](https://www.mongodb.com/docs/manual/reference/operator/update/slice.md) |
| 8.9 | `$sort` (update) | Sort array after `$push` | 2.4 | [docs](https://www.mongodb.com/docs/manual/reference/operator/update/sort.md) |
| 8.10 | `$` (positional) | Update first matching array element | 2.0 | [docs](https://www.mongodb.com/docs/manual/reference/operator/update/positional.md) |
| 8.11 | `$[]` (all positional) | Update all array elements | 3.6 | [docs](https://www.mongodb.com/docs/manual/reference/operator/update/positional-all.md) |
| 8.12 | `$[<id>]` (filtered) | Update elements matching `arrayFilters` | 3.6 | [docs](https://www.mongodb.com/docs/manual/reference/operator/update/positional-filtered.md) |

## 9. Aggregation Pipeline — Core Stages

| # | Capability | Description | Since | Doc URL |
|---|-----------|-------------|-------|---------|
| 9.1 | `$match` | Filter documents (like find query) | 2.2 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/match.md) |
| 9.2 | `$project` | Shape/reshape output fields | 2.2 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/project.md) |
| 9.3 | `$group` | Group + aggregate (sum, avg, count, etc.) | 2.2 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/group.md) |
| 9.4 | `$sort` | Sort pipeline results | 2.2 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/sort.md) |
| 9.5 | `$limit` | Limit number of results | 2.2 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/limit.md) |
| 9.6 | `$skip` | Skip N results (offset pagination) | 2.2 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/skip.md) |
| 9.7 | `$unwind` | Deconstruct array field into separate docs | 2.2 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/unwind.md) |
| 9.8 | `$lookup` | Left outer join to another collection | 3.2 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/lookup.md) |
| 9.9 | `$addFields` / `$set` | Add or overwrite computed fields | 3.4 / 4.2 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/addFields.md) |
| 9.10 | `$replaceRoot` / `$replaceWith` | Replace document with subdocument | 3.4 / 4.2 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/replaceRoot.md) |
| 9.11 | `$count` | Count pipeline results | 3.4 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/count.md) |
| 9.12 | `$sample` | Random sample of N documents | 3.2 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/sample.md) |
| 9.13 | `$redact` | Field-level access control within pipeline | 2.6 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/redact.md) |
| 9.14 | `$out` | Write results to a new collection (replaces) | 2.6 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/out.md) |
| 9.15 | `$merge` | Upsert/merge results into existing collection | 4.2 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/merge.md) |
| 9.16 | `$unionWith` | Union with another collection's pipeline | 4.4 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/unionWith.md) |
| 9.17 | `$sortByCount` | Group + count + sort descending (shorthand) | 3.4 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/sortByCount.md) |
| 9.18 | `$unset` | Remove fields (shorthand for `$project` exclusion) | 4.2 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/unset.md) |

## 10. Aggregation Pipeline — Advanced Stages

| # | Capability | Description | Since | Doc URL |
|---|-----------|-------------|-------|---------|
| 10.1 | `$facet` | Run multiple pipelines in parallel, one query | 3.4 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/facet.md) |
| 10.2 | `$bucket` | Group into fixed-range buckets | 3.4 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/bucket.md) |
| 10.3 | `$bucketAuto` | Auto-range bucketing (N equal buckets) | 3.4 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/bucketAuto.md) |
| 10.4 | `$graphLookup` | Recursive graph/tree traversal | 3.4 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/graphLookup.md) |
| 10.5 | `$densify` | Fill gaps in time/numeric sequences | 5.1 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/densify.md) |
| 10.6 | `$fill` | Fill null/missing values (linear, locf, value) | 5.3 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/fill.md) |
| 10.7 | `$setWindowFields` | Window functions (running totals, rank, lag/lead) | 5.0 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/setWindowFields.md) |
| 10.8 | `$changeStream` | Watch collection/db/cluster for real-time changes | 4.0 | [docs](https://www.mongodb.com/docs/manual/changeStreams.md) |
| 10.9 | `$collStats` | Collection-level statistics | 3.4 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/collStats.md) |
| 10.10 | `$indexStats` | Index usage statistics | 3.2 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/indexStats.md) |
| 10.11 | `$currentOp` | List current operations | 3.6 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/currentOp.md) |
| 10.12 | `$listSessions` | List active sessions | 3.6 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/listSessions.md) |
| 10.13 | `$listSearchIndexes` | List Atlas Search indexes | Atlas | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/listSearchIndexes.md) |
| 10.14 | `$documents` | Generate documents from expressions (no collection) | 5.1 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/documents.md) |
| 10.15 | `$listClusterCatalog` | List all namespaces in cluster | 8.1 🔮 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/listclustercatalog.md) |

## 11. Atlas Search & Vector Search

| # | Capability | Description | Since | Doc URL |
|---|-----------|-------------|-------|---------|
| 11.1 | `$search` | Atlas Search full-text (lexical) search | Atlas | [docs](https://www.mongodb.com/docs/atlas/atlas-search/query-syntax.md) |
| 11.2 | `$vectorSearch` | Atlas Vector Search (semantic/embedding similarity) | Atlas 6.0.11+ | [docs](https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage.md) |
| 11.3 | `$searchMeta` | Search metadata only (facet counts, total) | Atlas | [docs](https://www.mongodb.com/docs/atlas/atlas-search/query-syntax.md) |
| 11.4 | `$rankFusion` | Native hybrid search via RRF (Reciprocal Rank Fusion) | Atlas 8.1+ 🔮 (Preview Jun 2025) | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/rankfusion.md) |
| 11.5 | `$scoreFusion` | Score-based hybrid search (weighted avg, normalize+combine) | Atlas 8.1+ 🔮 (Preview Sep 2025) | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/scorefusion.md) |
| 11.6 | **Operators:** | | | |
| 11.6a | `text` | Full-text search with scoring | Atlas | [docs](https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/text.md) |
| 11.6b | `phrase` | Exact phrase matching with slop | Atlas | [docs](https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/phrase.md) |
| 11.6c | `autocomplete` | Search-as-you-type (edge ngram) | Atlas | [docs](https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/autocomplete.md) |
| 11.6d | `compound` | Multi-clause (must/mustNot/should/filter) | Atlas | [docs](https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/compound.md) |
| 11.6e | `fuzzy` | Typo-tolerant matching (Levenshtein) | Atlas | [docs](https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/text.md#fuzzy) |
| 11.6f | `wildcard` | Wildcard pattern matching (`?`, `*`) | Atlas | [docs](https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/wildcard.md) |
| 11.6g | `regex` | Regular expression in search index | Atlas | [docs](https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/regex.md) |
| 11.6h | `moreLikeThis` | Find similar documents | Atlas | [docs](https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/moreLikeThis.md) |
| 11.6i | `near` | Proximity-based scoring (date/number/geo) | Atlas | [docs](https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/near.md) |
| 11.6j | `range` | Numeric/date range search | Atlas | [docs](https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/range.md) |
| 11.6k | `queryString` | Lucene query syntax | Atlas | [docs](https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/queryString.md) |
| 11.6l | `equals` | Exact match in search index | Atlas | [docs](https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/equals.md) |
| 11.6m | `exists` | Field exists in search index | Atlas | [docs](https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/exists.md) |
| 11.6n | `in` | Match values from a list in search index | Atlas | [docs](https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/in.md) |
| 11.6o | `embeddedDocuments` | Search in nested/embedded arrays | Atlas | [docs](https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/embeddedDocuments.md) |
| 11.6p | `hasRoot` | Query root document fields from embedded doc context | Atlas (Oct 2025) | [docs](https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/hasRoot.md) |
| 11.6q | `vectorSearch` (operator) | Lexical prefilter operator for vector search in `$search` | Atlas 🔮 (Preview Nov 2025) | [docs](https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage.md) |
| 11.7 | **Features:** | | | |
| 11.7a | `highlight` | Search result term highlighting | Atlas | [docs](https://www.mongodb.com/docs/atlas/atlas-search/highlighting.md) |
| 11.7b | `storedSource` | Store fields in search index (no DB round-trip) | Atlas | [docs](https://www.mongodb.com/docs/atlas/atlas-search/stored-source.md) |
| 11.7c | `returnStoredSource` | Retrieve stored fields from search index | Atlas | [docs](https://www.mongodb.com/docs/atlas/atlas-search/stored-source.md) |
| 11.7d | `scoreDetails` | Detailed relevance score breakdown | Atlas | [docs](https://www.mongodb.com/docs/atlas/atlas-search/score/scoreDetails.md) |
| 11.7e | `count` (search) | Total result count in `$searchMeta` | Atlas | [docs](https://www.mongodb.com/docs/atlas/atlas-search/counting.md) |
| 11.7f | `facet` (search) | Faceted search result counts | Atlas | [docs](https://www.mongodb.com/docs/atlas/atlas-search/facet.md) |
| 11.7g | `tracking` | Search analytics tracking | Atlas | [docs](https://www.mongodb.com/docs/atlas/atlas-search/tracking.md) |
| 11.7h | Synonyms | Synonym mapping for search | Atlas | [docs](https://www.mongodb.com/docs/atlas/atlas-search/synonyms.md) |
| 11.7i | Custom Analyzers | User-defined text analyzers | Atlas | [docs](https://www.mongodb.com/docs/atlas/atlas-search/analyzers/custom.md) |
| 11.7j | Search on Views | Run `$search`/`$vectorSearch` on Views (partial index, doc transform) | 8.0+ (GA Aug 2025) | [blog](https://www.mongodb.com/company/blog/product-release-announcements/scale-performance-view-support-mongodb-atlas-search-vector-search) |
| 11.7k | Lexical Prefilters | Use Atlas Search operators (text, phrase, geo, queryString) as prefilters for `$vectorSearch` | Atlas 🔮 (Preview Jan 2026) | [changelog](https://www.mongodb.com/docs/atlas/atlas-vector-search/changelog.md) |
| 11.7l | `returnScope` | Query individual documents using `returnScope` | Atlas (Oct 2025) | [docs](https://www.mongodb.com/docs/atlas/atlas-search/searching.md) |
| 11.7m | Scalar Quantization | int8 quantization for vector indexes (up to 97% storage reduction) | Atlas (Dec 2024) | [docs](https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-type.md) |
| 11.7n | `int1` Binary Vectors | BinData BSON vector type for 1-bit embeddings | Atlas (Dec 2024) | [docs](https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-type.md) |

## 12. Index Types

| # | Capability | Description | Since | Doc URL |
|---|-----------|-------------|-------|---------|
| 12.1 | Single Field | Index on one field | 2.0 | [docs](https://www.mongodb.com/docs/manual/core/index-single.md) |
| 12.2 | Compound | Multi-field index (follow ESR rule: Equality→Sort→Range) | 2.0 | [docs](https://www.mongodb.com/docs/manual/core/index-compound.md) |
| 12.3 | Multikey | Automatically indexes array elements | 2.0 | [docs](https://www.mongodb.com/docs/manual/core/index-multikey.md) |
| 12.4 | Unique | Enforce uniqueness constraint | 2.0 | [docs](https://www.mongodb.com/docs/manual/core/index-unique.md) |
| 12.5 | TTL | Auto-delete documents after time | 2.2 | [docs](https://www.mongodb.com/docs/manual/core/index-ttl.md) |
| 12.6 | Partial | Index only documents matching a filter | 3.2 | [docs](https://www.mongodb.com/docs/manual/core/index-partial.md) |
| 12.7 | Sparse | Index only documents that have the field | 2.0 | [docs](https://www.mongodb.com/docs/manual/core/index-sparse.md) |
| 12.8 | Wildcard | Index all fields or fields matching pattern | 4.2 | [docs](https://www.mongodb.com/docs/manual/core/index-wildcard.md) |
| 12.9 | Compound Wildcard | Wildcard + regular fields in one index | 7.0 | [docs](https://www.mongodb.com/docs/manual/core/index-wildcard.md) |
| 12.10 | Hashed | Hash-based index for sharding | 2.4 | [docs](https://www.mongodb.com/docs/manual/core/index-hashed.md) |
| 12.11 | Text | Legacy full-text search index (use Atlas Search instead) | 2.6 | [docs](https://www.mongodb.com/docs/manual/core/index-text.md) |
| 12.12 | 2dsphere | Geospatial queries on spherical geometry | 2.4 | [docs](https://www.mongodb.com/docs/manual/core/indexes/index-types/geospatial/2dsphere.md) |
| 12.13 | 2d | Geospatial queries on flat geometry | 2.0 | [docs](https://www.mongodb.com/docs/manual/core/indexes/index-types/geospatial/2d.md) |
| 12.14 | Hidden | Hide index from planner (test removal safely) | 4.4 | [docs](https://www.mongodb.com/docs/manual/core/index-hidden.md) |
| 12.15 | Collation on Index | Case-insensitive or locale-aware index | 3.4 | [docs](https://www.mongodb.com/docs/manual/indexes.md#collation) |
| 12.16 | Atlas Search Index | Full-text search index (managed by Atlas) | Atlas | [docs](https://www.mongodb.com/docs/atlas/atlas-search/create-index.md) |
| 12.17 | Atlas Vector Search Index | Vector embedding index (kNN/ANN) | Atlas | [docs](https://www.mongodb.com/docs/atlas/atlas-vector-search/create-index.md) |

## 13. Aggregation Expressions (commonly needed)

| # | Capability | Description | Since | Doc URL |
|---|-----------|-------------|-------|---------|
| 13.1 | `$sum` | Sum values in `$group` or expression | 2.2 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/sum.md) |
| 13.2 | `$avg` | Average values | 2.2 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/avg.md) |
| 13.3 | `$max` / `$min` | Max/min in group | 2.2 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/max.md) |
| 13.4 | `$first` / `$last` | First/last value in group | 2.2 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/first.md) |
| 13.5 | `$count` (accumulator) | Count documents in group | 5.0 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/count-accumulator.md) |
| 13.6 | `$push` (accumulator) | Accumulate values into array | 2.2 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/push.md) |
| 13.7 | `$addToSet` (accumulator) | Accumulate unique values | 2.2 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/addToSet.md) |
| 13.8 | `$arrayElemAt` | Get array element by index | 3.2 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/arrayElemAt.md) |
| 13.9 | `$filter` | Filter array elements by condition | 3.2 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/filter.md) |
| 13.10 | `$map` | Transform each array element | 3.2 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/map.md) |
| 13.11 | `$reduce` | Reduce array to single value | 3.4 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/reduce.md) |
| 13.12 | `$concatArrays` | Merge multiple arrays | 3.2 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/concatArrays.md) |
| 13.13 | `$size` (expression) | Array length | 3.2 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/size.md) |
| 13.14 | `$cond` | If-then-else conditional | 2.2 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/cond.md) |
| 13.15 | `$switch` | Multi-branch conditional | 3.4 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/switch.md) |
| 13.16 | `$ifNull` | Default for null/missing values | 2.2 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/ifNull.md) |
| 13.17 | `$dateToString` | Format date to string | 3.0 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/dateToString.md) |
| 13.18 | `$dateTrunc` | Truncate date to period (week/month/year) | 5.0 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/dateTrunc.md) |
| 13.19 | `$toObjectId` / `$toString` | Type conversion | 4.0 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/toObjectId.md) |
| 13.20 | `$median` | Median of numeric values | 7.0 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/median.md) |
| 13.21 | `$percentile` | Percentile calculation (P50/P95/P99) | 7.0 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/percentile.md) |
| 13.22 | `$getField` / `$setField` | Dynamic field access/setting | 5.0 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/getField.md) |
| 13.23 | `$sortArray` | Sort array without `$unwind` | 5.2 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/sortArray.md) |
| 13.24 | `$firstN` / `$lastN` / `$maxN` / `$minN` | Top-N accumulators | 5.2 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/firstN.md) |
| 13.25 | `$bottom` / `$bottomN` / `$top` / `$topN` | Ordered group accumulators | 5.2 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/bottom.md) |
| 13.26 | `$bitAnd` / `$bitOr` / `$bitXor` / `$bitNot` | Bitwise aggregation operators | 7.0 | [docs](https://www.mongodb.com/docs/manual/reference/operator/aggregation/bitAnd.md) |

## 14. Platform Features

| # | Capability | Description | Since | Doc URL |
|---|-----------|-------------|-------|---------|
| 14.1 | Transactions | Multi-document ACID (replica set 4.0, sharded 4.2) | 4.0 | [docs](https://www.mongodb.com/docs/manual/core/transactions.md) |
| 14.2 | Change Streams | Real-time data change notifications | 3.6 | [docs](https://www.mongodb.com/docs/manual/changeStreams.md) |
| 14.3 | Schema Validation | `$jsonSchema` on collections | 3.6 | [docs](https://www.mongodb.com/docs/manual/core/schema-validation.md) |
| 14.4 | Retryable Writes | Auto-retry transient write failures | 3.6 | [docs](https://www.mongodb.com/docs/manual/core/retryable-writes.md) |
| 14.5 | Retryable Reads | Auto-retry transient read failures | 3.6 | [docs](https://www.mongodb.com/docs/manual/core/retryable-reads.md) |
| 14.6 | Connection Pooling | Reuse connections (maxPoolSize, minPoolSize) | 2.0 | [docs](https://www.mongodb.com/docs/manual/reference/connection-string.md) |
| 14.7 | Read Concern | Control read isolation (`local`, `majority`, `snapshot`) | 3.2 | [docs](https://www.mongodb.com/docs/manual/reference/read-concern.md) |
| 14.8 | Write Concern | Control write ack (`w:1`, `w:"majority"`, `j:true`) | 2.0 | [docs](https://www.mongodb.com/docs/manual/reference/write-concern.md) |
| 14.9 | Read Preference | Route reads (`primary`, `secondary`, `nearest`) | 2.2 | [docs](https://www.mongodb.com/docs/manual/core/read-preference.md) |
| 14.10 | Collation | Language/locale-aware string comparison | 3.4 | [docs](https://www.mongodb.com/docs/manual/reference/collation.md) |
| 14.11 | Time Series Collections | Optimized time-ordered data with auto-bucketing | 5.0 | [docs](https://www.mongodb.com/docs/manual/core/timeseries-collections.md) |
| 14.12 | Capped Collections | Fixed-size, insertion-order (no deletes) | 2.0 | [docs](https://www.mongodb.com/docs/manual/core/capped-collections.md) |
| 14.13 | Views | Read-only virtual collections (aggregation-based) | 3.4 | [docs](https://www.mongodb.com/docs/manual/core/views.md) |
| 14.14 | On-Demand Materialized Views | `$merge`-based precomputed views | 4.2 | [docs](https://www.mongodb.com/docs/manual/core/materialized-views.md) |
| 14.15 | GridFS | Store/retrieve files > 16MB | 2.0 | [docs](https://www.mongodb.com/docs/manual/core/gridfs.md) |
| 14.16 | Upserts | Insert-or-update atomically (`upsert: true`) | 2.0 | [docs](https://www.mongodb.com/docs/manual/reference/method/db.collection.updateOne.md#upsert) |
| 14.17 | Bulk Operations | Batched writes for performance | 2.6 | [docs](https://www.mongodb.com/docs/manual/reference/method/db.collection.bulkWrite.md) |
| 14.18 | Cursor Methods | `toArray`, `forEach`, `map`, `next`, `hasNext` | 2.0 | [docs](https://www.mongodb.com/docs/manual/reference/method/js-cursor.md) |
| 14.19 | Explain Plans | Query execution analysis (`queryPlanner`, `executionStats`) | 2.0 | [docs](https://www.mongodb.com/docs/manual/reference/method/cursor.explain.md) |
| 14.20 | Causal Consistency | Session-based read-your-writes guarantee | 3.6 | [docs](https://www.mongodb.com/docs/manual/core/causal-consistency-read-write-concerns.md) |
| 14.21 | Clustered Collections | Stored in `_id` order (no secondary `_id` index needed) | 5.3 | [docs](https://www.mongodb.com/docs/manual/core/clustered-collections.md) |
| 14.22 | Queryable Encryption | Query encrypted fields without decryption on server | 7.0 | [docs](https://www.mongodb.com/docs/manual/core/queryable-encryption.md) |
| 14.23 | QE Range Queries | Range queries on encrypted fields | 8.0 | [docs](https://www.mongodb.com/docs/manual/core/queryable-encryption.md) |
| 14.24 | CSFLE | Client-Side Field Level Encryption | 4.2 | [docs](https://www.mongodb.com/docs/manual/core/csfle.md) |
| 14.25 | Stable API | Version-stable API for forward compatibility | 5.0 | [docs](https://www.mongodb.com/docs/manual/reference/stable-api.md) |
| 14.26 | Cluster-to-Cluster Sync | Cross-cluster replication | 7.0 | [docs](https://www.mongodb.com/docs/cluster-to-cluster-sync.md) |

## 15. Schema Design Patterns

| # | Pattern | Description | When to Use | Doc URL |
|---|---------|-------------|-------------|---------|
| 15.1 | Embedded (1:1) | Nest related 1:1 data in parent document | Always co-accessed data, strong ownership | [docs](https://www.mongodb.com/docs/manual/data-modeling.md) |
| 15.2 | Embedded (1:few) | Bounded arrays (< ~100 elements) | Comments on post, addresses on user | [docs](https://www.mongodb.com/docs/manual/data-modeling.md) |
| 15.3 | Reference (1:many) | Foreign key in child document | Large/growing child sets, independent access | [docs](https://www.mongodb.com/docs/manual/data-modeling.md) |
| 15.4 | Bucket | Group events into time/count buckets | IoT, analytics, activity logs | [blog](https://www.mongodb.com/blog/post/building-with-patterns-the-bucket-pattern) |
| 15.5 | Computed | Pre-calculate aggregates on write | Counters, stats, leaderboards | [blog](https://www.mongodb.com/blog/post/building-with-patterns-the-computed-pattern) |
| 15.6 | Polymorphic | Different shapes in same collection | Products, events, notifications | [blog](https://www.mongodb.com/blog/post/building-with-patterns-the-polymorphic-pattern) |
| 15.7 | Attribute | Key-value pairs for varied attributes | Product specs, flexible metadata | [blog](https://www.mongodb.com/blog/post/building-with-patterns-the-attribute-pattern) |
| 15.8 | Extended Reference | Cache frequently-accessed ref data | Denormalized author name in post | [blog](https://www.mongodb.com/blog/post/building-with-patterns-the-extended-reference-pattern) |
| 15.9 | Outlier | Handle documents that break patterns | Viral posts, celebrities | [blog](https://www.mongodb.com/blog/post/building-with-patterns-the-outlier-pattern) |
| 15.10 | Approximation | Trade precision for performance | View counts, analytics | [blog](https://www.mongodb.com/blog/post/building-with-patterns-the-approximation-pattern) |
| 15.11 | Document Versioning | Full edit history with version tracking | Legal, audit trail, wiki | [blog](https://www.mongodb.com/blog/post/building-with-patterns-the-document-versioning-pattern) |
| 15.12 | Schema Versioning | Handle schema evolution across versions | Schema migrations, backward compat | [blog](https://www.mongodb.com/blog/post/building-with-patterns-the-schema-versioning-pattern) |
| 15.13 | Archive | Move old data to cold storage collection | Data lifecycle, compliance | [blog](https://www.mongodb.com/blog/post/building-with-patterns-the-archive-pattern) |
| 15.14 | Subset | Embed frequently-accessed subset only | Top-N reviews, recent comments | [blog](https://www.mongodb.com/blog/post/building-with-patterns-the-subset-pattern) |
| 15.15 | Tree (Parent Ref) | Each node stores parent `_id` | Simple hierarchies, org charts | [docs](https://www.mongodb.com/docs/manual/applications/data-models-tree-structures.md) |
| 15.16 | Tree (Materialized Path) | Store full path as string | Breadcrumbs, categories | [docs](https://www.mongodb.com/docs/manual/tutorial/model-tree-structures-with-materialized-paths.md) |
| 15.17 | Tree (Nested Sets) | Store left/right boundaries | Read-heavy trees, ancestry queries | [docs](https://www.mongodb.com/docs/manual/tutorial/model-tree-structures-with-nested-sets.md) |

## 16. Version Highlights — What's New

### MongoDB 7.0 (2023)
- Compound Wildcard Indexes (12.9)
- `$median` and `$percentile` accumulators (13.20, 13.21)
- Bitwise aggregation operators (13.26)
- Queryable Encryption GA (14.22)
- Shardsvr role changes for config servers

### MongoDB 8.0 GA (Oct 2024)
- QE Range Queries on encrypted fields (14.23)
- Batch multi-document insert optimization (single oplog entry)
- Improved query planner with `optimizationTimeMillis` in explain
- Slot-based execution engine auto-disable for problematic indexes
- `updateOne`/`replaceOne` now support `sort` option (no need for `findOneAndUpdate`)
- Express Query stages (`EXPRESS_IXSCAN`, `EXPRESS_DELETE`, etc.) for `_id` matches
- `defaultMaxTimeMS` cluster parameter for global read timeout
- `autoCompact` command for background compaction with `freeSpaceTargetMB`
- Read concern `"snapshot"` on capped collections
- `$lookup` in transactions on sharded collections
- Config shards — store app data on config servers
- Upgraded TCMalloc (per-CPU caches, reduced fragmentation)
- OIDC identity providers can share an issuer
- Namespace validation in `$lookup`/`$unionWith` subpipelines
- 36% faster reads, 32% faster mixed workloads vs 7.0

### Atlas Search & Vector Search (2024–2026)
- Scalar quantization for vector indexes (Dec 2024) — up to 97% storage savings
- `int1` binary vectors via BinData BSON type (Dec 2024)
- `$vectorSearch` pre-filter support for arrays with all operators (Aug 2024)
- `facet` operator groupings on numbers/dates in arrays (Jan 2025)
- `hasRoot` operator + `returnScope` for querying root docs (Oct 2025)
- Search & Vector Search on Views — **GA Aug 2025** (11.7j)

### MongoDB 8.1+ / Preview Features 🔮
- `$rankFusion` — Native RRF hybrid search (11.4) — **Preview Jun 2025**
- `$scoreFusion` — Score-based hybrid combination (11.5) — **Preview Sep 2025**
- Lexical Prefilters for Vector Search (11.7k) — **Preview Jan 2026**
- `$listClusterCatalog` — List all namespaces in cluster (10.15)

> **⚠️ Preview features** require `atlas-local:preview` Docker image or Atlas cluster with preview enabled. They may change before GA. Do NOT use in production without understanding the stability implications.

## 17. Connection Best Practices

| Environment | maxPoolSize | minPoolSize | maxIdleTimeMS | Notes |
|-------------|-------------|-------------|---------------|-------|
| Atlas M0/M2/M5 (Free/Shared) | 5 | 0 | 30000 | Hard 500 connection limit |
| Atlas M10+ (Dedicated) | 50–100 | 5 | 60000 | Scale with CPU cores |
| Serverless (Lambda/Vercel) | 1–5 | 0 | 10000 | Cold start matters |
| Long-running server | 50–200 | 10 | 120000 | Match expected concurrency |
| Local development | 10 | 0 | 60000 | No constraints |

**Always set**: `retryWrites=true`, `retryReads=true`, `w=majority`, `appName=<your-app>`

---

## Summary — Capability Counts

| Section | Count | Category |
|---------|-------|----------|
| 1. CRUD | 16 | Data operations |
| 2. Comparison operators | 8 | Query |
| 3. Logical operators | 4 | Query |
| 4. Element & Evaluation | 8 | Query |
| 5. Array operators | 3 | Query |
| 6. Bitwise & Geospatial | 8 | Query |
| 7. Update (Field) | 9 | Update |
| 8. Update (Array) | 12 | Update |
| 9. Core Aggregation | 18 | Pipeline |
| 10. Advanced Aggregation | 15 | Pipeline |
| 11. Atlas Search & Vector | 35 | Search |
| 12. Index Types | 17 | Indexing |
| 13. Expressions | 26 | Pipeline |
| 14. Platform Features | 26 | Infrastructure |
| 15. Schema Patterns | 17 | Design |
| **TOTAL** | **~222** | |

---

## Quick Reference — Index Strategy (ESR Rule)

```
Compound Index Field Order:
  1. Equality fields   → Fields queried with exact match ($eq)
  2. Sort fields        → Fields used in sort()
  3. Range fields       → Fields queried with $gt/$lt/$in/$regex

Example: { status: 1, createdAt: -1, score: 1 }
         ↑ Equality    ↑ Sort           ↑ Range
```

## Quick Reference — Atlas Search vs $text vs $regex

| Feature | Atlas Search | `$text` | `$regex` |
|---------|-------------|---------|----------|
| Full-text search | ✅ Best | ⚠️ Legacy | ❌ No |
| Fuzzy matching | ✅ | ❌ | ❌ |
| Autocomplete | ✅ | ❌ | ❌ |
| Faceted search | ✅ | ❌ | ❌ |
| Score/relevance | ✅ | ⚠️ Basic | ❌ |
| Index required | Search Index | Text Index | Any/None |
| Performance | ✅ Excellent | ⚠️ OK | ❌ COLLSCAN risk |
| **Recommendation** | **Always use** | **Never use** | **Debug only** |

---

> 🔮 = Preview/Upcoming feature (may require `--setParameter` or preview Docker image)
> Version numbers in "Since" column indicate GA availability.
> Atlas = Feature available on MongoDB Atlas (any tier unless noted).
