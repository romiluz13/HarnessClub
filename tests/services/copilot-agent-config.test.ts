import { describe, expect, it, vi, afterEach } from "vitest";
import { createCopilotAgent } from "@/services/copilot/pi-agent";
import type { CopilotContext } from "@/services/copilot/types";
import type { Db } from "mongodb";

const context: CopilotContext = {
  currentPage: "/dashboard/assets",
  teamId: "abc123",
  teamName: "Platform",
  userRole: "admin",
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createCopilotAgent custom gateway config", () => {
  it("creates a custom OpenAI-compatible model for Grove-style gateways", async () => {
    vi.stubEnv("COPILOT_PROVIDER", "grove");
    vi.stubEnv("COPILOT_MODEL", "gpt-5.4-mini");
    vi.stubEnv("COPILOT_BASE_URL", "https://grove-gateway-prod.azure-api.net/grove-foundry-prod/openai/v1/chat/completions");
    vi.stubEnv("COPILOT_API_KEY", "test-key");

    const { agent, hasLlm } = createCopilotAgent({} as Db, context);

    expect(hasLlm).toBe(true);
    expect(agent.state.model.api).toBe("openai-completions");
    expect(agent.state.model.provider).toBe("grove");
    expect(agent.state.model.id).toBe("gpt-5.4-mini");
    expect(agent.state.model.baseUrl).toBe("https://grove-gateway-prod.azure-api.net/grove-foundry-prod/openai/v1");
    expect(agent.state.model.headers).toEqual({ "api-key": "test-key" });
    await expect(Promise.resolve(agent.getApiKey?.("grove"))).resolves.toBe("test-key");
  });

  it("supports explicit non-Bearer header overrides", () => {
    vi.stubEnv("COPILOT_PROVIDER", "custom-gateway");
    vi.stubEnv("COPILOT_MODEL", "gpt-5.4-mini");
    vi.stubEnv("COPILOT_BASE_URL", "https://proxy.example.com/v1/chat/completions");
    vi.stubEnv("COPILOT_API_KEY", "test-key");
    vi.stubEnv("COPILOT_API_KEY_HEADER", "x-custom-auth");

    const { agent, hasLlm } = createCopilotAgent({} as Db, context);

    expect(hasLlm).toBe(true);
    expect(agent.state.model.baseUrl).toBe("https://proxy.example.com/v1");
    expect(agent.state.model.headers).toEqual({ "x-custom-auth": "test-key" });
  });
});
