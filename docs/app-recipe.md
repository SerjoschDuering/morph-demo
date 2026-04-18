# Morph App Recipe

> AI instructions for creating new Morph workspace apps.

## Overview

A Morph **app** is a React component that lives in a tab in the workspace app panel. The AI generates the source code as a `.tsx` file, which is compiled in-browser by esbuild-wasm (~40ms) and rendered in-process.

Apps are **not** iframes — they run in the same JS context as the host app, sharing `window.React`, `window.ReactDOM`, and the `window.Morph` bridge object.

---

## Minimal App Template

```tsx
// ⚠️ No import statements for React — destructure from window.React
const { useState, useEffect } = window.React;

export default function App() {
  const [data, setData] = useState(null);

  useEffect(() => {
    // Register with the AI bridge
    window.Morph.register({
      description: "What this app does, in 1-2 sentences",
      contextHint: "What updateContext sends — e.g. 'selected item and filter state'",
    });
  }, []);

  return (
    <div style={{ padding: 16, background: "var(--bg-panel)", minHeight: "100%", color: "var(--text-1)" }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>App Title</h2>
      <p style={{ fontSize: 13, color: "var(--text-2)" }}>Hello from Morph!</p>
    </div>
  );
}
```

---

## window.Morph API

| Method | Description |
|--------|-------------|
| `Morph.register(manifest)` | Tell the AI what this app does. Call once on mount. |
| `Morph.updateContext(data)` | Push current state to the AI. Call on any significant state change. |
| `Morph.readFile(path)` | Read a text file. Returns `Promise<string>`. |
| `Morph.readBinaryFile(path)` | Read a binary file (GLB, images, etc). Returns `Promise<ArrayBuffer>`. |
| `Morph.listDir(path)` | List a directory. Returns `Promise<DirEntry[]>`. |
| `Morph.onCommand(cb)` | React to AI commands. `cb` receives `{ command, data?, path? }`. |

### register() manifest shape

```ts
{
  description: string;          // What this app does
  contextHint?: string;         // What updateContext() sends
  icon?: string;                // Emoji for the tab icon (e.g. "📊", "🗺️", "📝")
  inputFile?: string;           // Path the AI writes JSON to: ~/morph-output/{name}.json
  commands?: string[];          // Commands onCommand accepts
  capabilities?: Array<"readFile" | "listDir">;
}
```

### updateContext() example

```ts
useEffect(() => {
  window.Morph.updateContext({
    _summary: "dataset-v2 · 142k rows",  // short summary for AI
    selected: selectedItem,
    filter: activeFilter,
    dataLoaded: !!data,
  });
}, [selectedItem, activeFilter, data]);
```

The `_summary` field gives the AI a short label (shown in the workspace context display).

---

## Theming Rules

**NEVER hardcode hex colors or rgba values.** Always use CSS variables:

| Token | Use for |
|-------|---------|
| `var(--bg-panel)` | Main app background |
| `var(--bg-card)` | Cards, sidebars, elevated surfaces |
| `var(--bg-active)` | Selected/highlighted state |
| `var(--bg-input)` | Input fields, text areas |
| `var(--bg-hover)` | Hover states |
| `var(--text-1)` | Primary text |
| `var(--text-2)` | Secondary text |
| `var(--text-3)` | Labels, placeholders, muted |
| `var(--border)` | All borders |
| `var(--border-subtle)` | Lighter borders |
| `var(--accent)` | Highlights, active markers, CTAs |
| `var(--accent-soft)` | Accent background tint |
| `var(--green)` | Success states |

**Morph supports light and dark mode.** Apps MUST work in both themes. Using CSS variables guarantees this automatically for colors. For conditional logic (e.g. map tile URLs, chart backgrounds, canvas drawing):

```ts
const isDark = document.documentElement.getAttribute("data-theme") === "dark";
const tileUrl = isDark
  ? "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
  : "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

// For glass/overlay backgrounds:
const panelBg = isDark ? 'rgba(10,10,15,0.8)' : 'rgba(255,255,255,0.85)';
const borderColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
```

---

## Loading CDN Dependencies

Use script/link injection with a guard to avoid double-loading:

```ts
function loadLeaflet(): Promise<void> {
  return new Promise((resolve) => {
    if (window.L) { resolve(); return; }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
}

useEffect(() => {
  loadLeaflet().then(() => {
    // L is now available
    const map = L.map("map-container").setView([48.2, 16.37], 13);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
  });
}, []);
```

**Always load DOMPurify alongside markdown renderers:**
```ts
// When using `marked` or any markdown library:
const clean = DOMPurify.sanitize(marked.parse(rawMarkdown));
```

---

## What Works / What Doesn't

### Works ✅
- `window.React`, `window.ReactDOM` — always available
- `window.Morph.*` — bridge API (register, updateContext, readFile, listDir, onCommand)
- CSS variables from the host theme
- Inline styles
- Script/link injection for CDN deps (Leaflet, ECharts, marked, DOMPurify)
- `fetch()` for external APIs
- `localStorage`, `sessionStorage`

### Doesn't work ❌
- `import` statements (except `export default` which esbuild handles) — no runtime module system
- `process.env` — not available in browser context
- `require()` — no CommonJS runtime
- Bundling your own React — only one React per page, use `window.React`
- CSS Modules — styles are global (use unique class names or inline styles)
- `ReactDOM.render()` — use `window.React.createElement` directly or JSX via `window.React`

---

## Information to Collect from User

Before building a new app, ask:

1. **Name** — What should the app be called? (becomes the tab label)
2. **Purpose** — What should it do? What problem does it solve?
3. **Data source** — Does it read files? Which paths? Does it need an API?
4. **Capabilities needed** — Should it use `readFile`, `listDir`, or external APIs?
5. **Interactivity** — What should the user be able to do? (select, filter, input, visualize?)
6. **Output** — Should the app share state back to the AI? What state is useful?

---

## AI Workflow for Creating an App

1. **Ask the 6 questions** above (can be combined into one message)
2. **Write the app** — use the template above, follow all theming rules
3. **Respond in JSON** — the bridge expects:
   ```json
   { "type": "app_created", "appName": "My App", "sourceCode": "const { useState } = window.React; ..." }
   ```
   This happens automatically via the Claude Code hook in the bridge sidecar.
4. **Tell the user** — explain what was built and how to interact with it
5. **Iterate** — user feedback → update source → bridge auto-recompiles

---

## File Paths

Apps can read/write files via the Morph bridge:

- State file: `~/morph-workspace/apps/{wsId}/{app-name}/state.json`
- Manifest: `~/morph-workspace/apps/{wsId}/{app-name}/manifest.json`
- Input: `~/morph-output/{app-name}.json` (AI writes here to push data to app)

Use `~` for home dir. Morph expands it server-side.

---

## updateContext() Rules

Context is serialized into EVERY user message sent to the AI. Keep it minimal:

- **Send:** `_summary` (5-word label), counts, totals, selected item, file paths
- **Don't send:** full arrays, addresses, file contents, raw API responses
- **Pattern:**
  ```ts
  window.Morph.updateContext({
    _summary: "5 items · filtered",
    count: 5,
    selected: currentItem?.id,
    files: { data: "~/workspace/data.json" },
  });
  ```
- **Anti-pattern:**
  ```ts
  // ❌ This duplicates file content into every message
  window.Morph.updateContext({ items: fullItemArray, customers: allCustomers });
  ```

The AI can always call `Morph.readFile(path)` to get full data on demand.

---

## Data Storage

Apps store data as **JSON files** in their workspace directory. The AI creates and updates these files; the app reads them via `Morph.readFile()`.

### Convention

```
~/morph-workspace/apps/{wsId}/{app-name}/
  ├── manifest.json    # auto-created by Morph.register()
  ├── state.json       # auto-created by Morph.updateContext()
  ├── customers.json   # app-specific data (AI writes, app reads)
  └── invoices.json
```

### Reading data on mount

```tsx
const DATA_DIR = '~/morph-workspace/apps/personal/my-app';

async function readJson<T>(file: string): Promise<T | null> {
  try {
    const text = await window.Morph?.readFile(`${DATA_DIR}/${file}`);
    return text ? JSON.parse(text) as T : null;
  } catch { return null; }
}

// In component:
useEffect(() => {
  readJson<Customer[]>('customers.json').then(data => {
    if (data) setCustomers(data);
  });
}, []);
```

### Auto-reload pattern

Poll for file changes (simple, no watchers needed):

```tsx
useEffect(() => {
  const interval = setInterval(() => {
    readJson<Customer[]>('customers.json').then(d => d && setCustomers(d));
  }, 3000); // every 3s
  return () => clearInterval(interval);
}, []);
```

### AI → App command flow

The AI pushes commands by writing JSON to `~/morph-output/{app-name}.json`:

```json
{ "command": "load_model", "data": { "path": "~/models/example.glb" } }
```

The bridge detects the write, parses the JSON, and delivers it to the app's `onCommand` handler:

```tsx
window.Morph.onCommand((cmd) => {
  if (cmd.command === 'load_model') loadModel(cmd.data.path);
  if (cmd.command === 'reload') refreshData();
});
```

Register accepted commands so the AI knows what the app supports:
```tsx
window.Morph.register({
  description: '3D model viewer',
  commands: ['load_model', 'reset_camera', 'reload'],
});
```

**Backward compat:** If migrating from string-based commands, handle both:
```tsx
window.Morph.onCommand((cmd) => {
  const c = typeof cmd === 'string' ? cmd : cmd.command;
  if (c === 'reload') refresh();
});
```

### Summary

| What | How |
|------|-----|
| App reads data | `Morph.readFile(path)` → parse JSON |
| AI writes data | `Write` tool to the app's data dir |
| Live reload | Poll with `setInterval` or use `onCommand` |
| Push from AI | Write `{ "command": "...", "data": {...} }` to `~/morph-output/{app-name}.json` |
| Quick local state | `localStorage` (survives reloads, not shared with AI) |
