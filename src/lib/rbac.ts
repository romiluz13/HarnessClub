/**
 * Role-Based Access Control (RBAC) system.
 *
 * Per api-security-best-practices: enforce permissions on every action.
 * Per server-cache-react: cache permission checks with React.cache() per request.
 *
 * Role hierarchy (highest to lowest privilege):
 *   owner > admin > member > viewer
 *
 * Permissions matrix:
 *   owner:  full control (manage team, delete team, transfer ownership)
 *   admin:  manage skills, manage members (invite, change roles below admin)
 *   member: add/edit skills, view team
 *   viewer: read-only access to team and skills
 */

import type { TeamRole, OrgRole } from "@/types/team";

/** Permission actions in the system */
export type Permission =
  | "team:read"
  | "team:update"
  | "team:delete"
  | "team:manage_members"
  | "skill:read"
  | "skill:create"
  | "skill:update"
  | "skill:delete"
  | "skill:publish"
  | "marketplace:configure"
  | "analytics:read"
  | "org:read"
  | "org:update"
  | "org:delete"
  | "org:manage_members"
  | "org:manage_billing"
  | "dept:read"
  | "dept:create"
  | "dept:update"
  | "dept:delete"
  | "dept:manage_teams";

/** Role hierarchy — higher index = higher privilege */
const ROLE_HIERARCHY: TeamRole[] = ["viewer", "member", "admin", "owner"];

/** Permissions granted to each role */
const ROLE_PERMISSIONS: Record<TeamRole, Permission[]> = {
  viewer: ["team:read", "skill:read"],
  member: [
    "team:read",
    "skill:read",
    "skill:create",
    "skill:update",
    "analytics:read",
  ],
  admin: [
    "team:read",
    "team:update",
    "team:manage_members",
    "skill:read",
    "skill:create",
    "skill:update",
    "skill:delete",
    "skill:publish",
    "marketplace:configure",
    "analytics:read",
  ],
  owner: [
    "team:read",
    "team:update",
    "team:delete",
    "team:manage_members",
    "skill:read",
    "skill:create",
    "skill:update",
    "skill:delete",
    "skill:publish",
    "marketplace:configure",
    "analytics:read",
  ],
};

/**
 * Check if a role has a specific permission.
 */
export function hasPermission(role: TeamRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Check if roleA is >= roleB in the hierarchy.
 */
export function isRoleAtLeast(role: TeamRole, minimumRole: TeamRole): boolean {
  return ROLE_HIERARCHY.indexOf(role) >= ROLE_HIERARCHY.indexOf(minimumRole);
}

/**
 * Check if a user can manage another user's role.
 * Users can only manage roles below their own.
 * Owners cannot be managed by non-owners.
 */
export function canManageRole(
  managerRole: TeamRole,
  targetRole: TeamRole
): boolean {
  // Must have team:manage_members permission to manage anyone
  if (!hasPermission(managerRole, "team:manage_members")) return false;
  if (managerRole === "owner") return true;
  if (targetRole === "owner") return false;
  return (
    ROLE_HIERARCHY.indexOf(managerRole) > ROLE_HIERARCHY.indexOf(targetRole)
  );
}

/**
 * Get all permissions for a role.
 */
export function getPermissions(role: TeamRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/**
 * Validate that a string is a valid team role.
 */
export function isValidRole(value: string): value is TeamRole {
  return ROLE_HIERARCHY.includes(value as TeamRole);
}

// ─── Organization-Level RBAC (Phase 11) ──────────────────────────

/** Org role hierarchy — higher index = higher privilege */
const ORG_ROLE_HIERARCHY: OrgRole[] = ["member", "dept_admin", "org_admin", "org_owner"];

/** Permissions granted to each org role */
const ORG_ROLE_PERMISSIONS: Record<OrgRole, Permission[]> = {
  member: ["org:read", "dept:read", "team:read", "skill:read"],
  dept_admin: [
    "org:read", "dept:read", "dept:update", "dept:manage_teams",
    "team:read", "team:update", "team:manage_members",
    "skill:read", "skill:create", "skill:update", "skill:delete", "skill:publish",
    "marketplace:configure", "analytics:read",
  ],
  org_admin: [
    "org:read", "org:update", "org:manage_members",
    "dept:read", "dept:create", "dept:update", "dept:delete", "dept:manage_teams",
    "team:read", "team:update", "team:delete", "team:manage_members",
    "skill:read", "skill:create", "skill:update", "skill:delete", "skill:publish",
    "marketplace:configure", "analytics:read",
  ],
  org_owner: [
    "org:read", "org:update", "org:delete", "org:manage_members", "org:manage_billing",
    "dept:read", "dept:create", "dept:update", "dept:delete", "dept:manage_teams",
    "team:read", "team:update", "team:delete", "team:manage_members",
    "skill:read", "skill:create", "skill:update", "skill:delete", "skill:publish",
    "marketplace:configure", "analytics:read",
  ],
};

/**
 * Check if an org role has a specific permission.
 */
export function hasOrgPermission(role: OrgRole, permission: Permission): boolean {
  return ORG_ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Check if an org role is at least a certain level.
 */
export function isOrgRoleAtLeast(role: OrgRole, minimumRole: OrgRole): boolean {
  return ORG_ROLE_HIERARCHY.indexOf(role) >= ORG_ROLE_HIERARCHY.indexOf(minimumRole);
}

/**
 * Validate that a string is a valid org role.
 */
export function isValidOrgRole(value: string): value is OrgRole {
  return ORG_ROLE_HIERARCHY.includes(value as OrgRole);
}
