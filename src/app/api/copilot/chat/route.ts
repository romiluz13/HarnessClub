/**
 * POST /api/copilot/chat — Pi Agent-powered copilot chat endpoint.
 *
 * Streams agent events via Server-Sent Events (SSE).
 * Uses @mariozechner/pi-agent-core for the agent loop with tool calling.
 *
 * If no LLM provider is configured (no API keys), falls back to a
 * non-streaming JSON response with tool dispatch via intent detection.
 *
 * Per api-security-best-practices: auth required, input validation.
 */

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/api-helpers";
import { createCopilotAgent } from "@/services/copilot/pi-agent";
import { generateSuggestions } from "@/services/copilot/context-builder";
import { executeTool } from "@/services/copilot/tool-executor";
import { parseActionBlocks } from "@/services/copilot/action-parser";
import { saveMessages, loadConversation } from "@/services/copilot/memory-service";
import { generateProactiveSuggestions } from "@/services/copilot/proactive-suggestions";
import type {
  CopilotChatRequest,
  CopilotChatResponse,
  CopilotContext,
  CopilotToolName,
  CopilotMessage,
} from "@/services/copilot/types";
import type { AgentEvent } from "@mariozechner/pi-agent-core";
import type { AssistantMessageEvent, Message as PiMessage, Model as PiModel, Usage } from "@mariozechner/pi-ai";

const EMPTY_USAGE: Usage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (!authResult.ok) return authResult.response;

  let body: CopilotChatRequest;
  try {
    const raw = await request.json();
    body = raw as CopilotChatRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.message || typeof body.message !== "string") {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }
  if (!body.context) {
    return NextResponse.json({ error: "context is required" }, { status: 400 });
  }

  const db = await getDb();
  const userId = new ObjectId(authResult.userId);

  // Load conversation history if conversationId provided
  const conversationId = body.conversationId;
  let history: CopilotMessage[] = [];
  if (conversationId && ObjectId.isValid(conversationId)) {
    const stored = await loadConversation(db, new ObjectId(conversationId));
    history = stored.map((m) => ({
      role: m.role,
      content: m.content,
      toolCall: m.toolCall as CopilotMessage["toolCall"],
      toolResult: m.toolResult as CopilotMessage["toolResult"],
      timestamp: new Date(m.timestamp),
    }));
  }

  const historyMessages = resolveHistoryMessages(body.history, history);
  const { agent, hasLlm } = createCopilotAgent(db, body.context, {
    initialMessages: undefined,
  });

  // If no LLM configured, fall back to intent-based dispatch (no streaming)
  if (!hasLlm) {
    return handleFallback(db, body, userId, conversationId ? new ObjectId(conversationId) : undefined);
  }

  // SSE streaming response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      const startingMessageCount = historyMessages.length;
      agent.state.messages = toAgentMessages(historyMessages, agent.state.model);

      agent.subscribe((event: AgentEvent, _signal: AbortSignal) => {
        switch (event.type) {
          case "agent_start":
            send("agent_start", {});
            break;
          case "message_update": {
            const msgEvent = event.assistantMessageEvent as AssistantMessageEvent;
            if (msgEvent.type === "text_delta") {
              send("text_delta", { delta: (msgEvent as Extract<AssistantMessageEvent, { type: "text_delta" }>).delta });
            }
            break;
          }
          case "tool_execution_start":
            send("tool_start", { tool: event.toolName, args: event.args });
            break;
          case "tool_execution_end":
            send("tool_end", { tool: event.toolName, isError: event.isError });
            break;
        }
      });

      try {
        await agent.prompt(body.message);

        const newMessages = agent.state.messages.slice(startingMessageCount);
        const transcript = toCopilotMessages(newMessages);
        const outcome = extractLiveOutcome(newMessages);
        const parsed = parseActionBlocks(outcome.message);
        const teamId = body.context.teamId ? new ObjectId(body.context.teamId) : new ObjectId();
        const proactive = body.context.teamId
          ? await generateProactiveSuggestions(db, new ObjectId(body.context.teamId))
          : [];
        const convId = await saveMessages(db, {
          teamId,
          userId,
          conversationId: conversationId && ObjectId.isValid(conversationId) ? new ObjectId(conversationId) : undefined,
          messages: transcript,
        });

        if (agent.state.errorMessage) {
          send("error", { message: agent.state.errorMessage });
        }

        send("agent_end", {
          message: parsed.text || outcome.message,
          toolsUsed: outcome.toolsUsed,
          suggestions: generateSuggestions(body.context),
          conversationId: convId.toHexString(),
          actions: parsed.actions,
          proactiveSuggestions: proactive.slice(0, 3),
        });
        controller.close();
      } catch (err) {
        send("error", { message: (err as Error).message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

function resolveHistoryMessages(requestHistory?: CopilotMessage[], storedHistory: CopilotMessage[] = []): CopilotMessage[] {
  if (storedHistory.length > 0) {
    return storedHistory;
  }
  return requestHistory ?? [];
}

function toTextContent(text: string) {
  return [{ type: "text" as const, text }];
}

function toAgentMessages(history: CopilotMessage[], model: PiModel<any>): PiMessage[] {
  return history.map((message, index) => {
    const timestamp = message.timestamp.getTime();

    if (message.role === "user" || message.role === "system") {
      return {
        role: "user" as const,
        content: toTextContent(message.content),
        timestamp,
      };
    }

    if (message.role === "assistant") {
      const content: Extract<PiMessage, { role: "assistant" }>['content'] = message.content ? toTextContent(message.content) : [];
      if (message.toolCall) {
        content.push({
          type: "toolCall",
          id: `history-tool-${index}`,
          name: message.toolCall.name,
          arguments: message.toolCall.params,
        });
      }

      return {
        role: "assistant" as const,
        content,
        api: model.api,
        provider: model.provider,
        model: model.id,
        usage: EMPTY_USAGE,
        stopReason: "stop" as const,
        timestamp,
      };
    }

    return {
      role: "toolResult" as const,
      toolCallId: `history-tool-${index}`,
      toolName: message.toolResult?.name ?? "search_assets",
      content: toTextContent(
        message.content || JSON.stringify(message.toolResult?.result ?? {}, null, 2)
      ),
      details: message.toolResult?.result,
      isError: false,
      timestamp,
    };
  });
}

function assistantMessageToCopilotMessages(message: Extract<PiMessage, { role: "assistant" }>): CopilotMessage[] {
  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  const toolCalls = message.content.filter((block) => block.type === "toolCall");
  const result: CopilotMessage[] = [];

  if (text || toolCalls.length === 0) {
    result.push({
      role: "assistant",
      content: text || message.errorMessage || "",
      timestamp: new Date(message.timestamp),
    });
  }

  for (const toolCall of toolCalls) {
    result.push({
      role: "assistant",
      content: text || `Calling ${toolCall.name}`,
      toolCall: {
        name: toolCall.name as CopilotToolName,
        params: toolCall.arguments,
      },
      timestamp: new Date(message.timestamp),
    });
  }

  return result;
}

function toCopilotMessages(messages: PiMessage[]): CopilotMessage[] {
  return messages.flatMap((message) => {
    if (message.role === "user") {
      const content = typeof message.content === "string"
        ? message.content
        : message.content.filter((block) => block.type === "text").map((block) => block.text).join("\n");

      return [{ role: "user", content, timestamp: new Date(message.timestamp) } satisfies CopilotMessage];
    }

    if (message.role === "assistant") {
      return assistantMessageToCopilotMessages(message);
    }

    return [{
      role: "tool",
      content: message.content.filter((block) => block.type === "text").map((block) => block.text).join("\n"),
      toolResult: {
        name: message.toolName as CopilotToolName,
        result: (message.details as Record<string, unknown> | undefined) ?? {},
      },
      timestamp: new Date(message.timestamp),
    } satisfies CopilotMessage];
  });
}

function extractLiveOutcome(messages: PiMessage[]): { message: string; toolsUsed: CopilotToolName[] } {
  const toolsUsed = Array.from(new Set(messages.flatMap((message) => {
    if (message.role === "assistant") {
      return message.content
        .filter((block) => block.type === "toolCall")
        .map((block) => block.name as CopilotToolName);
    }
    if (message.role === "toolResult") {
      return [message.toolName as CopilotToolName];
    }
    return [] as CopilotToolName[];
  })));

  const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");
  if (!lastAssistant || lastAssistant.role !== "assistant") {
    return {
      message: "",
      toolsUsed,
    };
  }

  const message = lastAssistant.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim() || lastAssistant.errorMessage || "";

  return { message, toolsUsed };
}

// ─── Fallback: intent-based dispatch (no LLM) ──────────────

async function handleFallback(
  db: Awaited<ReturnType<typeof getDb>>,
  body: CopilotChatRequest,
  userId: ObjectId,
  existingConversationId?: ObjectId
): Promise<NextResponse> {
  const toolsUsed: CopilotToolName[] = [];
  let responseMessage = "";

  const intent = detectIntent(body.message, body.context);
  if (intent) {
    try {
      const result = await executeTool(db, intent.tool, intent.params as never, body.context);
      toolsUsed.push(intent.tool);
      responseMessage = formatToolResult(intent.tool, result as Record<string, unknown>);
    } catch (err: unknown) {
      responseMessage = `I tried to use the ${intent.tool} tool but encountered an error: ${(err as Error).message}`;
    }
  } else {
    const suggestions = generateSuggestions(body.context);
    responseMessage = `I can help you with agent configurations! Here are some things I can do:\n\n${suggestions.map((s) => `- ${s}`).join("\n")}`;
  }

  // Parse action blocks from response
  const parsed = parseActionBlocks(responseMessage);

  // Save conversation (fire-and-forget)
  const teamId = body.context.teamId ? new ObjectId(body.context.teamId) : new ObjectId();
  const now = new Date();
  const newMessages: CopilotMessage[] = [
    { role: "user", content: body.message, timestamp: now },
    { role: "assistant", content: responseMessage, timestamp: now },
  ];
  const convId = await saveMessages(db, {
    teamId,
    userId,
    conversationId: existingConversationId,
    messages: newMessages,
  });

  // Get proactive suggestions
  const proactive = body.context.teamId
    ? await generateProactiveSuggestions(db, new ObjectId(body.context.teamId))
    : [];

  const response: CopilotChatResponse = {
    message: parsed.text || responseMessage,
    toolsUsed,
    suggestions: generateSuggestions(body.context),
  };

  return NextResponse.json({
    ...response,
    conversationId: convId.toHexString(),
    actions: parsed.actions,
    proactiveSuggestions: proactive.slice(0, 3),
  });
}

function detectIntent(message: string, context: CopilotContext): {
  tool: CopilotToolName;
  params: Record<string, unknown>;
} | null {
  const lower = message.toLowerCase();

  if (lower.includes("find") || lower.includes("search") || lower.includes("look for") || lower.includes("show me")) {
    const query = message.replace(/^(find|search for|look for|show me)\s*/i, "").trim();
    return { tool: "search_assets", params: { query: query || "all", limit: 10 } };
  }
  if (lower.includes("export") || lower.includes("convert")) {
    const targets = ["cursor", "copilot", "windsurf", "codex", "claude-code"];
    const target = targets.find((t) => lower.includes(t)) ?? "cursor";
    if (context.assetId) return { tool: "export_asset", params: { assetId: context.assetId, target } };
  }
  if ((lower.includes("explain") || lower.includes("what is") || lower.includes("what does")) && context.assetId) {
    return { tool: "explain_asset", params: { assetId: context.assetId } };
  }
  if (lower.includes("recommend") || lower.includes("suggest") || lower.includes("set up") || lower.includes("template")) {
    return { tool: "recommend_harness", params: { departmentDescription: message } };
  }
  if (lower.includes("import") && (lower.includes("github") || lower.includes("repo"))) {
    const urlMatch = message.match(/https?:\/\/github\.com\/[^\s]+/);
    if (urlMatch) return { tool: "import_from_repo", params: { repoUrl: urlMatch[0] } };
  }
  return null;
}

function formatToolResult(tool: CopilotToolName, result: Record<string, unknown>): string {
  switch (tool) {
    case "search_assets": {
      const assets = (result.assets ?? []) as Array<Record<string, string>>;
      if (assets.length === 0) return "No assets found matching your query.";
      return `Found ${assets.length} asset(s):\n\n${assets.map((a) => `- **${a.name}** (${a.type}): ${a.description}`).join("\n")}`;
    }
    case "export_asset":
      return `Exported to **${result.target}** format:\n- Filename: \`${result.filename}\`\n- Ready to download.`;
    case "explain_asset":
      return result.explanation as string;
    case "recommend_harness":
      return `I recommend the **${result.displayName}** template for your team.\n\nIt includes ${(result.assets as unknown[]).length} starter asset(s).`;
    case "create_asset":
      return `Created **${result.name}** (${result.type}). Asset ID: ${result.assetId}`;
    default:
      return JSON.stringify(result, null, 2);
  }
}
