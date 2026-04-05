/**
 * Popup Script — renders status and save UI.
 * Per chrome-extension-development: no inline scripts, message passing only.
 */

const content = document.getElementById("content");
const DEFAULT_API_BASE = "http://localhost:3000";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeApiBase(value) {
  return value.trim().replace(/\/+$/, "");
}

function getOriginPattern(apiBase) {
  const url = new URL(apiBase);
  return `${url.origin}/*`;
}

async function loadState() {
  const [local, session] = await Promise.all([
    chrome.storage.local.get(["apiBase", "authToken", "teamId", "teamName"]),
    chrome.storage.session.get("lastDetected"),
  ]);

  return {
    apiBase: local.apiBase || DEFAULT_API_BASE,
    authenticated: !!local.authToken,
    teamId: local.teamId || "",
    teamName: local.teamName || "",
    lastDetected: session.lastDetected || null,
  };
}

async function saveConfig() {
  const apiBaseInput = document.getElementById("api-base");
  const tokenInput = document.getElementById("auth-token");
  const teamIdInput = document.getElementById("team-id");
  const teamNameInput = document.getElementById("team-name");
  const configError = document.getElementById("config-error");

  const apiBase = normalizeApiBase(apiBaseInput.value || DEFAULT_API_BASE);
  const authToken = tokenInput.value.trim();
  const teamId = teamIdInput.value.trim();
  const teamName = teamNameInput.value.trim();

  if (!apiBase || !teamId) {
    configError.textContent = "API base and team ID are required.";
    configError.hidden = false;
    return;
  }

  try {
    const granted = await chrome.permissions.request({ origins: [getOriginPattern(apiBase)] });
    if (!granted) {
      configError.textContent = "Host permission was denied for that AgentConfig origin.";
      configError.hidden = false;
      return;
    }
  } catch (error) {
    configError.textContent = error.message || "Invalid API base URL.";
    configError.hidden = false;
    return;
  }

  const existing = await chrome.storage.local.get("authToken");
  await chrome.storage.local.set({
    apiBase,
    authToken: authToken || existing.authToken || "",
    teamId,
    teamName,
  });

  await render();
}

async function render() {
  const state = await loadState();
  const setupComplete = state.authenticated && state.teamId;
  const detected = state.lastDetected;
  const filename = detected?.path?.split("/").pop();

  content.innerHTML = `
    <div class="status ${setupComplete ? "success" : "warning"}">
      ${setupComplete
        ? `Connected to ${escapeHtml(state.teamName || state.teamId)}`
        : "Complete setup before saving configs"}
    </div>

    <div class="field">
      <label for="api-base">AgentConfig Base URL</label>
      <input id="api-base" type="url" value="${escapeHtml(state.apiBase)}" placeholder="http://localhost:3000" />
    </div>
    <div class="field">
      <label for="auth-token">Personal API Token</label>
      <input id="auth-token" type="password" placeholder="${state.authenticated ? "Stored token will be kept if left blank" : "ac_xxxxx_yyyy"}" />
    </div>
    <div class="field">
      <label for="team-id">Team ID</label>
      <input id="team-id" type="text" value="${escapeHtml(state.teamId)}" placeholder="Mongo ObjectId from your team" />
    </div>
    <div class="field">
      <label for="team-name">Team Label</label>
      <input id="team-name" type="text" value="${escapeHtml(state.teamName)}" placeholder="Optional friendly team name" />
    </div>
    <div class="status error" id="config-error" hidden></div>
    <button class="btn btn-secondary" id="save-config">Save Connection</button>

    ${detected ? `
      <div class="detected" style="margin-top: 12px;">
        <div class="type">${escapeHtml(detected.type)} • ${escapeHtml(detected.tool)}</div>
        <div class="name">${escapeHtml(filename)}</div>
      </div>
      <button class="btn btn-primary" id="save-asset" ${setupComplete ? "" : "disabled"}>Save to Team</button>
    ` : `
      <div class="status info" style="margin-top: 12px;">Navigate to a supported config file on GitHub to save it.</div>
    `}

    <button class="btn btn-secondary" id="open-dashboard">Open Dashboard</button>
    <button class="btn btn-secondary" id="open-tokens">Open Token Settings</button>
    <button class="btn btn-secondary" id="open-teams">Open Teams</button>
    <div class="helper">
      Supported files: CLAUDE.md, AGENTS.md, SKILL.md, .mcp.json, .cursorrules, copilot-instructions.md, .windsurfrules.
    </div>
  `;

  document.getElementById("save-config").addEventListener("click", saveConfig);

  const saveAssetBtn = document.getElementById("save-asset");
  if (saveAssetBtn) {
    saveAssetBtn.addEventListener("click", () => {
      saveAssetBtn.textContent = "Saving...";
      saveAssetBtn.disabled = true;

      chrome.runtime.sendMessage({ action: "SAVE_TO_TEAM", data: detected }, (response) => {
        if (response?.success) {
          saveAssetBtn.textContent = "Saved ✓";
          saveAssetBtn.style.background = "#059669";
          return;
        }

        saveAssetBtn.textContent = response?.error || "Save failed";
        saveAssetBtn.style.background = "#dc2626";
        setTimeout(() => render(), 2500);
      });
    });
  }

  document.getElementById("open-dashboard").addEventListener("click", () => {
    chrome.tabs.create({ url: `${normalizeApiBase(state.apiBase)}/dashboard` });
  });
  document.getElementById("open-tokens").addEventListener("click", () => {
    chrome.tabs.create({ url: `${normalizeApiBase(state.apiBase)}/dashboard/settings/tokens` });
  });
  document.getElementById("open-teams").addEventListener("click", () => {
    chrome.tabs.create({ url: `${normalizeApiBase(state.apiBase)}/dashboard/teams` });
  });
}

render();
