/**
 * GET   /api/settings/webhooks — List webhooks for user's org.
 * POST  /api/settings/webhooks — Create a webhook.
 * PATCH /api/settings/webhooks — Delete a webhook.
 */

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/api-helpers";
import { createWebhook } from "@/services/webhook-service";
import type { UserDocument } from "@/types/user";

export async function GET() {
  const authResult = await requireAuth();
  if (!authResult.ok) return authResult.response;

  const db = await getDb();
  const userId = new ObjectId(authResult.userId);
  const user = await db.collection<UserDocument>("users").findOne({ _id: userId });
  const orgId = user?.orgMemberships?.[0]?.orgId;

  if (!orgId) return NextResponse.json({ webhooks: [] });

  const webhooks = await db.collection("webhooks")
    .find({ orgId })
    .sort({ createdAt: -1 })
    .toArray();

  return NextResponse.json({
    webhooks: webhooks.map((w) => ({
      id: w._id.toHexString(),
      url: w.url,
      events: w.events,
      active: w.active ?? true,
      createdAt: w.createdAt?.toISOString() ?? null,
    })),
  });
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (!authResult.ok) return authResult.response;

  let body: { url: string; events: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.url || !body.events?.length) {
    return NextResponse.json({ error: "url and events are required" }, { status: 400 });
  }

  const db = await getDb();
  const userId = new ObjectId(authResult.userId);
  const user = await db.collection<UserDocument>("users").findOne({ _id: userId });
  const orgId = user?.orgMemberships?.[0]?.orgId;

  if (!orgId) return NextResponse.json({ error: "No org found" }, { status: 400 });

  const result = await createWebhook(db, {
    orgId,
    url: body.url,
    events: body.events as import("@/services/webhook-service").WebhookEvent[],
  });

  return NextResponse.json({
    webhookId: result.webhookId.toHexString(),
    secret: result.secret,
  }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const authResult = await requireAuth();
  if (!authResult.ok) return authResult.response;

  let body: { webhookId: string; action: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.action !== "delete" || !body.webhookId) {
    return NextResponse.json({ error: "webhookId and action=delete required" }, { status: 400 });
  }

  const db = await getDb();
  await db.collection("webhooks").deleteOne({ _id: new ObjectId(body.webhookId) });

  return NextResponse.json({ success: true });
}
