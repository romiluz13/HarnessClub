# MongoDB Documentation URLs — Official References

> Every capability maps to its official MongoDB documentation page.
> These URLs are used to fetch docs into `docs/mongodb/` for local reference.

## CRUD Operations
- insertOne: https://www.mongodb.com/docs/manual/reference/method/db.collection.insertOne/
- insertMany: https://www.mongodb.com/docs/manual/reference/method/db.collection.insertMany/
- findOne: https://www.mongodb.com/docs/manual/reference/method/db.collection.findOne/
- find: https://www.mongodb.com/docs/manual/reference/method/db.collection.find/
- updateOne: https://www.mongodb.com/docs/manual/reference/method/db.collection.updateOne/
- updateMany: https://www.mongodb.com/docs/manual/reference/method/db.collection.updateMany/
- deleteOne: https://www.mongodb.com/docs/manual/reference/method/db.collection.deleteOne/
- deleteMany: https://www.mongodb.com/docs/manual/reference/method/db.collection.deleteMany/
- bulkWrite: https://www.mongodb.com/docs/manual/reference/method/db.collection.bulkWrite/
- findOneAndUpdate: https://www.mongodb.com/docs/manual/reference/method/db.collection.findOneAndUpdate/
- findOneAndDelete: https://www.mongodb.com/docs/manual/reference/method/db.collection.findOneAndDelete/
- countDocuments: https://www.mongodb.com/docs/manual/reference/method/db.collection.countDocuments/
- estimatedDocumentCount: https://www.mongodb.com/docs/manual/reference/method/db.collection.estimatedDocumentCount/
- distinct: https://www.mongodb.com/docs/manual/reference/method/db.collection.distinct/

## Query Operators
- Comparison: https://www.mongodb.com/docs/manual/reference/operator/query-comparison/
- Logical: https://www.mongodb.com/docs/manual/reference/operator/query-logical/
- Element ($exists, $type): https://www.mongodb.com/docs/manual/reference/operator/query-element/
- Evaluation ($expr, $jsonSchema): https://www.mongodb.com/docs/manual/reference/operator/query-evaluation/
- Array ($all, $elemMatch, $size): https://www.mongodb.com/docs/manual/reference/operator/query-array/

## Update Operators
- Field ($set, $unset, $inc, $currentDate, $setOnInsert): https://www.mongodb.com/docs/manual/reference/operator/update-field/
- Array ($push, $pull, $addToSet, $pop, $each, $slice, $position): https://www.mongodb.com/docs/manual/reference/operator/update-array/

## Aggregation Stages
- All stages overview: https://www.mongodb.com/docs/manual/reference/mql/aggregation-stages/
- $match: https://www.mongodb.com/docs/manual/reference/operator/aggregation/match/
- $group: https://www.mongodb.com/docs/manual/reference/operator/aggregation/group/
- $project: https://www.mongodb.com/docs/manual/reference/operator/aggregation/project/
- $lookup: https://www.mongodb.com/docs/manual/reference/operator/aggregation/lookup/
- $unwind: https://www.mongodb.com/docs/manual/reference/operator/aggregation/unwind/
- $facet: https://www.mongodb.com/docs/manual/reference/operator/aggregation/facet/
- $bucket: https://www.mongodb.com/docs/manual/reference/operator/aggregation/bucket/
- $bucketAuto: https://www.mongodb.com/docs/manual/reference/operator/aggregation/bucketAuto/
- $graphLookup: https://www.mongodb.com/docs/manual/reference/operator/aggregation/graphLookup/
- $merge: https://www.mongodb.com/docs/manual/reference/operator/aggregation/merge/
- $out: https://www.mongodb.com/docs/manual/reference/operator/aggregation/out/
- $setWindowFields: https://www.mongodb.com/docs/manual/reference/operator/aggregation/setWindowFields/
- $densify: https://www.mongodb.com/docs/manual/reference/operator/aggregation/densify/
- $fill: https://www.mongodb.com/docs/manual/reference/operator/aggregation/fill/
- $unionWith: https://www.mongodb.com/docs/manual/reference/operator/aggregation/unionWith/
- $sortByCount: https://www.mongodb.com/docs/manual/reference/operator/aggregation/sortByCount/
- $sample: https://www.mongodb.com/docs/manual/reference/operator/aggregation/sample/
- $addFields: https://www.mongodb.com/docs/manual/reference/operator/aggregation/addFields/
- $replaceRoot: https://www.mongodb.com/docs/manual/reference/operator/aggregation/replaceRoot/
- $count: https://www.mongodb.com/docs/manual/reference/operator/aggregation/count/
- $redact: https://www.mongodb.com/docs/manual/reference/operator/aggregation/redact/

## Aggregation Expressions
- All expressions: https://www.mongodb.com/docs/manual/reference/operator/aggregation/
- $sum: https://www.mongodb.com/docs/manual/reference/operator/aggregation/sum/
- $avg: https://www.mongodb.com/docs/manual/reference/operator/aggregation/avg/
- $dateToString: https://www.mongodb.com/docs/manual/reference/operator/aggregation/dateToString/
- $dateTrunc: https://www.mongodb.com/docs/manual/reference/operator/aggregation/dateTrunc/
- $filter: https://www.mongodb.com/docs/manual/reference/operator/aggregation/filter/
- $map: https://www.mongodb.com/docs/manual/reference/operator/aggregation/map/
- $cond: https://www.mongodb.com/docs/manual/reference/operator/aggregation/cond/
- $ifNull: https://www.mongodb.com/docs/manual/reference/operator/aggregation/ifNull/
- $expr: https://www.mongodb.com/docs/manual/reference/operator/query/expr/

## Atlas Search & Vector Search
- $search: https://www.mongodb.com/docs/atlas/atlas-search/query-syntax/
- $vectorSearch: https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/
- $searchMeta: https://www.mongodb.com/docs/atlas/atlas-search/query-syntax/#-searchmeta
- Hybrid Search ($rankFusion): https://www.mongodb.com/docs/atlas/atlas-vector-search/hybrid-search/
- Hybrid Search tutorial: https://www.mongodb.com/docs/atlas/atlas-search/tutorial/hybrid-search/
- Operators overview: https://www.mongodb.com/docs/atlas/atlas-search/operators-and-collectors/
- autocomplete: https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/autocomplete/
- compound: https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/compound/
- facet (search): https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/facet/
- moreLikeThis: https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/morelikethis/
- phrase: https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/phrase/
- embeddedDocuments: https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/embedded-document/
- highlight: https://www.mongodb.com/docs/atlas/atlas-search/highlighting/

## Index Types
- Index overview: https://www.mongodb.com/docs/manual/indexes/
- Compound: https://www.mongodb.com/docs/manual/core/index-compound/
- Multikey: https://www.mongodb.com/docs/manual/core/index-multikey/
- Unique: https://www.mongodb.com/docs/manual/core/index-unique/
- TTL: https://www.mongodb.com/docs/manual/core/index-ttl/
- Partial: https://www.mongodb.com/docs/manual/core/index-partial/
- Sparse: https://www.mongodb.com/docs/manual/core/index-sparse/
- Wildcard: https://www.mongodb.com/docs/manual/core/index-wildcard/
- Hidden: https://www.mongodb.com/docs/manual/core/index-hidden/
- Collation: https://www.mongodb.com/docs/manual/reference/collation/

## Platform Features
- Transactions: https://www.mongodb.com/docs/manual/core/transactions/
- Change Streams: https://www.mongodb.com/docs/manual/changeStreams/
- Change Events: https://www.mongodb.com/docs/manual/reference/change-events/
- Schema Validation: https://www.mongodb.com/docs/manual/core/schema-validation/
- $jsonSchema: https://www.mongodb.com/docs/manual/reference/operator/query/jsonSchema/
- Time Series: https://www.mongodb.com/docs/manual/core/timeseries-collections/
- Capped Collections: https://www.mongodb.com/docs/manual/core/capped-collections/
- Views: https://www.mongodb.com/docs/manual/core/views/
- Materialized Views: https://www.mongodb.com/docs/manual/core/materialized-views/
- Read Concern: https://www.mongodb.com/docs/manual/reference/read-concern/
- Write Concern: https://www.mongodb.com/docs/manual/reference/write-concern/
- Retryable Writes: https://www.mongodb.com/docs/manual/core/retryable-writes/
- Connection Pooling: https://www.mongodb.com/docs/manual/reference/connection-string/
- Explain: https://www.mongodb.com/docs/manual/reference/method/db.collection.explain/

## Schema Design Patterns
- Document Versioning: https://www.mongodb.com/docs/manual/data-modeling/design-patterns/data-versioning/document-versioning/
- Schema Versioning: https://www.mongodb.com/docs/manual/data-modeling/design-patterns/data-versioning/schema-versioning/
- All Patterns: https://www.mongodb.com/docs/manual/data-modeling/design-patterns/
- Embed vs Reference: https://www.mongodb.com/docs/manual/data-modeling/concepts/embedding-vs-references/

## Node.js Driver
- Driver docs: https://www.mongodb.com/docs/drivers/node/current/
- Usage examples: https://www.mongodb.com/docs/drivers/node/current/usage-examples/
- Transactions: https://www.mongodb.com/docs/drivers/node/current/fundamentals/transactions/
- Change Streams: https://www.mongodb.com/docs/drivers/node/current/usage-examples/changeStream/
- Aggregation: https://www.mongodb.com/docs/drivers/node/current/fundamentals/aggregation/
