# v2 Methodology Alignment — What We Built, How We Built It, What Carries Forward

## THE METHODOLOGY WE FOLLOWED (and MUST continue)

### 1. Context Engineering Protocol
**Every session**: Read STATE.md → Phase file → GOTCHAS → PATTERNS → Work → Update all.
**Status**: This MUST carry forward into v2. The context/ folder is our living memory.

### 2. Phase-Based Incremental Build
**Pattern**: 8 phases, each with 3-5 tasks, each task testable independently.
**Status**: v2 needs a NEW phase plan, but the phase methodology stays.

### 3. TDD with Zero Mocks
**Pattern**: Real MongoDB (atlas-local Docker), real Voyage AI, real GitHub API calls.
**Status**: 109 tests, 0 failures, 0 mocks. This is our superpower — keep it.

### 4. Skill Guidelines as Guardrails
**Pattern**: 15 installed skill guidelines consulted per-task. Skills reference table.
**Status**: Need to add new skills for v2 scope (cross-tool distribution, plugin parsing, etc.)

### 5. Architecture Decision Records (ADRs)
**Pattern**: Every non-trivial decision gets an ADR in DECISIONS.md with context/alternatives/consequences.
**Status**: 8 ADRs so far. v2 pivot is ADR-009 at minimum.

---

## WHAT WE BUILT (Asset Inventory)

### Infrastructure (KEEP AS-IS)
| File | What | v2 Status |
|------|------|-----------|
| `src/lib/db.ts` | MongoDB singleton, globalThis cache, M0 pool | ✅ KEEP |
| `src/lib/config.ts` | Type-safe env config with validation | ✅ KEEP |
| `src/lib/voyage.ts` | Voyage AI embedding client (512d) | ✅ KEEP |
| `src/lib/setup-db.ts` | Collection creation with $jsonSchema validators | ⚠️ EXPAND (new collections) |
| `src/lib/auth.ts` | Auth.js v5 + GitHub OAuth | ✅ KEEP |
| `src/lib/auth-guard.ts` | Route-level auth guards | ✅ KEEP |
| `src/lib/rbac.ts` | 4-role RBAC with 11 permissions | ⚠️ EXPAND (dept-scoped roles) |
| `src/lib/schema.ts` | $jsonSchema validators for collections | ⚠️ EXPAND (new asset types) |

### Services (KEEP + EXPAND)
| File | What | v2 Status |
|------|------|-----------|
| `src/services/team-service.ts` | Team CRUD, member management, slug gen | ⚠️ EXPAND (departments, org hierarchy) |
| `src/services/search.ts` | Atlas Search lexical search | ✅ KEEP |
| `src/services/search-hybrid.ts` | Hybrid search ($rankFusion + RRF fallback) | ⚠️ EXPAND (search all asset types) |
| `src/services/embedding-pipeline.ts` | Generate + store embeddings on create/update | ✅ KEEP |
| `src/services/github-import.ts` | Import SKILL.md/AGENTS.md/CLAUDE.md from GitHub | ⚠️ EXPAND (import plugins, rules, MCP configs) |

### Types (EXPAND SIGNIFICANTLY)
| File | What | v2 Status |
|------|------|-----------|
| `src/types/skill.ts` | Skill document interface | ⚠️ RENAME → asset.ts or expand |
| `src/types/team.ts` | Team + membership interfaces | ⚠️ EXPAND (departments) |
| `src/types/user.ts` | User document interface | ✅ KEEP |
| `src/types/activity.ts` | Activity log interface | ✅ KEEP |

### API Routes (EXPAND)
| Route | What | v2 Status |
|-------|------|-----------|
| `/api/skills` | CRUD for skills | ⚠️ GENERALIZE → /api/assets |
| `/api/skills/[id]` | Single skill GET+PATCH | ⚠️ GENERALIZE |
| `/api/search` | Hybrid search | ⚠️ EXPAND (multi-type search) |
| `/api/teams` | Team CRUD | ✅ KEEP |
| `/api/import` | GitHub import | ⚠️ EXPAND (plugin import, multi-format) |
| `/api/marketplace/[teamSlug]` | marketplace.json generation | ⚠️ EXPAND (plugin marketplace format) |

### UI Components (KEEP + RESTYLE)
| Component | What | v2 Status |
|-----------|------|-----------|
| `dashboard-shell.tsx` | Layout shell | ✅ KEEP |
| `sidebar.tsx` | Navigation sidebar | ⚠️ EXPAND (new nav items) |
| `skill-card.tsx` | Skill display card | ⚠️ GENERALIZE → asset-card |
| `search-bar.tsx` | Cmd+K search with autocomplete | ✅ KEEP |
| `import-skill-modal.tsx` | GitHub import dialog | ⚠️ EXPAND (multi-format import) |
| `teams-list.tsx` | Team listing | ✅ KEEP |

### Tests (109 passing — KEEP + EXPAND)
All tests in `tests/` — real MongoDB, real Voyage AI, zero mocks. This is gold.

---

## v2 EVOLUTION STRATEGY: EXPAND, DON'T REWRITE

### The Key Insight
We don't need to throw away anything. The architecture is sound:
- MongoDB document model → naturally stores ANY asset type (skills, rules, plugins, agents)
- Voyage AI embeddings → works on any text content
- RBAC system → just needs dept-scoping added
- Search infrastructure → just needs multi-type filtering
- Marketplace endpoint → just needs plugin format support

### What ACTUALLY Changes
1. **Data model**: `skills` collection → `assets` collection with `type` discriminator
2. **Types**: Add asset types: `skill | rule | plugin | agent | mcp_config | settings_template | hook`
3. **RBAC**: Add department concept: `org → department → team → member`
4. **Search**: Add `type` filter to existing hybrid search
5. **Import**: Add parsers for: plugin.json, .cursorrules, .windsurfrules, copilot-instructions.md
6. **Export**: Add format translators: asset → Claude Code format, Cursor format, Copilot format
7. **Marketplace**: Expand to generate full plugin marketplace.json (not just skills)
8. **UI**: Generalize "skills" to "assets" with type tabs/filters

### What STAYS THE SAME
- MongoDB Atlas as database ✅
- Voyage AI for embeddings ✅
- Next.js App Router ✅
- Auth.js + GitHub OAuth ✅
- Context engineering protocol ✅
- TDD with zero mocks ✅

---

## PROPOSED v2 PHASE PLAN (Following Our Methodology)

### Phase 8: v2 Data Model Expansion
- 8.1: Generalize `skills` → `assets` collection with type discriminator
- 8.2: Add asset types schema: skill, rule, plugin, agent, mcp_config, settings_template, hook
- 8.3: Update $jsonSchema validators for all asset types
- 8.4: Migrate existing skills data (add `type: "skill"` field)
- 8.5: Update search indexes for multi-type search

### Phase 9: Cross-Tool Format Engine
- 9.1: Parser registry (detect and parse any agent config format)
- 9.2: Import parsers: plugin.json, .cursorrules, .cursor/rules/*.mdc, .windsurfrules, copilot-instructions.md, AGENTS.md
- 9.3: Export translators: asset → Claude Code, Cursor, Copilot, Windsurf, Codex format
- 9.4: Format validation and linting

### Phase 10: Department-Scoped RBAC
- 10.1: Organization → Department → Team hierarchy
- 10.2: Department-scoped permissions (eng admin ≠ sales admin)
- 10.3: Department-based asset browsing and filtering
- 10.4: Role templates per department type

### Phase 11: Plugin Marketplace Engine
- 11.1: Full plugin bundle support (skills + agents + hooks + MCP in one package)
- 11.2: Plugin marketplace.json generation (Claude Code native format)
- 11.3: Self-hostable marketplace endpoint
- 11.4: Plugin versioning and update tracking

### Phase 12: Multi-Department Asset Library
- 12.1: Department templates: Engineering, Sales, Product, Legal, Marketing, DevOps
- 12.2: Department-specific asset categories and tags
- 12.3: Cross-department asset sharing with approval workflows
- 12.4: Department onboarding flow (import existing configs)

### Phase 13: Enterprise Governance
- 13.1: SSO/SAML 2.0 integration
- 13.2: SCIM 2.0 directory sync
- 13.3: Audit logging (every action, 90-day retention)
- 13.4: API token management (hashed, revocable)
- 13.5: Compliance dashboard

### Phase 14: Security & Trust
- 14.1: Asset security scanning (prompt injection, credential theft patterns)
- 14.2: Trust scores and provenance tracking
- 14.3: Approval workflows for asset publishing
- 14.4: Supply chain security (upstream tracking)

### Phase 15: Polish & Launch
- 15.1: Performance audit (Core Web Vitals, query optimization)
- 15.2: Landing page + marketing site
- 15.3: Documentation site
- 15.4: Public API with rate limiting
- 15.5: Launch checklist

---

## CRITICAL: What We Must NOT Do
1. ❌ Don't rewrite what works — EXPAND the existing codebase
2. ❌ Don't break the test suite — 109 tests are our safety net
3. ❌ Don't skip the context protocol — read/write context/ every session
4. ❌ Don't skip ADRs — the v2 pivot needs ADR-009, every new decision gets an ADR
5. ❌ Don't skip skill guidelines — consult the right skill for each task
6. ❌ Don't use deprecated Claude Code features — skills (not commands), plugins (not loose files)
7. ❌ Don't compete with skills.sh on public discovery — win on enterprise + cross-tool + multi-dept
