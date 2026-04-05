/**
 * Activity/Analytics document type definition.
 *
 * Per mongodb-schema-design pattern-bucket:
 * - Group events into daily buckets per skill
 * - Each bucket holds up to 1 day of events
 * - Bounded array (~1000 events/day max per skill is generous)
 *
 * Per pattern-computed:
 * - Pre-calculate installCount, viewCount on the skill document
 * - This collection stores the raw events for drill-down
 */

import type { ObjectId } from "mongodb";

/** Types of trackable events */
export type ActivityType = "install" | "view" | "search_click" | "import";

/** Individual event within a daily bucket */
export interface ActivityEvent {
  /** What happened */
  type: ActivityType;
  /** Who did it (optional for anonymous views) */
  userId?: ObjectId;
  /** When it happened */
  timestamp: Date;
  /** Additional context (e.g., search query that led here) */
  meta?: Record<string, string>;
}

/**
 * Daily activity bucket document.
 *
 * Per pattern-bucket: One document per skill per day.
 * This keeps documents small and bounded while enabling
 * efficient time-range queries and daily aggregations.
 */
export interface ActivityBucketDocument {
  _id: ObjectId;
  /** Which skill this bucket is for */
  skillId: ObjectId;
  /** Which team (for access control on analytics) */
  teamId: ObjectId;
  /** Date string for the bucket (YYYY-MM-DD) */
  date: string;
  /** Daily event count by type (pre-aggregated per pattern-computed) */
  counts: Record<ActivityType, number>;
  /** Individual events (bounded — daily max) */
  events: ActivityEvent[];
  createdAt: Date;
}
