/**
 * GET /api/v1 — Public API root / discovery endpoint.
 *
 * Returns API version info, available endpoints, rate limit info.
 * Per api-security-best-practices: no auth required for discovery.
 */

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    name: "AgentConfig API",
    version: "1.0.0",
    description: "Enterprise registry for AI agent configurations",
    endpoints: {
      auth: {
        "POST /api/auth/signin": "OAuth sign-in (GitHub)",
        "POST /api/v1/tokens": "Create API token (requires auth)",
      },
      system: {
        "GET /api/health": "Health and database readiness check",
      },
      organizations: {
        "GET /api/orgs": "List your organizations",
        "POST /api/orgs": "Create organization",
        "GET /api/orgs/{orgId}/departments": "List departments",
        "POST /api/orgs/{orgId}/departments": "Create department",
      },
      assets: {
        "GET /api/assets": "List assets for your accessible teams",
        "GET /api/assets/{id}": "Get asset by ID",
        "GET /api/search?q=": "Search assets across your accessible teams",
        "POST /api/assets/import": "Import asset from URL/GitHub",
        "GET /api/assets/{id}/export?format=": "Export asset (cursor, copilot, windsurf, codex, claude-code)",
        "GET /api/assets/{id}/install": "Install plugin (file tree)",
      },
      marketplace: {
        "GET /api/marketplace/{teamSlug}": "Team marketplace.json",
        "GET /api/marketplace/org/{orgSlug}": "Org marketplace.json",
      },
      copilot: {
        "POST /api/copilot/chat": "Copilot assistant chat",
      },
      approvals: {
        "GET /api/approvals": "List pending approvals",
        "POST /api/approvals": "Create approval request",
        "POST /api/approvals/{id}/review": "Submit review decision",
      },
    },
    rateLimits: {
      api: "100 requests/minute",
      auth: "20 requests/minute",
      marketplace: "200 requests/minute",
      copilot: "30 requests/minute",
    },
    authentication: {
      methods: ["OAuth (GitHub)", "API Token (Bearer)"],
      tokenPrefix: "ac_",
      header: "Authorization: Bearer ac_xxxxx_yyy...",
    },
    sdks: {
      cli: "npx agentconfig",
      extension: "Chrome Web Store (coming soon)",
    },
  });
}
