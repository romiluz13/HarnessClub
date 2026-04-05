/**
 * Team document type definition.
 *
 * Per mongodb-schema-design:
 * - Settings embedded 1:1 (always accessed with team)
 * - memberIds[] bounded array (<1000 members per team)
 * - Owner name/email cached via pattern-extended-reference
 *   (avoids $lookup on every team display)
 */

import type { ObjectId } from "mongodb";

/** Roles for team membership — ordered by privilege level */
export type TeamRole = "owner" | "admin" | "member" | "viewer";

/** Organization-scoped roles (Phase 11) */
export type OrgRole = "org_owner" | "org_admin" | "dept_admin" | "member";

/** Cached owner info per pattern-extended-reference */
export interface CachedUserRef {
  userId: ObjectId;
  name: string;
  email: string;
}

/** Team-level settings (embedded 1:1) */
export interface TeamSettings {
  /** Whether the team's marketplace endpoint is publicly accessible */
  marketplaceEnabled: boolean;
  /** Default role for new members joining via invite */
  defaultRole: TeamRole;
  /** Whether members can publish skills to marketplace without admin approval */
  autoPublish: boolean;
}

/** Full team document as stored in MongoDB */
export interface TeamDocument {
  _id: ObjectId;
  /** Unique display name */
  name: string;
  /** URL-safe unique slug (e.g., "acme-corp") */
  slug: string;
  /** Cached owner info (pattern-extended-reference) */
  owner: CachedUserRef;
  /** Bounded member list — max 1000 per team */
  memberIds: ObjectId[];
  /** Embedded settings (1:1, always accessed with team) */
  settings: TeamSettings;
  /** Parent organization (Phase 11, optional for backward compat) */
  orgId?: ObjectId;
  /** Parent department (Phase 11, optional for backward compat) */
  departmentId?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/** Input for creating a new team */
export interface CreateTeamInput {
  name: string;
  slug: string;
  owner: CachedUserRef;
}
