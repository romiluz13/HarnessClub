/**
 * Organization Hierarchy Tests — org/dept/team structure,
 * department templates, and RBAC expansion.
 *
 * Tests core logic without HTTP (service-level).
 */

import { describe, it, expect } from "vitest";
import {
  getDepartmentTemplate,
  getAllDepartmentTemplates,
  getDepartmentTemplateSummaries,
} from "@/services/department-templates";
import {
  hasOrgPermission,
  isOrgRoleAtLeast,
  isValidOrgRole,
} from "@/lib/rbac";
import type { OrgRole } from "@/types/team";
import { DEPARTMENT_TYPES, type DepartmentType } from "@/types/organization";

describe("Department Templates", () => {
  it("provides templates for all 8 non-custom types", () => {
    const templates = getAllDepartmentTemplates();
    expect(templates).toHaveLength(8);
  });

  it("returns undefined for custom type", () => {
    const template = getDepartmentTemplate("custom");
    expect(template).toBeUndefined();
  });

  it("engineering_fe has starter assets", () => {
    const template = getDepartmentTemplate("engineering_fe");
    expect(template).toBeDefined();
    expect(template!.assets.length).toBeGreaterThanOrEqual(2);
    expect(template!.assets[0].type).toBe("rule");
    expect(template!.assets[0].tags).toContain("frontend");
  });

  it("engineering_be has API design standards", () => {
    const template = getDepartmentTemplate("engineering_be");
    expect(template).toBeDefined();
    expect(template!.assets.length).toBeGreaterThanOrEqual(1);
    expect(template!.assets[0].tags).toContain("api");
  });

  it("sales has discovery framework", () => {
    const template = getDepartmentTemplate("sales");
    expect(template).toBeDefined();
    expect(template!.assets[0].tags).toContain("meddpicc");
  });

  it("all templates have display info", () => {
    const summaries = getDepartmentTemplateSummaries();
    expect(summaries).toHaveLength(8);
    for (const s of summaries) {
      expect(s.displayName).toBeTruthy();
      expect(s.description).toBeTruthy();
      expect(s.icon).toBeTruthy();
      expect(typeof s.assetCount).toBe("number");
    }
  });

  it("all DEPARTMENT_TYPES are valid", () => {
    expect(DEPARTMENT_TYPES).toContain("engineering_fe");
    expect(DEPARTMENT_TYPES).toContain("devops");
    expect(DEPARTMENT_TYPES).toContain("sales");
    expect(DEPARTMENT_TYPES).toContain("custom");
    expect(DEPARTMENT_TYPES.length).toBe(9); // 8 + custom
  });
});

describe("Org RBAC", () => {
  it("org_owner has all permissions", () => {
    expect(hasOrgPermission("org_owner", "org:delete")).toBe(true);
    expect(hasOrgPermission("org_owner", "org:manage_billing")).toBe(true);
    expect(hasOrgPermission("org_owner", "dept:create")).toBe(true);
    expect(hasOrgPermission("org_owner", "skill:publish")).toBe(true);
  });

  it("org_admin cannot delete org or manage billing", () => {
    expect(hasOrgPermission("org_admin", "org:delete")).toBe(false);
    expect(hasOrgPermission("org_admin", "org:manage_billing")).toBe(false);
    expect(hasOrgPermission("org_admin", "dept:create")).toBe(true);
    expect(hasOrgPermission("org_admin", "dept:delete")).toBe(true);
  });

  it("dept_admin can manage teams but not org", () => {
    expect(hasOrgPermission("dept_admin", "dept:manage_teams")).toBe(true);
    expect(hasOrgPermission("dept_admin", "skill:create")).toBe(true);
    expect(hasOrgPermission("dept_admin", "org:update")).toBe(false);
    expect(hasOrgPermission("dept_admin", "dept:create")).toBe(false);
  });

  it("member has read-only permissions", () => {
    expect(hasOrgPermission("member", "org:read")).toBe(true);
    expect(hasOrgPermission("member", "dept:read")).toBe(true);
    expect(hasOrgPermission("member", "skill:read")).toBe(true);
    expect(hasOrgPermission("member", "skill:create")).toBe(false);
    expect(hasOrgPermission("member", "org:update")).toBe(false);
  });

  it("isOrgRoleAtLeast works correctly", () => {
    expect(isOrgRoleAtLeast("org_owner", "org_admin")).toBe(true);
    expect(isOrgRoleAtLeast("org_admin", "dept_admin")).toBe(true);
    expect(isOrgRoleAtLeast("dept_admin", "org_admin")).toBe(false);
    expect(isOrgRoleAtLeast("member", "dept_admin")).toBe(false);
    expect(isOrgRoleAtLeast("member", "member")).toBe(true);
  });

  it("isValidOrgRole validates roles", () => {
    expect(isValidOrgRole("org_owner")).toBe(true);
    expect(isValidOrgRole("org_admin")).toBe(true);
    expect(isValidOrgRole("dept_admin")).toBe(true);
    expect(isValidOrgRole("member")).toBe(true);
    expect(isValidOrgRole("superadmin")).toBe(false);
    expect(isValidOrgRole("")).toBe(false);
  });
});
