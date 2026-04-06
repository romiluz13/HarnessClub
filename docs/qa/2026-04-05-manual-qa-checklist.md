# Manual QA Checklist — 2026-04-05

## QA Runtime
- App URL: `http://127.0.0.1:3020`
- Runtime used for visual QA: `npx next start -H 127.0.0.1 -p 3020`
- Local Mongo used for QA: `mongodb://127.0.0.1:27019/?directConnection=true`
- QA database: `skillshub_qa`

## Important Caveat
- Do not use `npm run start` for local visual QA right now.
- On this worktree, `node .next/standalone/server.js` serves the app HTML but misses the built CSS chunk locally, which leaves the UI effectively unstyled.
- For manual QA, use the `next start` runtime until the standalone static-asset path is fixed.

## Seeded QA Data
- Personas:
  - `QA Owner` — manager/system admin role for local QA (`org_owner`, `team owner`)
  - `QA Employee` — employee role for local QA (`org member`, `team member`)
- Organization: `AgentConfig QA Org`
- Team: `Revenue Harness Team`
- Assets:
  - `Revenue Qualification Harness` (`skill`, published)
  - `Pipeline QA Agent` (`agent`, draft)
  - `Revenue Starter Bundle` (`plugin`, published)

## Local Persona Session Files
- Manager/session-admin: `/tmp/skillshub-manager-state.json`
- Employee/member: `/tmp/skillshub-employee-state.json`

These are real Auth.js session-state files for local browser testing without GitHub OAuth.

## High-Priority Manual Pass

### 1. Public App Smoke
- Open `/`
- Confirm landing page renders with hero, docs link, and sign-in CTA
- Open `/marketplace`
- Confirm the published skill and plugin are visible
- Open `/api/health`
- Expect `status: ok`

### 2. Authenticated Dashboard Shell
- Open `/dashboard`
- Confirm sidebar, top search, avatar, metrics cards, and activity feed render
- Expect:
  - Total Assets: `3`
  - Team Members: `2`
  - Teams: `1`
  - Pending Approvals: `0`

### 3. Asset Registry
- Open `/dashboard/assets`
- Confirm exactly 3 cards render
- Confirm published badges appear on:
  - `Revenue Qualification Harness`
  - `Revenue Starter Bundle`
- Confirm `Pipeline QA Agent` appears as draft/unpublished

### 4. Search
- Use the top search bar with `Revenue`
- Expect the app to navigate to `/dashboard/assets?q=Revenue`
- Expect exactly 2 matching results:
  - `Revenue Qualification Harness`
  - `Revenue Starter Bundle`

### 5. Asset Detail
- Open `/dashboard/assets/660000000000000000000401`
- Confirm:
  - title and version render
  - description panel renders
  - raw content block renders
  - live preview renders
  - export preview section renders

### 6. Teams
- Open `/dashboard/teams`
- Confirm `Revenue Harness Team` appears
- Confirm owner role is shown
- Confirm member count is `2`
- Confirm skill/asset count is `3`

### 7. Organization Settings
- Open `/dashboard/settings`
- Confirm the settings cards render
- Open `/dashboard/settings/organization`
- Confirm:
  - org name is `AgentConfig QA Org`
  - department section renders `Frontend Engineering`
  - department comparison table renders with team and asset counts

### 8. SSO Settings
- Open `/dashboard/settings/sso`
- Confirm the SAML/OIDC form renders
- Confirm provider selector, entity ID, SSO URL, certificate, and toggles are visible
- Do not save test values unless you want to mutate the QA seed state

### 9. Marketplace
- Open `/marketplace`
- Confirm public browse shows the published skill and plugin only
- Confirm the draft agent is not visible in marketplace browse

## Nice-to-Have Manual Pass
- Open asset type filters on `/dashboard/assets` and confirm they narrow correctly
- Open the user menu and confirm sign-out control appears
- Open `/dashboard/settings/api-tokens`
- Open `/dashboard/settings/webhooks`
- Open `/dashboard/approvals` and confirm the empty state is sensible with zero pending approvals

## What Was Programmatically Verified Before This Checklist
- `/api/health` returned `ok`
- `/api/auth/session` resolved correctly from a real Auth.js cookie
- `/api/assets` returned the seeded 3 assets
- `/api/teams` returned the seeded team
- Browser-rendered pages verified:
  - `/dashboard`
  - `/dashboard/assets`
  - `/dashboard/assets/660000000000000000000401`
  - `/dashboard/teams`
  - `/dashboard/settings`
  - `/dashboard/settings/organization`
  - `/dashboard/settings/sso`
  - `/marketplace`
