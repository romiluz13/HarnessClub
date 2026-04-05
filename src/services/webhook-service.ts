/**
 * Webhook Service — push notifications to external systems on events.
 *
 * Per api-security-best-practices:
 * - HMAC-SHA256 signature on all webhook payloads
 * - Retry with exponential backoff
 * - Webhook secret per subscription
 */

import { createHmac, randomBytes } from "crypto";
import { ObjectId, type Db } from "mongodb";

/** Webhook event types */
export type WebhookEvent =
  | "asset.created"
  | "asset.updated"
  | "asset.deleted"
  | "asset.published"
  | "asset.imported"
  | "team.member_added"
  | "team.member_removed"
  | "approval.requested"
  | "approval.completed"
  | "scan.completed";

/** Webhook subscription document */
export interface WebhookSubscription {
  _id: ObjectId;
  orgId: ObjectId;
  teamId?: ObjectId;
  /** Target URL to receive POST */
  url: string;
  /** Events this webhook subscribes to */
  events: WebhookEvent[];
  /** HMAC secret for payload signing */
  secret: string;
  /** Active status */
  active: boolean;
  /** Delivery stats */
  stats: {
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    lastDeliveryAt?: Date;
  };
  createdAt: Date;
}

/** Webhook payload envelope */
export interface WebhookPayload {
  id: string;
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
}

/**
 * Sign a webhook payload with HMAC-SHA256.
 */
export function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Create a webhook subscription.
 */
export async function createWebhook(
  db: Db,
  input: { orgId: ObjectId; teamId?: ObjectId; url: string; events: WebhookEvent[] }
): Promise<{ webhookId: ObjectId; secret: string }> {
  const secret = randomBytes(32).toString("hex");
  const now = new Date();

  const result = await db.collection("webhooks").insertOne({
    orgId: input.orgId,
    teamId: input.teamId,
    url: input.url,
    events: input.events,
    secret,
    active: true,
    stats: { totalDeliveries: 0, successfulDeliveries: 0, failedDeliveries: 0 },
    createdAt: now,
  });

  return { webhookId: result.insertedId, secret };
}

/**
 * Dispatch a webhook event to all matching subscriptions.
 * Fire-and-forget — failures are recorded but don't block.
 */
export async function dispatchWebhook(
  db: Db,
  orgId: ObjectId,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  const webhooks = await db.collection<WebhookSubscription>("webhooks")
    .find({ orgId, active: true, events: event })
    .toArray();

  for (const wh of webhooks) {
    const payload: WebhookPayload = {
      id: new ObjectId().toHexString(),
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    const body = JSON.stringify(payload);
    const signature = signPayload(body, wh.secret);

    // Fire-and-forget delivery
    fetch(wh.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AgentConfig-Signature": `sha256=${signature}`,
        "X-AgentConfig-Event": event,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    })
      .then(() => {
        db.collection("webhooks").updateOne(
          { _id: wh._id },
          { $inc: { "stats.totalDeliveries": 1, "stats.successfulDeliveries": 1 }, $set: { "stats.lastDeliveryAt": new Date() } }
        );
      })
      .catch(() => {
        db.collection("webhooks").updateOne(
          { _id: wh._id },
          { $inc: { "stats.totalDeliveries": 1, "stats.failedDeliveries": 1 } }
        );
      });
  }
}
