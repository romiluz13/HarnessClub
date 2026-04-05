/**
 * User document type definition.
 *
 * Per mongodb-schema-design fundamental-embed-vs-reference:
 * - teamMemberships[] embedded (bounded — a user joins at most ~20 teams)
 *   Each entry contains teamId + role, avoiding a separate join table
 * - Per fundamental-schema-validation: enforce enum on roles
 */

import type { ObjectId } from "mongodb";
import type { TeamRole, OrgRole } from "./team";

/** Embedded team membership (bounded array, max ~20 per user) */
export interface TeamMembership {
  teamId: ObjectId;
  role: TeamRole;
  joinedAt: Date;
}

/** Embedded org membership (Phase 11, bounded array, max ~5 per user) */
export interface OrgMembership {
  orgId: ObjectId;
  role: OrgRole;
  /** Optional: scope to specific department (dept_admin role) */
  departmentId?: ObjectId;
  joinedAt: Date;
}

/** Authentication provider info */
export interface AuthProvider {
  provider: "github";
  providerId: string;
}

/** Full user document as stored in MongoDB */
export interface UserDocument {
  _id: ObjectId;
  /** Email address (unique) */
  email: string;
  /** Display name */
  name: string;
  /** Avatar URL from auth provider */
  avatarUrl?: string;
  /** Auth provider details */
  auth: AuthProvider;
  /** Embedded team memberships (bounded, ~20 max) */
  teamMemberships: TeamMembership[];
  /** Embedded org memberships (Phase 11, bounded, ~5 max) */
  orgMemberships?: OrgMembership[];
  createdAt: Date;
  updatedAt: Date;
}
