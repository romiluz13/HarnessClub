# MCPXplore — Ideas to Steal (April 2026)

## What MCPXplore Is
An Electron desktop app for exploring MCP servers. Connect to any MCP server, browse its tools/resources/prompts,
chat with an LLM that can use those tools, with SMART tool selection using MongoDB + embeddings.

## GENIUS PATTERNS TO STEAL

### 1. Three Search Modes with Toggle UI
```
[ Keyword ] [ Semantic ] [ Hybrid ]
```
- **Keyword**: MongoDB Atlas Search ($search)
- **Semantic**: Vector search using configurable embeddings
- **Hybrid**: Rank fusion OR score fusion with adjustable weights

They built EXACTLY the search we need. Their ToolSearch.tsx is ~350 lines of beautiful UI:
- Search bar with mode toggle (keyword / semantic / hybrid)
- Expandable filter panel with faceted multi-select
- Results with score display and score breakdown
- Server/tool name faceted filtering

**STEAL**: The entire search UI pattern. Mode toggle, facet pickers, expandable filters, score display.

### 2. Faceted Multi-Select with Typeahead (FacetPicker component)
- Dropdown with chip-style selected items
- Inline filter-as-you-type
- Count badges per bucket
- Keyboard support (backspace removes last chip)

**STEAL**: This component for filtering assets by type, department, tool compatibility, etc.

### 3. Hybrid Fusion Controls
- Toggle between Rank Fusion and Score Fusion
- Adjustable keyword/vector weights with sliders
- Score normalization options (none, sigmoid, minMaxScaler)

**STEAL**: Expose these controls for power users tuning search relevance.

### 4. Capability Fingerprinting (fingerprint.ts)
- SHA256 hash of canonicalized tool metadata (sorted keys → JSON → hash)
- Per-tool, per-resource, per-prompt, per-server fingerprints
- Server fingerprint = hash of all child fingerprints concatenated
- Used for change detection: "has this tool's schema changed since last sync?"

**STEAL**: Fingerprint every asset version. Detect when upstream assets change.
Track "this skill was updated since you last installed it."

### 5. Change Detection (change-detection.ts)
- Diff old vs new fingerprints → categorize as added/removed/modified/unchanged
- `hasChanges()` helper for quick "anything different?" check

**STEAL**: Track asset version drift. Show "3 of your installed skills have updates available."

### 6. MCP Tool Sync to MongoDB (mcp-sync.ts)
- Bulk upsert pattern: `bulkWrite` with `updateOne + upsert: true`
- Prune stale entries: delete docs not in current sync set
- Store fingerprint alongside tool metadata
- Graceful error handling (warn + continue)

**STEAL**: The sync pattern for importing/refreshing assets from external sources.

### 7. Agentic Tool Selection (tool-selection.ts) — THE GENIUS PART
Two modes for selecting which tools an LLM should use:

**Semantic Mode**: Embed the conversation tail → vector search for matching tools
**Agentic Mode**: Use a SUB-AGENT (small LLM) to analyze the conversation and COMPOSE a search query,
then search with that query. The sub-agent explains WHY it chose those terms.

Both modes:
- Extract conversation "tail" within a token budget
- Search MongoDB for matching tools
- Apply score cutoff filtering
- Return trace data (timing, reasoning, scores) for debugging

**STEAL FOR OUR COPILOT**: When a user says "I need to set up my sales team's AI configs",
our built-in copilot could:
1. Use agentic selection to understand the intent
2. Search our asset registry for matching skills/plugins/rules
3. Recommend a "department harness" bundle
4. Show the reasoning trace for transparency

### 8. Embedding Configuration UI (ToolEmbeddingsConfig + EmbeddingsProviderConfig)
- Configure multiple embedding providers
- Each provider can generate different fields (different dimensions, models)
- Per-tool-search you pick which embedding field to query

**STEAL**: Let users configure their preferred embedding provider for search.

### 9. Three-View Layout
```
Sidebar | Content
--------|--------
Chat    | ChatView (LLM interaction with tool use)
Explore | McpExplorer (browse servers, tools, resources, prompts)
Settings| SettingsPanel (providers, embeddings, MongoDB, MCP configs)
```

**STEAL**: Our platform could have similar three-view: Browse/Search | Copilot Chat | Settings

### 10. Score Details in Search Results
Each result shows the raw score AND a breakdown of sub-scores:
```
result.scoreDetails = { keyword: 0.8234, vector: 0.6712 }
```
This transparency builds trust in search quality.

**STEAL**: Show score breakdown in our search results.
