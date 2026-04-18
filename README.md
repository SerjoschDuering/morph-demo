# Morph

**The AI workspace that builds itself.**

> Use your computer to use your computer.

Morph is a desktop AI workspace where the chat builds its own UI panels. You describe a tool you wish you had — a calendar, a tax assistant, a signal feed, a markdown editor — and the agent writes a React component, compiles it in-browser with `esbuild-wasm`, and drops it into the app panel next to the chat. The panel then pushes its live state back to the agent, so your next question arrives with context already attached. The interesting part isn't that it renders UI. It's that the UI is a peer in the conversation — and that the workspace orchestrates the tools you already use (Rhino, Blender, Google Workspace, a browser, a terminal) via MCP servers and CLIs.

![Pitch](docs/diagrams/01-pitch-hub.excalidraw)

> The diagrams live as `.excalidraw` files. Open them at [excalidraw.com](https://excalidraw.com) → **File** → **Open**.

## What it does

- **AI creates apps on the fly.** Ask for a tool, get a tool. Source compiles in-browser, runs in-process (no iframes), renders in about 40ms.
- **Apps talk back.** Every app calls `window.Morph.updateContext(...)` with its current state. The agent reads that before replying — no copy-paste.
- **AI controls your tools.** The workspace can drive Rhino, Blender, a terminal, a browser, or any MCP-exposed service. The chat orchestrates, the apps observe.
- **Workspaces isolate everything.** Each workspace has its own filesystem, memory, secrets, and apps. Switch contexts without leaking state.

## The story in four panels

See `docs/diagrams/02-comic-strip.excalidraw` for a walkthrough: a user asks for a signal feed, the agent scaffolds the component, the app mounts and starts pushing state, the agent uses that state to answer the next question.

## Architecture

Tauri shell wraps a React 19 frontend. A Node sidecar (the "bridge") hosts the Claude Agent SDK and shuttles messages to the renderer. When the agent writes `.tsx` source into the workspace, the compiler module picks it up, runs it through `esbuild-wasm`, and hands the resulting JS blob back to the app panel to mount.

See `docs/diagrams/03-technical-architecture.excalidraw` for the full picture and `docs/architecture.md` for the written version.

## Tech stack

| Layer | Choice |
|-------|--------|
| Shell | Tauri 2 (Rust) |
| UI | React 19 + Tailwind v4 |
| State | Zustand |
| Agent | Claude Agent SDK in a Node sidecar |
| Compile | `esbuild-wasm` in the renderer |
| Bridge | stdio JSON-RPC, Tauri IPC for UI events |
| Diagrams | Excalidraw |

## Running locally

```bash
git clone https://github.com/SerjoschDuering/morph
cd morph
npm install
npm run tauri dev
```

Requires:

- Node 20+
- Rust (stable)
- Xcode Command Line Tools (macOS)
- Claude Code configured (`~/.claude/` with a working subscription or API key)

The first run downloads `esbuild-wasm` and builds the Rust side — expect ~3 minutes of warm-up.

## Status

This is a working demo, not a product. The code is messy in places. It proves one thesis:

> The AI workspace should extend itself. You shouldn't have to ship an app update to get a new panel — the chat should grow it, the app should feed back, and the loop should close without you leaving the conversation.

The UI is deliberately "rough edges visible." It is not trying to be a polished IDE. It is trying to show that the workspace can *be authored from inside itself*.

## What's next

- Cloud sync for workspace state (optional, per-workspace)
- Scheduled tasks / long-running agents with durable state
- Shared workspaces (multi-user, CRDT-backed)
- A proper app registry so generated apps can be published and reused
- Better MCP onboarding UI (right now it's config-file-driven)

## License

MIT — see [LICENSE](LICENSE).

## Credits

Built by [@SerjoschDuering](https://github.com/SerjoschDuering). Powered by [Claude Agent SDK](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/sdk) and [Tauri](https://tauri.app).
