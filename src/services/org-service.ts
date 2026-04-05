/**
 * Organization + Department business logic service.
 *
 * Handles CRUD for orgs/depts, template provisioning, and hierarchy queries.
 * Per mongodb-schema-design: reference pattern for org→dept→team hierarchy.
 * Per api-security-best-practices: all mutations validate RBAC before execution.
 */

import { ObjectId, type Db } from "mongodb";
import type {
  OrganizationDocument,
  DepartmentDocument,
  CreateOrgInput,
  CreateDeptInput,
  OrgSettings,
} from "@/types/organization";
import type { CachedUserRef } from "@/types/team";

// ─── Organization CRUD ──────────────────────────────────────

/**
 * Create a new organization.
 */
export async function createOrg(
  db: Db,
  input: CreateOrgInput
): Promise<{ success: boolean; orgId?: ObjectId; error?: string }> {
  const now = new Date();
  const settings: OrgSettings = {
    marketplaceEnabled: input.settings?.marketplaceEnabled ?? true,
    crossDeptApprovalRequired: input.settings?.crossDeptApprovalRequired ?? false,
    defaultDeptType: input.settings?.defaultDeptType ?? "engineering_fe",
    ssoEnabled: input.settings?.ssoEnabled ?? false,
  };

  const doc: Omit<OrganizationDocument, "_id"> = {
    name: input.name,
    slug: input.slug,
    plan: input.plan ?? "free",
    owner: input.owner,
    settings,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const result = await db.collection("organizations").insertOne(doc);
    return { success: true, orgId: result.insertedId };
  } catch (err: unknown) {
    if ((err as { code?: number }).code === 11000) {
      return { success: false, error: "Organization slug already exists" };
    }
    throw err;
  }
}

/**
 * Get organization by slug.
 */
export async function getOrgBySlug(
  db: Db,
  slug: string
): Promise<OrganizationDocument | null> {
  return db.collection<OrganizationDocument>("organizations").findOne({ slug });
}

/**
 * Get organization by ID.
 */
export async function getOrgById(
  db: Db,
  orgId: ObjectId
): Promise<OrganizationDocument | null> {
  return db.collection<OrganizationDocument>("organizations").findOne({ _id: orgId });
}

/**
 * List organizations for a user (by owner OR orgMemberships on user doc).
 */
export async function listUserOrgs(
  db: Db,
  userId: ObjectId
): Promise<OrganizationDocument[]> {
  // Get org IDs from user memberships
  const user = await db.collection("users").findOne({ _id: userId });
  const memberOrgIds = (user?.orgMemberships ?? []).map(
    (m: { orgId: ObjectId }) => m.orgId
  );

  // Query by owner OR membership (deduplicated by $or)
  return db.collection<OrganizationDocument>("organizations")
    .find({
      $or: [
        { "owner.userId": userId },
        { _id: { $in: memberOrgIds } },
      ],
    })
    .sort({ name: 1 })
    .toArray();
}

// ─── Department CRUD ──────────────────────────────────────

/**
 * Create a department.
 * Starter assets are provisioned only after a real team exists.
 */
export async function createDepartment(
  db: Db,
  input: CreateDeptInput,
  _createdBy: ObjectId
): Promise<{ success: boolean; deptId?: ObjectId; assetIds?: ObjectId[]; error?: string }> {
  const now = new Date();

  const doc: Omit<DepartmentDocument, "_id"> = {
    orgId: input.orgId,
    name: input.name,
    type: input.type,
    description: input.description ?? "",
    defaultAssetIds: [],
    teamCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const result = await db.collection("departments").insertOne(doc);
    return { success: true, deptId: result.insertedId, assetIds: [] };
  } catch (err: unknown) {
    if ((err as { code?: number }).code === 11000) {
      return { success: false, error: "Department name already exists in this organization" };
    }
    throw err;
  }
}

/**
 * List departments in an organization.
 */
export async function listDepartments(
  db: Db,
  orgId: ObjectId
): Promise<DepartmentDocument[]> {
  return db.collection<DepartmentDocument>("departments")
    .find({ orgId })
    .sort({ name: 1 })
    .toArray();
}

/**
 * Get a department by ID.
 */
export async function getDepartment(
  db: Db,
  deptId: ObjectId
): Promise<DepartmentDocument | null> {
  return db.collection<DepartmentDocument>("departments").findOne({ _id: deptId });
}
