/**
 * GET /api/marketplace/:teamSlug — Claude Code marketplace.json endpoint.
 *
 * Returns marketplace.json format compatible with Claude Code plugin system:
 * - extraKnownMarketplaces setting points here
 * - Contains name, metadata.description, and plugins[] array
 * - Plugin entries include version, type, tags, and source
 * - ETag + Cache-Control for efficient polling
 * - Supports ?type= filter for type-specific listings
 *
 * Public endpoint — no auth required (marketplace is public for Claude Code).
 * Only published assets are included.
 *
 * Per api-security-best-practices: input validation, cache headers.
 */

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getDb } from "@/lib/db";
import type { TeamDocument } from "@/types/team";
import type { AssetDocument, AssetType, ASSET_TYPES } from "@/types/asset";

interface MarketplacePlugin {
  name: string;
  description?: string;
  type?: string;
  version?: string;
  tags?: string[];
  source: {
    source: "github" | "url";
    repo?: string;
    ref?: string;
    url?: string;
  };
}

interface MarketplaceJson {
  name: string;
  metadata: {
    description: string;
    version: string;
    updatedAt: string;
    assetCount: number;
    typeBreakdown: Record<string, number>;
  };
  plugins: MarketplacePlugin[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamSlug: string }> }
) {
  const { teamSlug } = await params;

  if (!teamSlug || teamSlug.length > 100) {
    return NextResponse.json({ error: "Invalid team slug" }, { status: 400 });
  }

  const db = await getDb();

  // Find team by slug
  const team = await db.collection<TeamDocument>("teams").findOne(
    { slug: teamSlug },
    { projection: { _id: 1, name: 1, slug: 1, settings: 1 } }
  );

  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  // Optional type filter
  const typeFilter = request.nextUrl.searchParams.get("type");
  const query: Record<string, unknown> = { teamId: team._id, isPublished: true };
  if (typeFilter) {
    query.type = typeFilter;
  }

  // Get published assets for this team
  const assets = await db
    .collection<AssetDocument>("assets")
    .find(query, {
      projection: {
        type: 1,
        "metadata.name": 1,
        "metadata.description": 1,
        "metadata.version": 1,
        "source.repoUrl": 1,
        "source.ref": 1,
        tags: 1,
        updatedAt: 1,
      },
    })
    .sort({ type: 1, "metadata.name": 1 })
    .toArray();

  // Build type breakdown
  const typeBreakdown: Record<string, number> = {};
  for (const asset of assets) {
    typeBreakdown[asset.type] = (typeBreakdown[asset.type] ?? 0) + 1;
  }

  // Build marketplace.json
  const baseUrl = getBaseUrl(request);
  const marketplace: MarketplaceJson = {
    name: team.slug,
    metadata: {
      description: `${team.name} agent config registry on AgentConfig`,
      version: "2.0.0",
      updatedAt: new Date().toISOString(),
      assetCount: assets.length,
      typeBreakdown,
    },
    plugins: assets.map((asset) => {
      const plugin: MarketplacePlugin = {
        name: asset.metadata.name
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "-")
          .replace(/-+/g, "-"),
        description: asset.metadata.description,
        type: asset.type,
        version: asset.metadata.version,
        tags: asset.tags.length > 0 ? asset.tags : undefined,
        source: asset.source?.repoUrl
          ? {
              source: "github",
              repo: extractGitHubRepo(asset.source.repoUrl),
            }
          : {
              source: "url",
              url: `${baseUrl}/api/assets/${asset._id.toHexString()}/export?format=claude-code`,
            },
      };
      return plugin;
    }),
  };

  // Generate ETag from content hash
  const body = JSON.stringify(marketplace, null, 2);
  const etag = `"${createHash("md5").update(body).digest("hex")}"`;

  // ETag conditional check
  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch === etag) {
    return new NextResponse(null, { status: 304 });
  }

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      ETag: etag,
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}

/** Extract "owner/repo" from a GitHub URL */
function extractGitHubRepo(url: string): string {
  const match = url.match(/github\.com[/:]([^/]+\/[^/.]+)/);
  return match ? match[1] : url;
}

/** Get base URL from request */
function getBaseUrl(request: NextRequest): string {
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const host = request.headers.get("host") || "localhost:3000";
  return `${proto}://${host}`;
}
