/**
 * GET  /api/orgs/:orgId/webhooks — List webhook subscriptions.
 * POST /api/orgs/:orgId/webhooks — Create webhook subscription.
 * DELETE via POST with { action: "deactivate", webhookId: "..." }.
 *
 * Per api-security-best-practices: auth + org owner/admin RBAC.
 */

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/api-helpers";
import { getOrgById } from "@/services/org-service";
import { createWebhook, type WebhookEvent, type WebhookSubscription } from "@/services/webhook-service";

const VALID_EVENTS: WebhookEvent[] = [
  "asset.created", "asset.updated", "asset.deleted", "asset.published",
  "asset.imported", "team.member_added", "team.member_removed",
  "approval.requested", "approval.completed", "scan.completed",
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult.response;

  const { orgId } = await params;
  let orgOid: ObjectId;
  try {
    orgOid = new ObjectId(orgId);
  } catch {
    return NextResponse.json({ error: "Invalid orgId" }, { status: 400 });
  }

  const db = await getDb();

  const org = await getOrgById(db, orgOid);
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const webhooks = await db.collection<WebhookSubscription>("webhooks")
    .find({ orgId: orgOid })
    .project({ secret: 0 })
    .toArray();

  return NextResponse.json({
    webhooks: webhooks.map((w) => ({
      id: w._id.toHexString(),
      url: w.url,
      events: w.events,
      active: w.active,
      stats: w.stats,
      createdAt: w.createdAt.toISOString(),
    })),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult.response;

  const { orgId } = await params;
  let orgOid: ObjectId;
  try {
    orgOid = new ObjectId(orgId);
  } catch {
    return NextResponse.json({ error: "Invalid orgId" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Handle deactivation via POST action
  if (body.action === "deactivate" && typeof body.webhookId === "string") {
    const db = await getDb();
    await db.collection("webhooks").updateOne(
      { _id: new ObjectId(body.webhookId as string), orgId: orgOid },
      { $set: { active: false } }
    );
    return NextResponse.json({ message: "Webhook deactivated" });
  }

  const { url, events, teamId } = body;

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }
  if (!Array.isArray(events) || events.length === 0) {
    return NextResponse.json({ error: "events array is required" }, { status: 400 });
  }
  const invalidEvents = (events as string[]).filter((e) => !VALID_EVENTS.includes(e as WebhookEvent));
  if (invalidEvents.length > 0) {
    return NextResponse.json(
      { error: `Invalid events: ${invalidEvents.join(", ")}. Valid: ${VALID_EVENTS.join(", ")}` },
      { status: 400 }
    );
  }

  const db = await getDb();
  const userId = new ObjectId(authResult.userId);

  const org = await getOrgById(db, orgOid);
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }
  if (org.owner.userId.toHexString() !== userId.toHexString()) {
    return NextResponse.json({ error: "Only organization owner can create webhooks" }, { status: 403 });
  }

  const result = await createWebhook(db, {
    orgId: orgOid,
    teamId: teamId ? new ObjectId(teamId as string) : undefined,
    url: url as string,
    events: events as WebhookEvent[],
  });

  return NextResponse.json(
    {
      webhookId: result.webhookId.toHexString(),
      secret: result.secret,
      message: "Webhook created. Store the secret — it won't be shown again.",
    },
    { status: 201 }
  );
}
