# Phase 3 — Authentication & RBAC

## Status: ✅ COMPLETE

## Objective
NextAuth.js with GitHub OAuth. Team-scoped RBAC with Owner/Admin/Member/Viewer roles.

## Tasks
- [x] 3.1 NextAuth.js Setup — src/lib/auth.ts (Auth.js v5, GitHub OAuth, MongoDB adapter, JWT sessions)
- [x] 3.2 RBAC System — src/lib/rbac.ts (4 roles, 11 permissions, role hierarchy, permission checks)
- [x] 3.3 Team Management — src/services/team-service.ts (CRUD, membership, slug generation) + src/lib/auth-guard.ts (requireAuth, requireTeamRole, requirePermission)
- [x] 3.4 Auth Tests — 25 new tests (RBAC permissions matrix, slug generation). Total: 89 tests passing

## Skill Guidelines Active This Phase
- **vercel-react-best-practices**: server-auth-actions (auth on every route), async-parallel (parallelize team+user updates)
- **api-security-best-practices**: fail closed, permission checks before every mutation

## Work Log
### All Tasks Completed — 2026-04-01
- Installed next-auth@beta + @auth/mongodb-adapter
- Created Auth.js v5 config with GitHub OAuth and MongoDB adapter
- Created RBAC with 4-level role hierarchy and 11 granular permissions
- Created auth guards: requireAuth(), requireTeamRole(), requirePermission()
- Created team service: createTeam, addMember, removeMember, updateRole, getBySlug, getUserTeams, generateUniqueSlug
- Fixed canManageRole bug: members shouldn't manage viewers (need manage_members permission first)

## Lessons Learned
- Auth.js v5 uses `next-auth@beta` package, not `@auth/nextjs` — naming is confusing
- canManageRole must check permission FIRST, then hierarchy — otherwise member > viewer passes but shouldn't
- MongoDB adapter auto-creates users/accounts/sessions collections — may conflict with our schema setup
- JWT strategy avoids session storage in DB but token size matters for cookie limits
