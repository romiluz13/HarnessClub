/**
 * POST /api/orgs/:orgId/scim/users — SCIM 2.0 user provisioning endpoint.
 * GET  /api/orgs/:orgId/scim/users — SCIM sync status.
 *
 * IdP (Okta, Azure AD) pushes user create/update/deactivate events here.
 * Auth: Bearer token (API token with "scim" scope).
 */

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { getOrgById } from "@/services/org-service";
import { processScimUser, getScimSyncStatus, updateSyncStatus } from "@/services/scim-service";
import type { ScimUser } from "@/services/scim-service";
import { hasTokenScope, validateApiToken } from "@/services/api-token-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Bearer token required" }, { status: 401 });
  }

  const { orgId } = await params;
  let orgOid: ObjectId;
  try {
    orgOid = new ObjectId(orgId);
  } catch {
    return NextResponse.json({ error: "Invalid orgId" }, { status: 400 });
  }

  const db = await getDb();
  const token = authHeader.slice(7);
  const tokenDoc = await validateApiToken(db, token);
  if (
    !tokenDoc
    || tokenDoc.orgId.toHexString() !== orgOid.toHexString()
    || !hasTokenScope(tokenDoc, "write")
  ) {
    return NextResponse.json({ error: "Invalid or unauthorized token" }, { status: 403 });
  }

  const status = await getScimSyncStatus(db, orgOid);
  return NextResponse.json({
    syncStatus: status ?? {
      orgId: orgOid.toHexString(),
      lastSyncAt: null,
      totalUsers: 0,
      provisioned: 0,
      deprovisioned: 0,
      errors: 0,
      status: "idle",
    },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Bearer token required" }, { status: 401 });
  }

  const { orgId } = await params;
  let orgOid: ObjectId;
  try {
    orgOid = new ObjectId(orgId);
  } catch {
    return NextResponse.json({ error: "Invalid orgId" }, { status: 400 });
  }

  let body: ScimUser;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.userName || !body.externalId) {
    return NextResponse.json(
      { error: "userName and externalId are required" },
      { status: 400 }
    );
  }

  const db = await getDb();
  const token = authHeader.slice(7);
  const tokenDoc = await validateApiToken(db, token);
  if (
    !tokenDoc
    || tokenDoc.orgId.toHexString() !== orgOid.toHexString()
    || !hasTokenScope(tokenDoc, "write")
  ) {
    return NextResponse.json({ error: "Invalid or unauthorized token" }, { status: 403 });
  }

  const org = await getOrgById(db, orgOid);
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const result = await processScimUser(db, orgOid, body);

  // Update sync status
  const incFields: Record<string, number> = {};
  if (result.action === "created") incFields.provisioned = 1;
  else if (result.action === "deactivated") incFields.deprovisioned = 1;
  incFields.totalUsers = result.action === "created" ? 1 : 0;

  await updateSyncStatus(db, orgOid, {
    status: "idle",
  });

  return NextResponse.json(
    {
      action: result.action,
      userId: result.userId.toHexString(),
      message: `User ${result.action} via SCIM`,
    },
    { status: result.action === "created" ? 201 : 200 }
  );
}
