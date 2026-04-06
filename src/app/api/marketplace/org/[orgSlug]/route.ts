/**
 * GET /api/marketplace/org/:orgSlug — Org-level marketplace.json.
 *
 * Aggregates ALL published assets from ALL teams in the organization.
 * Supports ?type= and ?dept= filters.
 * Public endpoint — Claude Code can poll this for org-wide plugin registries.
 *
 * Per api-security-best-practices: public endpoint, cache headers, ETag.
 */

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getDb } from "@/lib/db";
import type { OrganizationDocument } from "@/types/organization";
import type { AssetDocument } from "@/types/asset";
import { getPublishedDistributionFilter } from "@/services/asset-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgSlug: string }> }
) {
  const { orgSlug } = await params;

  if (!orgSlug || orgSlug.length > 100) {
    return NextResponse.json({ error: "Invalid org slug" }, { status: 400 });
  }

  const db = await getDb();

  // Find org by slug
  const org = await db.collection<OrganizationDocument>("organizations").findOne(
    { slug: orgSlug },
    { projection: { _id: 1, name: 1, slug: 1, settings: 1 } }
  );

  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  if (!org.settings.marketplaceEnabled) {
    return NextResponse.json({ error: "Marketplace not enabled for this organization" }, { status: 403 });
  }

  // Get all teams in org (optionally filtered by department)
  const teamQuery: Record<string, unknown> = { orgId: org._id };
  const deptFilter = request.nextUrl.searchParams.get("dept");
  if (deptFilter) {
    const { ObjectId } = await import("mongodb");
    try {
      teamQuery.departmentId = new ObjectId(deptFilter);
    } catch {
      return NextResponse.json({ error: "Invalid dept filter" }, { status: 400 });
    }
  }

  const teams = await db.collection("teams").find(teamQuery).project({ _id: 1 }).toArray();
  const teamIds = teams.map((t) => t._id);

  // Get published assets
  const assetQuery: Record<string, unknown> = {
    teamId: { $in: teamIds },
    ...getPublishedDistributionFilter(),
  };
  const typeFilter = request.nextUrl.searchParams.get("type");
  if (typeFilter) assetQuery.type = typeFilter;

  const assets = await db.collection<AssetDocument>("assets")
    .find(assetQuery, {
      projection: {
        type: 1, "metadata.name": 1, "metadata.description": 1,
        "metadata.version": 1, tags: 1, "source.repoUrl": 1, updatedAt: 1,
      },
    })
    .sort({ type: 1, "metadata.name": 1 })
    .toArray();

  // Type breakdown
  const typeBreakdown: Record<string, number> = {};
  for (const a of assets) {
    typeBreakdown[a.type] = (typeBreakdown[a.type] ?? 0) + 1;
  }

  const baseUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}`;
  const marketplace = {
    name: org.slug,
    metadata: {
      description: `${org.name} organization registry on AgentConfig`,
      version: "2.0.0",
      updatedAt: new Date().toISOString(),
      assetCount: assets.length,
      typeBreakdown,
    },
    plugins: assets.map((a) => ({
      name: a.metadata.name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-"),
      description: a.metadata.description,
      type: a.type,
      version: a.metadata.version,
      tags: a.tags.length > 0 ? a.tags : undefined,
      source: a.source?.repoUrl
        ? { source: "github" as const, repo: a.source.repoUrl.replace("https://github.com/", "") }
        : { source: "url" as const, url: `${baseUrl}/api/assets/${a._id.toHexString()}/export?format=claude-code` },
    })),
  };

  // ETag for efficient polling
  const body = JSON.stringify(marketplace);
  const etag = `"${createHash("md5").update(body).digest("hex")}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304 });
  }

  return NextResponse.json(marketplace, {
    headers: {
      "ETag": etag,
      "Cache-Control": "public, max-age=60, s-maxage=60",
    },
  });
}
