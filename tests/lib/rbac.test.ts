/**
 * RBAC tests — pure logic, no DB needed.
 */

import { describe, it, expect } from "vitest";
import {
  hasPermission,
  isRoleAtLeast,
  canManageRole,
  getPermissions,
  isValidRole,
} from "@/lib/rbac";

describe("hasPermission", () => {
  it("viewer can only read", () => {
    expect(hasPermission("viewer", "team:read")).toBe(true);
    expect(hasPermission("viewer", "skill:read")).toBe(true);
    expect(hasPermission("viewer", "skill:create")).toBe(false);
    expect(hasPermission("viewer", "team:delete")).toBe(false);
  });

  it("member can create and update skills", () => {
    expect(hasPermission("member", "skill:create")).toBe(true);
    expect(hasPermission("member", "skill:update")).toBe(true);
    expect(hasPermission("member", "skill:delete")).toBe(false);
    expect(hasPermission("member", "skill:publish")).toBe(false);
  });

  it("admin can manage skills and members", () => {
    expect(hasPermission("admin", "skill:delete")).toBe(true);
    expect(hasPermission("admin", "skill:publish")).toBe(true);
    expect(hasPermission("admin", "team:manage_members")).toBe(true);
    expect(hasPermission("admin", "team:delete")).toBe(false);
  });

  it("owner has all permissions", () => {
    expect(hasPermission("owner", "team:delete")).toBe(true);
    expect(hasPermission("owner", "team:manage_members")).toBe(true);
    expect(hasPermission("owner", "marketplace:configure")).toBe(true);
  });
});

describe("isRoleAtLeast", () => {
  it("owner is at least every role", () => {
    expect(isRoleAtLeast("owner", "viewer")).toBe(true);
    expect(isRoleAtLeast("owner", "member")).toBe(true);
    expect(isRoleAtLeast("owner", "admin")).toBe(true);
    expect(isRoleAtLeast("owner", "owner")).toBe(true);
  });

  it("viewer is only at least viewer", () => {
    expect(isRoleAtLeast("viewer", "viewer")).toBe(true);
    expect(isRoleAtLeast("viewer", "member")).toBe(false);
  });
});

describe("canManageRole", () => {
  it("owner can manage anyone", () => {
    expect(canManageRole("owner", "admin")).toBe(true);
    expect(canManageRole("owner", "member")).toBe(true);
    expect(canManageRole("owner", "viewer")).toBe(true);
    expect(canManageRole("owner", "owner")).toBe(true);
  });

  it("admin can manage member and viewer but not owner", () => {
    expect(canManageRole("admin", "member")).toBe(true);
    expect(canManageRole("admin", "viewer")).toBe(true);
    expect(canManageRole("admin", "owner")).toBe(false);
    expect(canManageRole("admin", "admin")).toBe(false);
  });

  it("member and viewer cannot manage anyone", () => {
    expect(canManageRole("member", "viewer")).toBe(false);
    expect(canManageRole("viewer", "viewer")).toBe(false);
  });
});

describe("getPermissions", () => {
  it("returns correct count per role", () => {
    expect(getPermissions("viewer")).toHaveLength(2);
    expect(getPermissions("member")).toHaveLength(5);
    expect(getPermissions("admin")).toHaveLength(10);
    expect(getPermissions("owner")).toHaveLength(11);
  });
});

describe("isValidRole", () => {
  it("accepts valid roles", () => {
    expect(isValidRole("owner")).toBe(true);
    expect(isValidRole("admin")).toBe(true);
    expect(isValidRole("member")).toBe(true);
    expect(isValidRole("viewer")).toBe(true);
  });

  it("rejects invalid roles", () => {
    expect(isValidRole("superadmin")).toBe(false);
    expect(isValidRole("")).toBe(false);
    expect(isValidRole("OWNER")).toBe(false);
  });
});
