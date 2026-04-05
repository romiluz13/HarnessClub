/**
 * Pi Agent Factory — creates a configured Pi Agent for the copilot.
 *
 * Uses @mariozechner/pi-agent-core for the agent runtime and
 * @mariozechner/pi-ai for LLM provider access.
 *
 * Provider priority:
 * 1. COPILOT_PROVIDER env var (e.g., "anthropic", "openai", "google")
 * 2. Falls back to "anthropic" with ANTHROPIC_API_KEY
 * 3. Falls back to "openai" with OPENAI_API_KEY
 */

import { Agent, type AgentOptions, type BeforeToolCallContext, type BeforeToolCallResult } from "@mariozechner/pi-agent-core";
import { getModel, streamSimple, type Api, type Message, type Model } from "@mariozechner/pi-ai";
import type { Db } from "mongodb";
import { buildSystemPrompt } from "./context-builder";
import {
  createSearchTool,
  createExplainTool,
  createExportTool,
  createRecommendTool,
  createScanTool,
} from "./pi-tools";
import type { CopilotContext } from "./types";

function normalizeCopilotBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/$/, "");
  return trimmed.replace(/\/(chat\/completions|responses)$/, "");
}

function resolveCustomProviderName(): string {
  return process.env.COPILOT_PROVIDER?.trim() || "grove";
}

function createCustomOpenAiCompatibleModel(): Model<"openai-completions"> | null {
  const rawBaseUrl = process.env.COPILOT_BASE_URL?.trim();
  const modelId = process.env.COPILOT_MODEL?.trim();

  if (!rawBaseUrl || !modelId) {
    return null;
  }

  const apiKey = process.env.COPILOT_API_KEY?.trim();
  const baseUrl = normalizeCopilotBaseUrl(rawBaseUrl);
  const apiKeyHeader = process.env.COPILOT_API_KEY_HEADER?.trim()
    || (baseUrl.includes("azure-api.net") ? "api-key" : "");

  return {
    id: modelId,
    name: `Custom ${modelId}`,
    api: "openai-completions",
    provider: resolveCustomProviderName(),
    baseUrl,
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 200_000,
    maxTokens: 8_192,
    headers: apiKey && apiKeyHeader ? { [apiKeyHeader]: apiKey } : undefined,
    compat: {
      supportsStore: false,
      supportsDeveloperRole: false,
      supportsReasoningEffort: false,
      supportsUsageInStreaming: false,
      maxTokensField: "max_completion_tokens",
      supportsStrictMode: false,
    },
  };
}

/** Resolve which LLM model to use based on env vars */
function resolveModel() {
  const customModel = createCustomOpenAiCompatibleModel();
  if (customModel) {
    return customModel;
  }

  const provider = process.env.COPILOT_PROVIDER?.trim() ?? "";
  const modelId = process.env.COPILOT_MODEL?.trim() ?? "";

  // Explicit provider + model
  if (provider && modelId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = getModel(provider as any, modelId as any);
    if (model) return model;
  }

  // Try common providers in order
  if (process.env.ANTHROPIC_API_KEY) {
    return getModel("anthropic", "claude-sonnet-4-20250514") ?? getModel("anthropic", "claude-3-5-sonnet-20241022");
  }
  if (process.env.OPENAI_API_KEY) {
    return getModel("openai", "gpt-4o") ?? getModel("openai", "gpt-4o-mini");
  }
  if (process.env.GOOGLE_API_KEY) {
    return getModel("google", "gemini-2.5-flash");
  }

  return null;
}

/** Resolve the API key for a given provider */
function resolveApiKey(provider: string): string | undefined {
  const customProvider = resolveCustomProviderName();
  if (provider === customProvider && process.env.COPILOT_API_KEY) {
    return process.env.COPILOT_API_KEY;
  }

  const envMap: Record<string, string> = {
    anthropic: "ANTHROPIC_API_KEY",
    openai: "OPENAI_API_KEY",
    google: "GOOGLE_API_KEY",
    "google-gemini-cli": "GOOGLE_API_KEY",
    xai: "XAI_API_KEY",
    groq: "GROQ_API_KEY",
  };
  const envVar = envMap[provider];
  return envVar ? process.env[envVar] : undefined;
}

export interface CreateAgentResult {
  agent: Agent;
  hasLlm: boolean;
}

export interface CreateCopilotAgentOptions {
  initialMessages?: Message[];
  modelOverride?: Model<Api>;
  streamFn?: AgentOptions["streamFn"];
}

/**
 * Create a Pi Agent configured for the copilot.
 *
 * If no LLM provider is configured, returns { agent, hasLlm: false }.
 * The caller should check hasLlm and respond with a fallback message.
 */
export function createCopilotAgent(
  db: Db,
  context: CopilotContext,
  options: CreateCopilotAgentOptions = {}
): CreateAgentResult {
  const model = options.modelOverride ?? resolveModel();
  const systemPrompt = buildSystemPrompt(context);

  const tools = [
    createSearchTool(db, context),
    createExplainTool(db),
    createExportTool(db),
    createRecommendTool(),
    createScanTool(db),
  ];

  const agentOptions: AgentOptions = {
    initialState: {
      systemPrompt,
      model: model ?? undefined,
      tools,
      messages: options.initialMessages,
    },
    streamFn: options.streamFn ?? streamSimple,
    getApiKey: (provider: string) => resolveApiKey(provider),
    beforeToolCall: async (ctx: BeforeToolCallContext): Promise<BeforeToolCallResult | undefined> => {
      // Security: block tool calls with invalid ObjectId args
      const args = ctx.args as Record<string, unknown>;
      if (args && typeof args === "object" && "assetId" in args) {
        const id = args.assetId as string;
        if (!/^[0-9a-f]{24}$/i.test(id)) {
          return { block: true, reason: "Invalid asset ID format" };
        }
      }
      return undefined;
    },
  };

  const agent = new Agent(agentOptions);
  return { agent, hasLlm: model !== null };
}
