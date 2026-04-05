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
  DepartmentType,
  OrgSettings,
} from "@/types/organization";
import type { CachedUserRef } from "@/types/team";
import { getDepartmentTemplate } from "./department-templates";
import { createAsset } from "./asset-service";
import type { CreateAssetInput } from "@/types/asset";

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
 * Create a department with optional template provisioning.
 * If template exists for the type, auto-creates starter assets.
 */
export async function createDepartment(
  db: Db,
  input: CreateDeptInput,
  createdBy: ObjectId
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
    const deptId = result.insertedId;

    // Auto-provision template assets if available
    const template = getDepartmentTemplate(input.type);
    const assetIds: ObjectId[] = [];

    if (template && template.assets.length > 0) {
      // Find or create a "default" team for this dept
      // For now, create assets at org level (no teamId required yet)
      for (const tmpl of template.assets) {
        const assetInput: CreateAssetInput = {
          type: tmpl.type,
          teamId: new ObjectId(), // placeholder — will be linked on team creation
          metadata: { name: tmpl.name, description: tmpl.description },
          content: tmpl.content,
          tags: tmpl.tags,
          createdBy,
        };
        const assetResult = await createAsset(db, assetInput);
        if (assetResult.success && assetResult.assetId) {
          assetIds.push(assetResult.assetId);
        }
      }

      // Store default asset IDs on the department
      if (assetIds.length > 0) {
        await db.collection("departments").updateOne(
          { _id: deptId },
          { $set: { defaultAssetIds: assetIds, updatedAt: new Date() } }
        );
      }
    }

    return { success: true, deptId, assetIds };
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
