/**
 * Copilot Memory Service — persistent conversation history per team.
 *
 * Conversations stored in `copilot_conversations` with TTL index (30d).
 * Each conversation holds messages up to a max window for context.
 *
 * Per mongodb-schema-design: TTL index for automatic expiry.
 * Per mongodb-connection: reuse db singleton.
 */

import { ObjectId, type Db } from "mongodb";
import type { CopilotMessage } from "./types";

// ─── Types ─────────────────────────────────────────────────

/** Stored conversation document */
export interface ConversationDocument {
  _id: ObjectId;
  teamId: ObjectId;
  userId: ObjectId;
  messages: StoredMessage[];
  title?: string;
  createdAt: Date;
  updatedAt: Date;
  /** TTL index field — auto-deleted after 30 days */
  expiresAt: Date;
}

/** Stored message (serializable version of CopilotMessage) */
export interface StoredMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCall?: { name: string; params: Record<string, unknown> };
  toolResult?: { name: string; result: Record<string, unknown> };
  timestamp: string; // ISO string
}

export interface ConversationScope {
  teamId: ObjectId;
  userId: ObjectId;
}

const MAX_MESSAGES_PER_CONVERSATION = 50;
const TTL_DAYS = 30;

// ─── CRUD ──────────────────────────────────────────────────

/**
 * Save messages to a conversation.
 * Creates a new conversation if conversationId is not provided.
 */
export async function saveMessages(
  db: Db,
  input: {
    teamId: ObjectId;
    userId: ObjectId;
    conversationId?: ObjectId;
    messages: CopilotMessage[];
  }
): Promise<ObjectId> {
  const stored: StoredMessage[] = input.messages.map((m) => ({
    role: m.role,
    content: m.content,
    toolCall: m.toolCall ? { name: m.toolCall.name, params: m.toolCall.params } : undefined,
    toolResult: m.toolResult ? { name: m.toolResult.name, result: m.toolResult.result } : undefined,
    timestamp: m.timestamp.toISOString(),
  }));

  const now = new Date();
  const expiresAt = new Date(now.getTime() + TTL_DAYS * 24 * 60 * 60 * 1000);

  if (input.conversationId) {
    // Append to an in-scope conversation when it exists, otherwise create a fresh one.
    const result = await db.collection<ConversationDocument>("copilot_conversations").updateOne(
      {
        _id: input.conversationId,
        teamId: input.teamId,
        userId: input.userId,
      },
      {
        $push: { messages: { $each: stored, $slice: -MAX_MESSAGES_PER_CONVERSATION } as never },
        $set: { updatedAt: now, expiresAt },
      }
    );

    if (result.matchedCount > 0) {
      return input.conversationId;
    }
  }

  // Create new conversation
  const title = stored[0]?.content?.slice(0, 80) ?? "New conversation";
  const doc: Omit<ConversationDocument, "_id"> = {
    teamId: input.teamId,
    userId: input.userId,
    messages: stored.slice(-MAX_MESSAGES_PER_CONVERSATION),
    title,
    createdAt: now,
    updatedAt: now,
    expiresAt,
  };

  const result = await db.collection("copilot_conversations").insertOne(doc);
  return result.insertedId;
}

/**
 * Load conversation history for context injection.
 */
export async function loadConversation(
  db: Db,
  conversationId: ObjectId,
  scope?: ConversationScope
): Promise<StoredMessage[]> {
  const doc = await db.collection<ConversationDocument>("copilot_conversations")
    .findOne({
      _id: conversationId,
      ...(scope ? { teamId: scope.teamId, userId: scope.userId } : {}),
    });
  return doc?.messages ?? [];
}

/**
 * List recent conversations for a user in a team.
 */
export async function listConversations(
  db: Db,
  teamId: ObjectId,
  userId: ObjectId,
  limit: number = 10
): Promise<Array<{ id: string; title: string; updatedAt: string; messageCount: number }>> {
  const docs = await db.collection<ConversationDocument>("copilot_conversations")
    .aggregate<{ _id: ObjectId; title?: string; updatedAt: Date; messageCount: number }>([
      { $match: { teamId, userId } },
      { $sort: { updatedAt: -1 } },
      { $limit: limit },
      { $project: { title: 1, updatedAt: 1, messageCount: { $size: { $ifNull: ["$messages", []] } } } },
    ])
    .toArray();

  return docs.map((doc) => ({
    id: doc._id.toHexString(),
    title: doc.title ?? "Untitled",
    updatedAt: doc.updatedAt.toISOString(),
    messageCount: doc.messageCount,
  }));
}

/**
 * Delete a conversation.
 */
export async function deleteConversation(
  db: Db,
  conversationId: ObjectId,
  userId: ObjectId
): Promise<boolean> {
  const result = await db.collection("copilot_conversations").deleteOne({
    _id: conversationId,
    userId,
  });
  return result.deletedCount > 0;
}
