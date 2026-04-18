# Morph

**The AI workspace that grows around how you actually work.**

> Use your computer to use your computer.

---

I wanted one tool that could bring together everything I already use — the chat, the terminal, a browser, design software, my notes, my files, my email, a dozen CLIs and glue scripts — and quietly consolidate them into one place that learns my patterns.

A **virtual brain** I could keep talking to. One that builds its own interface over time, remembers what I taught it, and uses my computer the way I would.

Morph is my attempt at that.

![Pitch](docs/diagrams/images/01-pitch-hub.png)

## What it does

Morph is a chat — but the chat is the control plane for **your whole stack**, and the interface evolves around you as you use it.

**It builds your workspace over time.** You don't set up apps. You use Morph, and the apps you need appear. A tax assistant the first time you file. An invoice generator when you take on a freelance gig. A map panel when you're reviewing a site. A model viewer when you open a `.glb`. Each one is a real React panel the agent wrote for you — persistent, reusable, tuned to how *you* work.

**It orchestrates what you already have.** Instead of asking you to migrate to a new tool, Morph drives the tools you already use — Rhino, Blender, your browser, your terminal, Google Workspace, Figma, your files — via MCP servers and CLIs. You stay in the chat. Morph does the clicking.

**Apps feed the chat, and the chat feeds the apps.** Every panel pushes its live state back into the conversation. The agent always has context — no copy-paste, no re-explaining. When it needs to push something back, it writes to the app and the app reacts.

**It consolidates your knowledge.** A markdown editor, a filesystem, shared memory, RAG — built-in and wired together by default. Today you glue Claude Code + Obsidian + a notes app + half a dozen scripts. Morph is the single place where all of it lives and reinforces itself.

**It grows with you.** The more you use it, the more it knows. Skills you teach stick. Memory accumulates. Workspaces branch off for each project. Over weeks, Morph stops being a tool you use and starts being the shape your work takes.

## The story in four panels

![Story](docs/diagrams/images/02-comic-strip.png)

From 15 tabs and a stack of CLIs → one chat that reaches into them → a workspace that grows around what you actually do → sharable with your team or a cloud instance that runs even when you're offline.

## Architecture

![Architecture](docs/diagrams/images/03-technical-architecture.png)

A Tauri 2 desktop shell wraps a React 19 frontend. A Node sidecar hosts the Claude Agent SDK. When the agent writes a `.tsx` source file, `esbuild-wasm` compiles it in the browser in ~40ms and the app mounts in-process — no iframes, shared React context, `window.Morph` as the bridge.

An optional **cloud arm** runs the same core on a server: triggers, cron, webhooks, always-on agents, Telegram bot, shared workspaces for a team. You decide per-workspace what lives where.

See [`docs/architecture.md`](docs/architecture.md) for the written version.

## Features in this demo

- [x] Local desktop app (Tauri 2)
- [x] Chat panel streaming from Claude Agent SDK
- [x] AI-generated React apps, compiled in-browser with esbuild-wasm
- [x] In-process app rendering (not iframes) — shared React context
- [x] App state feedback loop (`window.Morph.updateContext`)
- [x] Multiple workspaces with their own filesystem and memory
- [x] MCP + CLI orchestration hooks
- [x] 14 example apps — tax assistant, 3D viewer, calendar, markdown editor, signal feed, kanban, …
- [ ] Cloud arm (design done, not built)
- [ ] Telegram / mobile surfaces (planned)
- [ ] Skills, Hooks, Subagents — following the standards (partial)
- [ ] Shared workspaces / multi-user (planned)
- [ ] Sync engine (rclone-based, planned)
- [ ] Self-hosted model routing (planned, rig-core under the hood)

## Tech stack

| Layer | Choice |
|-------|--------|
| Shell | Tauri 2 (Rust) |
| UI | React 19 + Tailwind v4 |
| State | Zustand |
| Agent | Claude Agent SDK (Node sidecar) |
| Compiler | `esbuild-wasm` in the renderer |
| Bridge | stdio JSON-RPC + Tauri IPC |
| Planned | `rig-core` (multi-provider), `axum` (server arm), rclone (sync) |

## Running locally

```bash
git clone https://github.com/SerjoschDuering/morph-demo
cd morph-demo
npm install
npm run tauri dev
```

Requires: Node 20+, Rust (stable), Xcode CLI Tools (macOS), Claude Code configured at `~/.claude/`.

First run downloads `esbuild-wasm` and builds the Rust side — expect 2–3 minutes.

## Status — this is a demo

**This is a simple demo, not a product.** It exists to timestamp an idea and show the thesis works.

Sloppy code, rough UX, 80% of the envisioned features missing or stubbed. The cloud arm, sync, mobile surfaces, multi-user, and most of the standards integration are design-complete but unbuilt.

What it *does* prove: the loop closes. The chat can write a panel, the panel mounts live, the panel informs the chat, the chat acts. Workspaces isolate. MCP orchestrates. The shape of the thing is real.

If that shape resonates, open an issue — I'm interested in the conversation more than the code.

## License

MIT — see [LICENSE](LICENSE).

## Credits

Built by [@SerjoschDuering](https://github.com/SerjoschDuering). Powered by [Claude Agent SDK](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/sdk) and [Tauri](https://tauri.app).
