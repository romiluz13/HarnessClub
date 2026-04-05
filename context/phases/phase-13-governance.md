# Phase 13 — Enterprise Governance

## Status: ✅ COMPLETE

## Objective
SSO/SAML, SCIM directory sync, full audit logging, API tokens, compliance dashboard.
Extends lightweight audit from Phase 8.7.

## Dependencies
- Phase 11 (org/dept hierarchy for SSO mapping), Phase 12 (security for compliance)

## Tasks
- [ ] 13.1 SSO / SAML 2.0 integration (Okta, Azure AD, OneLogin, OIDC)
- [ ] 13.2 SCIM 2.0 directory sync (auto-provision, group mapping)
- [ ] 13.3 Full audit logging (extends 8.7: SIEM export, search UI, all actions)
- [ ] 13.4 API token management (PAT, service accounts, usage tracking)
- [ ] 13.5 Compliance dashboard (coverage, policy checks, reports)

## SSO Flow
1. User visits AgentConfig → redirected to IdP (Okta/Azure AD)
2. IdP authenticates → SAML assertion with attributes
3. AgentConfig receives assertion → JIT provision user
4. Map IdP groups → organization/department/team
5. User lands in correct dept with appropriate RBAC role

## Audit Schema
```typescript
interface AuditEntry {
  actor: { userId: string; email: string; ip: string; userAgent: string }
  action: 'create' | 'update' | 'delete' | 'share' | 'import' | 'export' | 'install' | 'scan' | 'approve' | 'reject' | 'auth'
  target: { id: string; type: AssetType; name: string }
  metadata: Record<string, unknown>
  timestamp: Date
  orgId: ObjectId
}
```

## Skill Guidelines Active
- **api-security-best-practices**: SSO implementation, token security, audit integrity

## Work Log
- 13.1 ✅ SSO/SAML/OIDC: SsoConfigDocument with SAML 2.0 (entity, cert, attr mapping) + OIDC (issuer, clientId, scopes). GroupMapping (IdP→org/dept/team). JIT provisioning. sso-service.ts.
- 13.2 ✅ SCIM 2.0: processScimUser (create/update/deactivate). ScimSyncStatus tracking. Audit logging for all SCIM events.
- 13.3 ✅ Full audit: 26 AuditAction types covering all operations. IP/UA/orgId tracking. SIEM export (Splunk/Datadog NDJSON format).
- 13.4 ✅ API tokens: SHA256 hashed, ac_ prefix, 3 scopes, 90-day expiry, instant revocation, usage tracking. PAT + service accounts.
- 13.5 ✅ Compliance dashboard: generateComplianceReport() with scan coverage, trust distribution, approval compliance, token hygiene. 12 new tests. Build verified.

## Lessons Learned
- Never store raw tokens — only hash. Show token once at creation time.
- SCIM/SSO types should be defined BEFORE implementation (contract-first design).
- SIEM export uses NDJSON (one JSON object per line) — compatible with Splunk HEC and Datadog HTTP intake.
