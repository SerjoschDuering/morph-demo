# Morph Architecture

This document describes how the pieces fit together. Read it alongside `docs/diagrams/03-technical-architecture.excalidraw` — the diagram is the primary source and this doc is its text companion.

## The three-binary Rust split (target)

The repo is currently shipped as a single Tauri app (`src-tauri/`), but the architecture the diagram describes — and the direction the code is heading — is a **three-binary split**:

- **`morph-core`** — a pure Rust library. Holds the workspace model, the app registry, the compiler bridge types, and the event schema. No I/O, no Tauri, no network. Depended on by the other two.
- **`morph-desktop`** — the Tauri 2 app. Wraps `morph-core`, owns the window, spawns the Node sidecar, and exposes IPC commands to the React renderer.
- **`morph-server`** — an optional axum HTTP server. Re-exposes the same `morph-core` API over HTTP/WebSocket so a workspace can run headless (CI, cloud sync, shared sessions). Same core, different shell.

The split keeps the interesting logic out of the GUI crate so it can be tested without a display server and embedded in whatever frontend (or no frontend) makes sense.

## The bridge

Long-running agent work lives in a Node sidecar (`sidecar/bridge.mjs`). Claude Agent SDK runs there — **not** in the Rust process — because the SDK is Node-native and because we want to isolate its memory and crash behaviour from the UI.

Flow:

1. Renderer (React) → Tauri IPC → `morph-desktop`
2. `morph-desktop` writes a JSON message to the sidecar's stdin
3. Sidecar runs the agent turn, streams tool calls and text back on stdout
4. `morph-desktop` parses the stream and emits Tauri events to the renderer

The sidecar is stateless between turns from the Rust side's point of view — all session state lives in files on disk (compatible with Claude Code's session format) so the sidecar can be restarted without losing anything.

## In-process apps (not iframes)

When the agent writes a new `.tsx` file into the workspace, the frontend compiler (`src/lib/compiler.ts`) picks it up:

1. Source is handed to `esbuild-wasm` running in the renderer
2. Output JS is wrapped in a blob URL
3. `AppPanel.tsx` imports the blob and mounts the component as a child of the host React tree

Apps share `window.React`, `window.ReactDOM`, and `window.Morph` with the host. They are **not** sandboxed via iframes. This is a deliberate trade-off:

- **Pro:** zero-latency state sharing, single React runtime, tiny memory footprint, works offline (no iframe bundling dance)
- **Con:** a malicious app could touch anything the host can touch

For a demo this is fine — the agent is the only one writing app source, and you trust the agent. For production, a later iteration will move to iframe + `postMessage` with a typed protocol. The `window.Morph` API is already shaped for that transition.

## The compile loop

```
agent writes source.tsx
     │
     ▼
chokidar watcher in the bridge detects the write
     │
     ▼
bridge sends "source_updated" event to renderer
     │
     ▼
compiler.ts runs esbuild-wasm (~40ms)
     │
     ▼
AppPanel mounts new blob, old component unmounts
     │
     ▼
new component calls window.Morph.register() + updateContext()
     │
     ▼
agent's next turn sees the new app in its context
```

There is no round-trip through a server, no package install, no bundler config. The app is available in the workspace the moment the compile finishes.

## State and storage

- **Zustand stores** (`src/stores/`) hold UI state: active workspace, chat history, app manifests, compile status.
- **Workspace files** live on disk under `~/workspaces/<id>/`. That's the authoritative copy. Zustand mirrors it for speed.
- **Memory** (`memory/*.md`, `CLAUDE.md`) is plain markdown. The agent reads and writes it with the same tools it uses for any other file.
- **Secrets** are scoped per workspace, with an optional "inherit from global" flag.

## Why `rig-core` (future)

The current sidecar uses `@anthropic-ai/claude-agent-sdk` directly. The long-term plan is to swap in [`rig-core`](https://github.com/0xPlaygrounds/rig) on the Rust side so the agent runtime lives next to `morph-core`. This collapses the three-binary split into **two** moving parts (Rust + web frontend) and makes the headless `morph-server` much thinner. The SDK-in-Node approach is a scaffolding choice; it's not where this wants to end up.

## See also

- `docs/diagrams/01-pitch-hub.excalidraw` — the elevator pitch in one picture
- `docs/diagrams/02-comic-strip.excalidraw` — the user story in four panels
- `docs/diagrams/03-technical-architecture.excalidraw` — this doc in diagram form
- `docs/app-recipe.md` — how the agent writes apps
