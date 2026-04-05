# Phase 11 — Organization & Department System

## Status: ✅ COMPLETE

## Objective
Build org → department → team hierarchy with 8 pre-built department harness templates.

## Dependencies
- Phase 8 (asset model), Phase 10 (plugin bundles for harnesses)

## Tasks
- [ ] 11.1 Organization → Department → Team hierarchy (collections, RBAC expansion)
- [ ] 11.2 Department templates — 8 pre-built harnesses
- [ ] 11.3 Department onboarding flow (create → select type → provision)
- [ ] 11.4 Department dashboard views (per-dept library, analytics, cross-dept discovery)
- [ ] 11.5 Marketplace scoping (org-level and dept-level marketplace.json)

## Department Templates
| Type | Harness Contents |
|------|-----------------|
| Engineering (FE) | React/Next.js skills, code review agent, eslint rules, testing agent |
| Engineering (BE) | API design skills, DB skills, security agent, CI/CD rules |
| DevOps | Docker skills, K8s agent, monitoring rules, deployment hooks |
| Sales | Prospect research agent, outreach skill, CRM rules |
| Product | PRD writing skill, user research agent, roadmap rules |
| Legal | Contract review agent, compliance rules, privacy skill |
| Marketing | Content creation skill, analytics agent, brand voice rules |
| Support | Ticket triage agent, KB skill, escalation rules |

## RBAC Expansion
| Role | Scope | Can Do |
|------|-------|--------|
| org_admin | Entire org | Everything + billing + SSO config |
| dept_admin | Department | Manage dept teams, approve cross-dept sharing |
| team_admin | Team | Manage team members, assets |
| member | Team | View, use, suggest |

## Skill Guidelines Active
- **mongodb-schema-design**: org/dept/team references, compound indexes
- **vercel-composition-patterns**: department layout composition, template rendering

## Work Log
(Updated as tasks complete)

## Lessons Learned
(Updated after phase completion)
