const REQUIRED_COPILOT_LIVE_ENV_VARS = [
  "COPILOT_LIVE_TEST",
  "COPILOT_MODEL",
  "COPILOT_BASE_URL",
  "COPILOT_API_KEY",
  "MONGODB_URI",
] as const;

export function assertCopilotLiveConfig(): void {
  const missing = REQUIRED_COPILOT_LIVE_ENV_VARS.filter((key) => {
    if (key === "COPILOT_LIVE_TEST") {
      return process.env[key] !== "1";
    }

    return !process.env[key];
  });

  if (missing.length > 0) {
    throw new Error(
      "Copilot live tests require real provider configuration. "
      + `Missing or disabled: ${missing.join(", ")}. `
      + "Run them explicitly with `COPILOT_LIVE_TEST=1 npm run test:live` after exporting the live Grove/OpenAI-compatible env vars."
    );
  }
}
