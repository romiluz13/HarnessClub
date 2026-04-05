/**
 * Organization document type definition.
 *
 * Per mongodb-schema-design fundamental-embed-vs-reference:
 * - OrgSettings embedded 1:1 (always accessed with org)
 * - departmentIds[] not embedded — departments are their own collection
 *   (accessed independently, have their own templates/assets)
 * - Owner cached via pattern-extended-reference (avoids $lookup)
 *
 * Per mongodb-schema-design pattern-polymorphic:
 * - plan field acts as type discriminator for billing behavior
 */

import type { ObjectId } from "mongodb";
import type { CachedUserRef } from "./team";

/** Organization billing plan */
export type OrgPlan = "free" | "team" | "enterprise";

/** Organization-level settings (embedded 1:1) */
export interface OrgSettings {
  /** Whether any team in the org can publish to marketplace */
  marketplaceEnabled: boolean;
  /** Require admin approval for cross-department sharing */
  crossDeptApprovalRequired: boolean;
  /** Default plan for new departments */
  defaultDeptType: DepartmentType;
  /** SSO/SAML configuration placeholder (Phase 13) */
  ssoEnabled: boolean;
}

/** Department type — determines default harness template */
export const DEPARTMENT_TYPES = [
  "engineering_fe",
  "engineering_be",
  "devops",
  "sales",
  "product",
  "legal",
  "marketing",
  "support",
  "custom",
] as const;

export type DepartmentType = (typeof DEPARTMENT_TYPES)[number];

/** Full organization document as stored in MongoDB */
export interface OrganizationDocument {
  _id: ObjectId;
  /** Display name */
  name: string;
  /** URL-safe unique slug */
  slug: string;
  /** Billing plan */
  plan: OrgPlan;
  /** Cached owner info (pattern-extended-reference) */
  owner: CachedUserRef;
  /** Embedded settings (1:1) */
  settings: OrgSettings;
  createdAt: Date;
  updatedAt: Date;
}

/** Input for creating a new organization */
export interface CreateOrgInput {
  name: string;
  slug: string;
  owner: CachedUserRef;
  plan?: OrgPlan;
  settings?: Partial<OrgSettings>;
}

/** Full department document as stored in MongoDB */
export interface DepartmentDocument {
  _id: ObjectId;
  /** Parent organization */
  orgId: ObjectId;
  /** Display name */
  name: string;
  /** Department type — drives template selection */
  type: DepartmentType;
  /** Optional description */
  description: string;
  /** Default asset IDs auto-assigned to new teams in this dept */
  defaultAssetIds: ObjectId[];
  /** Cached team count for display (approximation pattern) */
  teamCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Input for creating a new department */
export interface CreateDeptInput {
  orgId: ObjectId;
  name: string;
  type: DepartmentType;
  description?: string;
}
