/**
 * Background Service Worker — handles message passing and API calls.
 *
 * Per chrome-extension-development:
 * - Service workers are ephemeral — no persistent state
 * - Use chrome.storage for persistence
 * - Minimal permissions
 */

const DEFAULT_API_BASE = "http://localhost:3000";

/**
 * Get stored extension configuration.
 */
async function getConfig() {
  const stored = await chrome.storage.local.get(["apiBase", "authToken", "teamId", "teamName"]);
  return {
    apiBase: (stored.apiBase || DEFAULT_API_BASE).replace(/\/+$/, ""),
    authToken: stored.authToken || "",
    teamId: stored.teamId || "",
    teamName: stored.teamName || "",
  };
}

/**
 * Save a config to the user's team via API.
 */
async function saveToTeam(data) {
  const { apiBase, authToken, teamId } = await getConfig();
  if (!authToken || !teamId) {
    return { success: false, error: "Configure API base, token, and team before saving" };
  }

  try {
    const rawUrl = data.rawUrl
      || data.url.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/");
    const contentResponse = await fetch(rawUrl);
    if (!contentResponse.ok) {
      return { success: false, error: `Failed to fetch source file (${contentResponse.status})` };
    }
    const content = await contentResponse.text();

    // Create asset via API
    const response = await fetch(`${apiBase}/api/assets/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        assetType: data.type,
        teamId,
        filename: data.path.split("/").pop(),
        content,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => null);
      return { success: false, error: err?.error ?? "Import failed" };
    }

    const result = await response.json();
    return { success: true, assetId: result.assetId };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "SAVE_TO_TEAM") {
    saveToTeam(message.data).then(sendResponse);
    return true; // Keep channel open for async response
  }

  if (message.action === "CONFIG_DETECTED") {
    // Store last detected config for popup
    chrome.storage.session.set({ lastDetected: message.data });
  }

  if (message.action === "GET_STATUS") {
    Promise.all([getConfig(), chrome.storage.session.get("lastDetected")]).then(([local, session]) => {
      sendResponse({
        authenticated: !!local.authToken,
        apiBase: local.apiBase,
        teamId: local.teamId,
        teamName: local.teamName,
        lastDetected: session.lastDetected,
      });
    });
    return true;
  }
});
