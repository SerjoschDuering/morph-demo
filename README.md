# Morph

**The AI workspace that grows around how you actually work.**

> Use your computer to use your computer.

<p align="center">
  <img src="docs/images/app-entity-network.png" width="49%" alt="Morph with a custom entity-network panel" />
  <img src="docs/images/app-settings-privacy.png" width="49%" alt="Per-workspace privacy settings" />
</p>

Morph is a local-first AI workspace. The chat is the control plane for your whole stack. When a UI helps, the agent builds one. Apps persist. Memory accumulates. Over time, the workspace becomes the shape your work takes.

---

## Why I'm building this

I stitched together my own stack piece by piece — a self-hosted Lovable-style deploy tool, a Windmill-style automation server, a file-transfer service, a pile of CLIs glued together with shell scripts. Each piece worked. Together they became exhausting. 15 tabs to do one thing.

Somewhere along the way **Claude Code became my default interface**. Chat is a faster control surface than most UIs. But text isn't always enough — sometimes you need to *see* a chart, preview an invoice, scrub a 3D model. And when you do, the UI can't be yet another floating tab. It has to be **part of the conversation**.

So here's the idea, in four panels:

![The story in four panels](docs/diagrams/images/02-comic-strip.png)

Morph is a **vertical, self-hosted take on Claude Cowork**: one chat, per-life workspaces, persistent UI panels that feed context back to the agent, and a cloud arm that's always-on when you want it. Your model, your data, your residency.

## What it does

- **Chat-as-orchestrator.** One prompt. Morph reaches into your existing stack (MCP + CLIs) and gets it done.
- **UI panels the agent builds for you.** React components compiled in-browser in ~40ms, mounted as persistent tabs. They share state with the chat both ways.
- **Workspaces organise your life.** Each one has its own filesystem, memory, skills, secrets, and apps.
- **Grows with you.** Skills stick. Memory accumulates. The more you use it, the more it knows.
- **Cloud arm, optional.** Cron, triggers, webhooks, Telegram — the same workspace reachable from anywhere.
- **Model choice is yours.** Claude, GPT, Gemini, or fully offline via Ollama. EU-only endpoints if you need them.

## See it in action

<p align="center">
  <img src="docs/images/app-empty-state.png" width="49%" alt="Empty workspace — the chat is the interface" />
  <img src="docs/images/app-tax-assistant.png" width="49%" alt="A tax-assistant panel the agent built and maintains" />
</p>

Morph also orchestrates your existing desktop apps — here driving Rhino through MCP (script, capture, export) and showing the result in a 3D viewer panel next to the chat:

![3D viewer + Rhino MCP](docs/images/app-3d-viewer-mcp.png)

## Architecture

A Tauri 2 desktop shell wraps a React 19 frontend. A Node sidecar hosts the Claude Agent SDK. When the agent writes a `.tsx` source file, `esbuild-wasm` compiles it in the browser and the app mounts in-process — no iframes, shared React context, `window.Morph` as the bridge.

An optional **cloud arm** runs the same core on a server: triggers, cron, webhooks, always-on agents, Telegram, shared workspaces. You decide per-workspace what lives where.

Full technical write-up: [`docs/architecture.md`](docs/architecture.md). Diagrams (Excalidraw source): [`docs/diagrams/`](docs/diagrams/).

## Features in this demo

- [x] Tauri 2 desktop app
- [x] Chat panel streaming from Claude Agent SDK
- [x] AI-generated React apps, compiled in-browser via esbuild-wasm
- [x] In-process app rendering (not iframes)
- [x] App ↔ agent context feedback loop (`window.Morph.updateContext`)
- [x] Multiple workspaces, own filesystem and memory
- [x] MCP + CLI orchestration
- [x] 14 example apps
- [ ] Cloud arm — designed, not built
- [ ] Telegram / mobile surfaces — planned
- [ ] Shared workspaces / multi-user — planned
- [ ] Sync engine (rclone) — planned
- [ ] Self-hosted model routing (rig-core) — planned

## Tech stack

| Layer | Choice |
|-------|--------|
| Shell | Tauri 2 (Rust) |
| UI | React 19 + Tailwind v4 |
| State | Zustand |
| Agent | Claude Agent SDK (Node sidecar) |
| Compiler | `esbuild-wasm` (in the renderer) |
| Bridge | stdio JSON-RPC + Tauri IPC |
| Planned | `rig-core`, `axum`, rclone |

## Running locally

```bash
git clone https://github.com/SerjoschDuering/morph-demo
cd morph-demo
npm install
npm run tauri dev
```

Requires Node 20+, Rust (stable), Xcode CLI Tools (macOS), and Claude Code configured at `~/.claude/`. First run takes 2–3 minutes to build.

## Status — this is a demo

Sloppy code, rough UX, 80% of the envisioned features missing or stubbed. This exists to timestamp an idea and show the loop closes: the chat writes a panel, the panel mounts live, the panel informs the chat, the chat acts.

If the shape resonates, open an issue — I'm more interested in the conversation than the code.

## License

MIT — see [LICENSE](LICENSE).

## Credits

Built by [@SerjoschDuering](https://github.com/SerjoschDuering). Powered by [Claude Agent SDK](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/sdk) and [Tauri](https://tauri.app).
