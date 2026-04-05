/**
 * Content Script — detects agent config files on GitHub.
 *
 * Per chrome-extension-development:
 * - Minimal DOM manipulation
 * - Message passing to background service worker
 * - No inline scripts (CSP compliance)
 */

const CONFIG_PATTERNS = [
  // Claude Code
  { pattern: /CLAUDE\.md$/i, type: "rule", tool: "claude-code" },
  { pattern: /AGENTS\.md$/i, type: "agent", tool: "codex" },
  { pattern: /\.mcp\.json$/i, type: "mcp_config", tool: "claude-code" },
  // Cursor
  { pattern: /\.cursorrules$/i, type: "rule", tool: "cursor" },
  { pattern: /\.cursor\/rules\/.*\.mdc$/i, type: "rule", tool: "cursor" },
  // Copilot
  { pattern: /copilot-instructions\.md$/i, type: "rule", tool: "copilot" },
  // Windsurf
  { pattern: /\.windsurfrules$/i, type: "rule", tool: "windsurf" },
  // Skills (skills.sh ecosystem)
  { pattern: /SKILL\.md$/i, type: "skill", tool: "claude-code" },
];

/**
 * Detect if the current GitHub page has an agent config file.
 */
function detectConfigFile() {
  const path = window.location.pathname;

  // Check if we're viewing a file (GitHub blob view)
  if (!path.includes("/blob/")) return null;

  for (const config of CONFIG_PATTERNS) {
    if (config.pattern.test(path)) {
      return {
        type: config.type,
        tool: config.tool,
        path: path,
        url: window.location.href,
        rawUrl: path.replace("/blob/", "/raw/").replace("github.com", "raw.githubusercontent.com"),
      };
    }
  }

  return null;
}

/**
 * Inject the "Save to Team" button on GitHub file views.
 */
function injectSaveButton(detection) {
  // Don't inject twice
  if (document.querySelector("#ac-save-btn")) return;

  // Find GitHub's file action bar
  const actionBar = document.querySelector(".react-blob-header-edit-and-raw-actions") ||
                    document.querySelector('[data-testid="raw-button"]')?.parentElement;

  if (!actionBar) return;

  const btn = document.createElement("button");
  btn.id = "ac-save-btn";
  btn.textContent = `Save to Team (${detection.type})`;
  btn.style.cssText = `
    background: #2563eb; color: white; border: none; border-radius: 6px;
    padding: 5px 12px; font-size: 12px; font-weight: 500; cursor: pointer;
    margin-left: 8px;
  `;

  btn.addEventListener("click", () => {
    // Send message to background worker
    chrome.runtime.sendMessage({
      action: "SAVE_TO_TEAM",
      data: detection,
    });
  });

  actionBar.appendChild(btn);
}

// Run detection on page load and navigation (GitHub uses SPA)
function init() {
  const detection = detectConfigFile();
  if (detection) {
    injectSaveButton(detection);
    // Notify popup of detected file
    chrome.runtime.sendMessage({ action: "CONFIG_DETECTED", data: detection });
  }
}

// GitHub uses pushState for navigation — observe URL changes
let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    setTimeout(init, 500); // Wait for GitHub's SPA render
  }
});
observer.observe(document.body, { childList: true, subtree: true });

// Initial run
init();
