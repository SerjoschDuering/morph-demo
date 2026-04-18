/**
 * Claude Bridge — Node.js sidecar wrapping @anthropic-ai/claude-agent-sdk
 * Patterns adapted from gn-workspace's ClaudeBridge.
 */
// Unset CLAUDECODE so the CLI doesn't refuse to launch inside another session
delete process.env.CLAUDECODE;
delete process.env.CLAUDE_CODE_ENTRYPOINT;

import { query, listSessions, getSessionMessages } from "@anthropic-ai/claude-agent-sdk";
import { WebSocketServer } from "ws";
import { appendFileSync, readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { transformEvent, formatToolDesc } from "./transform.mjs";

// --- Logging: write to /tmp/morph-bridge.log ---
const LOG_PATH = "/tmp/morph-bridge.log";
function log(level, ...args) {
  const line = `[${level} ${new Date().toISOString()}] ${args.map(a => typeof a === "string" ? a : JSON.stringify(a)).join(" ")}\n`;
  try { appendFileSync(LOG_PATH, line); } catch {}
  try {
    if (level === "ERROR") console.error(...args);
    else console.warn(...args);
  } catch {}
}

process.on("uncaughtException", (err) => {
  if (err?.code === "EPIPE") return; // Parent pipe closed — exit silently
  try { appendFileSync(LOG_PATH, `[FATAL ${new Date().toISOString()}] Uncaught: ${err?.stack || err?.message}\n`); } catch {}
});
process.on("unhandledRejection", (reason) => {
  try { appendFileSync(LOG_PATH, `[FATAL ${new Date().toISOString()}] Rejection: ${reason?.stack || reason?.message}\n`); } catch {}
});

const WATCHDOG_TIMEOUT_MS = 1_800_000; // 30 min — subagents and complex queries can run very long

// --- Morph app-building instructions — injected once via systemPrompt.append ---
const MORPH_APP_INSTRUCTIONS = `
[Morph Platform]
You are inside Morph, an AI workspace with live app tabs.

## Sending commands to running apps (IMPORTANT)

To push data or trigger actions in a running app, use the Write tool to write JSON to:
  ~/morph-output/{app-name}.json

The bridge detects the write and delivers it to the app's onCommand handler automatically.
Do NOT rewrite the app source to load data. Do NOT write to ~/morph-workspace/. Always use ~/morph-output/.

Example — load a GLB model into the 3d-viewer app:
  Write to ~/morph-output/3d-viewer.json:
  { "command": "load_model", "data": { "path": "/absolute/path/to/model.glb" } }

Example — reload the tax-assistant app:
  Write to ~/morph-output/tax-assistant.json:
  { "command": "reload" }

Check the app's registered commands (in its manifest or register() call) to know which commands it accepts.

## Creating/updating apps

Write a .tsx file to apps/{app-name}/source.tsx (relative to cwd). It auto-compiles via esbuild-wasm and renders as a new tab.

Rules:
- Use "export default function App()" as the component export. esbuild compiles it to an IIFE.
- Destructure React from window: const { useState, useEffect } = window.React;
- Do NOT use import statements for React. CDN deps: inject via <script> tag with guard (if (window.L) return).
- CSS: only var(--bg-panel), var(--text-1), var(--accent), etc. Never hardcode colors. App must work in both light and dark mode.
- Call window.Morph.register({ description, contextHint, icon, commands, capabilities }) on mount. icon = emoji (e.g. "📊").
- Call window.Morph.updateContext() with MINIMAL data: _summary (5 words), counts, file paths. Never full arrays.
- Data: store JSON files in ~/morph-workspace/apps/{wsId}/{app-name}/. Read via Morph.readFile(path).
- Bridge API: Morph.readFile(path) for text, Morph.readBinaryFile(path) for binary (returns ArrayBuffer — use for GLB, images, etc.), Morph.listDir(path), Morph.onCommand(cb).

For full template + examples: Read docs/app-recipe.md (relative to cwd).

## Commanding running apps

To interact with a running app, write a JSON command to ~/morph-output/{app-name}.json.
The app's onCommand handler will receive the parsed JSON object.
Check the app's registered commands (visible in workspace context above) to know what it accepts.
Entity names mentioned in chat are rendered as clickable pills that auto-command the Entity Network graph.
`.trim();

const wss = new WebSocketServer({ host: "127.0.0.1", port: 0 });

wss.on("listening", () => {
  const port = wss.address().port;
  process.stdout.write(JSON.stringify({ type: "ready", port }) + "\n");
});

/** Scan ~/.claude/ for installed plugins, commands, MCP servers */
function scanExtensions() {
  const home = process.env.HOME || "/";
  const claudeDir = join(home, ".claude");
  const result = { plugins: [], skills: [], mcpServers: [], tools: [], commands: [] };

  // Installed plugins from registry
  try {
    const registry = JSON.parse(readFileSync(join(claudeDir, "plugins/installed_plugins.json"), "utf-8"));
    for (const [key, versions] of Object.entries(registry.plugins || {})) {
      const latest = versions[0];
      const name = key.split("@")[0];
      result.plugins.push({ name, path: latest?.installPath || "" });
      // Scan for skills inside plugin (each skill is a directory with SKILL.md)
      try {
        const skillsDir = join(latest.installPath, "skills");
        for (const entry of readdirSync(skillsDir)) {
          try {
            const skillPath = join(skillsDir, entry);
            if (statSync(skillPath).isDirectory()) {
              result.skills.push({ name: `${name}:${entry}`, plugin: name, path: skillPath });
            }
          } catch {}
        }
      } catch {}
    }
  } catch {}

  // Custom commands
  try {
    const cmdsDir = join(claudeDir, "commands");
    for (const f of readdirSync(cmdsDir)) {
      if (f.endsWith(".md")) result.commands.push("/" + f.replace(".md", ""));
    }
  } catch {}

  // MCP servers — collect from all known locations
  const addMcp = (name) => {
    if (!result.mcpServers.find(s => s.name === name)) {
      result.mcpServers.push({ name, status: "configured" });
    }
  };

  // Global settings.json
  try {
    const settings = JSON.parse(readFileSync(join(claudeDir, "settings.json"), "utf-8"));
    for (const name of Object.keys(settings.mcpServers || {})) addMcp(name);
  } catch {}

  // ~/.claude/mcp.json (Claude Code CLI global MCP config)
  try {
    const mcp = JSON.parse(readFileSync(join(claudeDir, "mcp.json"), "utf-8"));
    for (const name of Object.keys(mcp.mcpServers || {})) addMcp(name);
  } catch {}

  // ~/.mcp.json (legacy location)
  try {
    const mcp = JSON.parse(readFileSync(join(home, ".mcp.json"), "utf-8"));
    for (const name of Object.keys(mcp.mcpServers || {})) addMcp(name);
  } catch {}

  // Plugin-bundled .mcp.json files (e.g. context7, deploy-on-aws)
  for (const plugin of result.plugins) {
    if (!plugin.path) continue;
    try {
      const pluginMcp = JSON.parse(readFileSync(join(plugin.path, ".mcp.json"), "utf-8"));
      // Two formats: { mcpServers: { ... } } or flat { serverName: { ... } }
      const servers = pluginMcp.mcpServers || pluginMcp;
      for (const [name, val] of Object.entries(servers)) {
        if (val && typeof val === "object" && !Array.isArray(val)) addMcp(name);
      }
    } catch {}
  }

  return result;
}

// --- Module-level query state: survives WS reconnects ---
let nextQueryId = 0;
/** @type {Map<number, {ac: AbortController, sessionId: string|null, detached: boolean, watchdog: ReturnType<typeof setTimeout>|null, queryObj: object|null}>} */
const queries = new Map();
let foregroundId = null;
/** @type {Map<string, {resolve: Function, input: object, queryId: number}>} toolUseID → {resolve, input, queryId} */
const permissionResolvers = new Map();
let connectionSessionId = null;
/** @type {WebSocket|null} */
let currentWs = null;
/** Incremented on each new WS connection — used to avoid race conditions in timers */
let wsGeneration = 0;
/** Ring buffer of recent foreground events — replayed on reconnect */
const EVENT_BUFFER_MAX = 2000;
let eventBuffer = [];
let nextEventId = 0;

/** Send to current WS, or buffer if offline */
function sendOrBuffer(data) {
  // Stamp before serializing, but skip pong (ephemeral — no replay value)
  if (data.type !== "pong" && data.eventId === undefined) data.eventId = nextEventId++;
  const serialized = JSON.stringify(data);
  if (currentWs?.readyState === 1) {
    currentWs.send(serialized);
  } else {
    // Buffer important events (not pong/ping)
    if (data.type !== "pong") {
      eventBuffer.push(serialized);
      if (eventBuffer.length > EVENT_BUFFER_MAX) eventBuffer.shift();
    }
  }
}

wss.on("connection", (ws, req) => {
  const previousWs = currentWs;
  currentWs = ws;
  wsGeneration++;

  // Close old connection to prevent duplicate message processing (TCP half-open scenarios)
  if (previousWs && previousWs.readyState <= 1) {
    previousWs.removeAllListeners();
    previousWs.close();
  }

  // Immediately send scanned extensions — no query needed
  try {
    const ext = scanExtensions();
    sendOrBuffer({ type: "extensions_scan", ...ext });
    log("INFO", "extensions scan:", { plugins: ext.plugins.length, skills: ext.skills.length, mcpServers: ext.mcpServers.length, commands: ext.commands.length });
  } catch (err) {
    log("ERROR", "extensions scan failed:", err?.message);
  }

  // Replay buffered events from any disconnection gap
  if (eventBuffer.length > 0) {
    const reqUrl = new URL(req.url ?? "/", "ws://localhost");
    const lastSeen = parseInt(reqUrl.searchParams.get("lastSeenEventId") ?? "-1", 10);
    const toReplay = lastSeen >= 0
      ? eventBuffer.filter(s => { try { return JSON.parse(s).eventId > lastSeen; } catch { return true; } })
      : eventBuffer;
    log("INFO", `Replaying ${toReplay.length}/${eventBuffer.length} buffered events (cursor: ${lastSeen})`);
    for (const s of toReplay) { if (ws.readyState === 1) ws.send(s); }
    eventBuffer = [];
  }

  // If a foreground query is still running, notify frontend it's streaming
  if (foregroundId !== null && queries.has(foregroundId)) {
    const q = queries.get(foregroundId);
    log("INFO", "Active foreground query on reconnect:", { queryId: foregroundId, sessionId: q.sessionId });
  }

  ws.on("message", async (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    switch (msg.type) {
      case "send_message":
        await handleSendMessage(ws, msg);
        break;
      case "permission_response": {
        const entry = permissionResolvers.get(msg.id);
        log("INFO", "permission_response:", { id: msg.id, allow: msg.allow, hasEntry: !!entry });
        if (entry) {
          permissionResolvers.delete(msg.id);
          const result = msg.allow
            ? { behavior: "allow", updatedInput: entry.input || {} }
            : { behavior: "deny", message: "User denied" };
          log("INFO", "resolving permission:", result);
          entry.resolve(result);
        } else {
          log("WARN", "no resolver found for permission id:", msg.id);
        }
        break;
      }
      case "detach":
        // Move foreground query to background — let it finish without forwarding events
        if (foregroundId !== null && queries.has(foregroundId)) {
          const q = queries.get(foregroundId);
          q.detached = true;
          log("INFO", "detached query:", { queryId: foregroundId, sessionId: q.sessionId });
          // Auto-deny pending permissions for detached query (can't ask user anymore)
          for (const [id, entry] of permissionResolvers) {
            if (entry.queryId === foregroundId) {
              permissionResolvers.delete(id);
              entry.resolve({ behavior: "deny", message: "Session detached — permission auto-denied" });
            }
          }
          foregroundId = null;
        }
        break;
      case "re_attach": {
        const targetSid = msg.sessionId;
        let found = false;
        for (const [qId, q] of queries) {
          if (q.sessionId === targetSid && q.detached) {
            q.detached = false;
            foregroundId = qId;
            sendOrBuffer({
              type: "re_attach_status",
              sessionId: q.sessionId,
              userPrompt: q.userPrompt,
            });
            const replayFrom = typeof msg.lastSeenEventId === "number" ? msg.lastSeenEventId : -1;
            const toReplay = replayFrom >= 0
              ? q.eventLog.filter(e => (e.eventId ?? -1) > replayFrom)
              : q.eventLog;
            for (const evt of toReplay) sendOrBuffer(evt);
            found = true;
            log("INFO", "re-attached:", { queryId: qId, sessionId: targetSid, events: q.eventLog.length });
            break;
          }
        }
        if (!found) {
          // Query finished while detached — fall back to session history
          await handleGetSessionMessages({ sessionId: targetSid });
        }
        break;
      }
      case "interrupt":
        // Kill the foreground query (explicit user cancel)
        if (foregroundId !== null) {
          const q = queries.get(foregroundId);
          const sid = q?.sessionId || null;
          killQuery(foregroundId);
          foregroundId = null;
          sendOrBuffer({ type: "done", sessionId: sid, stopRequested: true });
        }
        break;
      case "list_sessions":
        await handleListSessions(msg);
        break;
      case "get_session_messages":
        await handleGetSessionMessages(msg);
        break;
      case "read_file":
        await handleReadFile(msg);
        break;
      case "list_dir":
        await handleListDir(msg);
        break;
      case "ping":
        sendOrBuffer({ type: "pong" });
        break;
    }
  });

  ws.on("close", () => {
    // Don't kill queries — they survive reconnect. Just mark WS offline.
    if (currentWs === ws) currentWs = null;
    log("INFO", "WS closed. Active queries:", queries.size, "foreground:", foregroundId);
    // Auto-deny ALL pending permissions after 10s if no reconnect (prevents SDK hanging forever)
    // Use generation counter to avoid race: timer and reconnect can fire in same event loop tick
    const genAtDisconnect = wsGeneration;
    if (permissionResolvers.size > 0) {
      setTimeout(() => {
        if (wsGeneration !== genAtDisconnect) return; // Reconnected — generation changed
        for (const [id, entry] of permissionResolvers) {
          permissionResolvers.delete(id);
          entry.resolve({ behavior: "deny", message: "WS disconnected — permission auto-denied" });
          log("INFO", "Auto-denied permission after WS disconnect:", id);
        }
      }, 10_000);
    }
  });
  ws.on("error", (err) => {
    log("ERROR", "WebSocket error:", err?.message);
    if (currentWs === ws) currentWs = null;
  });

  function killQuery(qId) {
    const q = queries.get(qId);
    if (!q) return;
    // Graceful stop via SDK, then hard abort as fallback
    if (q.queryObj?.interrupt) {
      q.queryObj.interrupt().catch(() => {});
    }
    if (q.ac) q.ac.abort();
    if (q.watchdog) clearTimeout(q.watchdog);
    // Deny pending permissions for this query
    for (const [id, entry] of permissionResolvers) {
      if (entry.queryId === qId) {
        permissionResolvers.delete(id);
        entry.resolve({ behavior: "deny", message: "Aborted", interrupt: true });
      }
    }
    queries.delete(qId);
  }

  function killAll() {
    for (const qId of [...queries.keys()]) killQuery(qId);
    foregroundId = null;
  }

  function resetWatchdog(qId) {
    const q = queries.get(qId);
    if (!q) return;
    if (q.watchdog) clearTimeout(q.watchdog);
    q.watchdog = setTimeout(() => {
      log("WARN", "Watchdog timeout — aborting hung query:", { queryId: qId, sessionId: q.sessionId });
      const sid = q.sessionId;
      const wasForeground = qId === foregroundId;
      const wasDetached = q.detached;
      killQuery(qId);
      if (wasForeground) {
        foregroundId = null;
        sendOrBuffer({ type: "error", message: "Session timed out after 30 min of inactivity. Send a message to continue.", sessionId: sid });
        sendOrBuffer({ type: "done", sessionId: sid });
      } else if (wasDetached) {
        sendOrBuffer({ type: "background_done", sessionId: sid, error: "Background query timed out" });
      }
    }, WATCHDOG_TIMEOUT_MS);
  }

  async function handleSendMessage(ws, msg) {
    // If there's a foreground query, kill it (user sent a new message — replaces foreground)
    // NOTE: Do NOT send a done event here — the frontend finalizes the old streaming message
    // in sendMessage() before creating the new placeholder. Sending done from here would race
    // with the frontend's new placeholder and finalize the wrong message.
    if (foregroundId !== null && queries.has(foregroundId)) {
      const fq = queries.get(foregroundId);
      if (!fq.detached) {
        killQuery(foregroundId);
      }
      // If it was detached, it's already running in background — leave it alone
    }

    const { content, cwd, sessionId, model, systemContext } = msg;
    const qId = nextQueryId++;
    const ac = new AbortController();
    queries.set(qId, { ac, sessionId: null, detached: false, watchdog: null, queryObj: null, userPrompt: content, eventLog: [] });
    foregroundId = qId;
    log("INFO", "query start:", { prompt: content?.slice(0, 80), cwd, sessionId: sessionId || "new", model: model || "default", queryId: qId });
    // Expand tilde and ensure workspace cwd exists before building options
    const resolvedCwd = (cwd || (process.env.HOME + "/Desktop")).replace(/^~(?=\/|$)/, process.env.HOME || "");
    try {
      const { mkdirSync } = await import("fs");
      mkdirSync(resolvedCwd, { recursive: true });
    } catch {}

    try {
      const options = {
        abortController: ac,
        cwd: resolvedCwd,
        permissionMode: "default",
        maxTurns: 100,
        allowedTools: ["Read", "Write", "Bash", "Edit", "Glob", "Grep", "WebSearch", "WebFetch"],
        ...(model ? { model } : {}),
        systemPrompt: { type: "preset", preset: "claude_code", append: MORPH_APP_INSTRUCTIONS },
        includePartialMessages: true,
        settingSources: ["user", "project"],
        effort: "high",
        canUseTool: async (toolName, input, opts) => {
          // Auto-approve Write and Bash for demo — agent needs to write apps and run scripts
          if (toolName === "Write" || toolName === "Bash" || toolName === "Edit") {
            log("INFO", "auto-approve demo tool:", { tool: toolName });
            return { behavior: "allow", updatedInput: input || {} };
          }
          const q = queries.get(qId);
          // Auto-deny if query was killed, detached, or is no longer foreground
          if (!q || q.detached || qId !== foregroundId) {
            log("INFO", "auto-deny permission for non-foreground query:", { tool: toolName, queryId: qId });
            return { behavior: "deny", message: "Query no longer active — permission auto-denied" };
          }
          log("INFO", "canUseTool called:", { tool: toolName, id: opts.toolUseID, reason: opts.decisionReason });
          return new Promise((resolve) => {
            permissionResolvers.set(opts.toolUseID, { resolve, input, queryId: qId });
            if (opts.signal) {
              opts.signal.addEventListener("abort", () => {
                if (permissionResolvers.has(opts.toolUseID)) {
                  permissionResolvers.delete(opts.toolUseID);
                  resolve({ behavior: "deny", message: "Aborted by SDK", interrupt: true });
                }
              }, { once: true });
            }
            sendOrBuffer({
              type: "permission_request",
              id: opts.toolUseID,
              tool: toolName,
              input,
              description: formatToolDesc(toolName, input),
              suggestions: opts.suggestions || null,
            });
          });
        },
      };

      // Always resume directly — no forking. If resume fails, catch block
      // falls back to context injection. Fork was creating new sessions that
      // lost context when the fork itself failed.
      let promptText = content;
      if (systemContext) {
        promptText = `[Workspace Context]\n${systemContext}\n\n---\n\n${content}`;
      }
      if (sessionId) {
        options.resume = sessionId;
      }

      // Maps tool_use_id → { filePath, sourceCode } for app creation detection
      const pendingAppWrites = new Map();

      /** Scan assistant events for Write tool_use targeting app files. Keyed by block.id to prevent duplicates. */
      function detectAppWrites(event) {
        if (event.type === "assistant") {
          for (const block of (event.message?.content || [])) {
            if (block.type === "tool_use" && block.name === "Write" && !pendingAppWrites.has(block.id)) {
              const fp = block.input?.file_path || "";
              if (/apps\/[^/]+\/source\.tsx$/.test(fp)) {
                pendingAppWrites.set(block.id, { filePath: fp, sourceCode: block.input?.content || "", isOutput: false });
                log("INFO", "pending app write:", { id: block.id, path: fp });
              } else if (/morph-output\/[^/]+\.json$/.test(fp)) {
                pendingAppWrites.set(block.id, { filePath: fp, sourceCode: "", content: block.input?.content || "", isOutput: true });
                log("INFO", "pending morph-output write:", { id: block.id, path: fp });
              }
            }
          }
        }
        // Emit app_created or morph_output_written when Write tool_result confirms success
        if (event.type === "user") {
          for (const block of (event.message?.content || [])) {
            if (block.type === "tool_result" && !block.is_error) {
              const pending = pendingAppWrites.get(block.tool_use_id);
              if (pending) {
                pendingAppWrites.delete(block.tool_use_id);
                if (pending.isOutput) {
                  const appFile = pending.filePath.replace(/\\/g, "/").split("/").pop()?.replace(".json", "") || "";
                  sendOrBuffer({ type: "morph_output_written", appFile, path: pending.filePath, content: pending.content });
                  log("INFO", "emitted morph_output_written:", { appFile, path: pending.filePath });
                } else {
                  const appName = pending.filePath.replace(/\\/g, "/").split("/").slice(-2)[0];
                  sendOrBuffer({ type: "app_created", appName, path: pending.filePath, sourceCode: pending.sourceCode });
                  log("INFO", "emitted app_created:", { appName, path: pending.filePath });
                }
              }
            }
          }
        }
      }

      /** Forward transformed event to eventLog + frontend */
      function forwardEvent(event) {
        const transformed = transformEvent(event);
        if (transformed) {
          transformed.eventId = nextEventId++;
          const q = queries.get(qId);
          if (q) {
            q.eventLog.push(transformed);
            if (q.eventLog.length > EVENT_BUFFER_MAX) q.eventLog.shift();
          }
          if (qId === foregroundId) sendOrBuffer(transformed);
        }
      }

      resetWatchdog(qId);
      try {
        const queryIter = query({ prompt: promptText, options });
        if (queries.has(qId)) queries.get(qId).queryObj = queryIter;
        for await (const event of queryIter) {
          if (ac.signal.aborted) return;
          resetWatchdog(qId);
          const q = queries.get(qId);
          if (event.session_id) {
            if (q) q.sessionId = event.session_id;
            if (qId === foregroundId) connectionSessionId = event.session_id;
          }
          detectAppWrites(event);
          forwardEvent(event);
        }
      } catch (queryErr) {
        if (options.resume && queryErr?.message?.includes("exited with code")) {
          log("WARN", "Resume failed, injecting conversation context:", queryErr.message);
          delete options.resume;
          if (qId === foregroundId) connectionSessionId = null;
          const q = queries.get(qId);
          if (q) q.sessionId = null;
          const summary = await buildSessionContext(sessionId);
          if (summary) {
            promptText = summary + "\n\n---\n\nUser's new message:\n" + content;
          }
          const retryIter = query({ prompt: promptText, options });
          if (queries.has(qId)) queries.get(qId).queryObj = retryIter;
          for await (const event of retryIter) {
            if (ac.signal.aborted) return;
            resetWatchdog(qId);
            const q2 = queries.get(qId);
            if (event.session_id) {
              if (q2) q2.sessionId = event.session_id;
              if (qId === foregroundId) connectionSessionId = event.session_id;
            }
            detectAppWrites(event);
            forwardEvent(event);
          }
        } else {
          throw queryErr;
        }
      }

      // Warn about orphaned pending app writes (Write detected but tool_result never arrived)
      if (pendingAppWrites.size > 0) {
        for (const [id, p] of pendingAppWrites) {
          log("WARN", "Orphaned pending app write — tool_result never received:", { id, path: p.filePath });
        }
      }

      if (ac.signal.aborted) return;
      // Capture metadata from Map (may be deleted by concurrent killAll)
      // Fall back to the original request sessionId if Map entry is gone
      const q = queries.get(qId);
      const sid = q?.sessionId || sessionId || null;
      const wasDetached = q?.detached || false;
      if (qId === foregroundId) {
        log("INFO", "query done:", { queryId: qId, sessionId: sid, connectionSessionId });
        sendOrBuffer({ type: "done", sessionId: sid });
        foregroundId = null;
      } else if (wasDetached) {
        log("INFO", "background query completed:", { queryId: qId, sessionId: sid });
        sendOrBuffer({ type: "background_done", sessionId: sid });
      }
    } catch (err) {
      if (ac.signal.aborted) return;
      const q = queries.get(qId);
      const sid = q?.sessionId || sessionId || null;
      const wasDetached = q?.detached || false;
      if (err?.name === "AbortError") {
        if (qId === foregroundId) sendOrBuffer({ type: "done" });
        return;
      }
      log("ERROR", "query error:", err?.stack || err?.message || String(err));
      if (qId === foregroundId) {
        sendOrBuffer({ type: "error", message: err.message || String(err), sessionId: sid });
        // Don't send done after error — frontend error handler already finalizes.
        // Sending done would trigger auto-send of queued messages into a broken state.
        foregroundId = null;
      } else if (wasDetached) {
        sendOrBuffer({ type: "background_done", sessionId: sid, error: err.message });
      }
    } finally {
      const q = queries.get(qId);
      if (q?.watchdog) clearTimeout(q.watchdog);
      queries.delete(qId);
      // Clean up any leftover permission resolvers for this query — resolve to avoid hanging Promises
      for (const [id, entry] of permissionResolvers) {
        if (entry.queryId === qId) {
          permissionResolvers.delete(id);
          entry.resolve({ behavior: "deny", message: "Query ended" });
        }
      }
    }
  }

});

async function handleListSessions(msg) {
  try {
    const sessions = await listSessions({ limit: msg.limit || 50 });
    sendOrBuffer({ type: "sessions_list", sessions });
  } catch (err) {
    sendOrBuffer({ type: "error", message: `List sessions: ${err.message}` });
  }
}

async function handleGetSessionMessages(msg) {
  try {
    const messages = await getSessionMessages(msg.sessionId, { limit: 100 });
    // Track loaded session so next query uses direct resume (not fork)
    connectionSessionId = msg.sessionId;
    log("INFO", "Loaded session, set connectionSessionId:", msg.sessionId);
    sendOrBuffer({ type: "session_messages", sessionId: msg.sessionId, messages });
  } catch (err) {
    sendOrBuffer({ type: "error", message: `Get messages: ${err.message}` });
  }
}

const MAX_DIR_ENTRIES = 10_000;
async function handleListDir(msg) {
  try {
    const fs = await import("fs/promises");
    const entries = await fs.readdir(msg.path, { withFileTypes: true });
    const filtered = entries.filter(e => !e.name.startsWith("."));
    const truncated = filtered.length > MAX_DIR_ENTRIES;
    const items = filtered
      .slice(0, MAX_DIR_ENTRIES)
      .map(e => ({ name: e.name, isDir: e.isDirectory(), path: join(msg.path, e.name) }))
      .sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
    sendOrBuffer({ type: "dir_listing", path: msg.path, items, truncated, requestId: msg.requestId });
  } catch (err) {
    sendOrBuffer({ type: "dir_listing", path: msg.path, items: [], error: err.message, requestId: msg.requestId });
  }
}

/**
 * Build a condensed conversation transcript from session messages.
 * Strips thinking tokens, trims tool input/output, keeps text + tool summaries.
 */
async function buildSessionContext(sessionId) {
  try {
    const messages = await getSessionMessages(sessionId, { limit: 50 });
    if (!messages || messages.length === 0) return null;

    const lines = ["[Previous conversation transcript]", ""];
    for (const m of messages) {
      const role = m.type || m.role;
      const content = m.message?.content ?? m.content;
      if (!content) continue;

      if (role === "user") {
        const text = typeof content === "string" ? content
          : Array.isArray(content)
            ? content.filter(b => b.type === "text").map(b => b.text).join("")
            : "";
        // Skip tool_result-only messages
        if (!text && Array.isArray(content) && content.some(b => b.type === "tool_result")) continue;
        if (text) lines.push(`Human: ${text.slice(0, 2000)}`);
      } else if (role === "assistant") {
        const blocks = Array.isArray(content) ? content : [];
        const text = blocks.filter(b => b.type === "text").map(b => b.text).join("");
        const tools = blocks.filter(b => b.type === "tool_use")
          .map(b => `[Used ${b.name}${b.input?.file_path ? `: ${b.input.file_path}` : b.input?.command ? `: ${b.input.command.slice(0, 80)}` : ""}]`);
        // Skip thinking blocks entirely
        const parts = [];
        if (text) parts.push(text.slice(0, 3000));
        if (tools.length) parts.push(tools.join(", "));
        if (parts.length) lines.push(`Assistant: ${parts.join("\n")}`);
      }
      lines.push("");
    }

    const result = lines.join("\n").slice(0, 30000); // Cap at 30k chars
    log("INFO", `Built session context: ${result.length} chars from ${messages.length} messages`);
    return result;
  } catch (err) {
    log("WARN", "Failed to build session context:", err.message);
    return null;
  }
}

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
async function handleReadFile(msg) {
  try {
    const fs = await import("fs/promises");
    const stats = await fs.stat(msg.path);
    if (stats.size > MAX_FILE_SIZE) {
      sendOrBuffer({ type: "file_content", path: msg.path, content: `Error: File too large (${(stats.size / 1024 / 1024).toFixed(1)} MB, limit 100 MB)`, isError: true });
      return;
    }
    const content = await fs.readFile(msg.path, "utf-8");
    sendOrBuffer({ type: "file_content", path: msg.path, content });
  } catch (err) {
    sendOrBuffer({ type: "file_content", path: msg.path, content: `Error: ${err.message}`, isError: true });
  }
}

let shuttingDown = false;
function gracefulShutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  log("INFO", "Graceful shutdown initiated");
  // Abort all running queries
  for (const [qId, q] of queries) {
    if (q.ac) q.ac.abort();
    if (q.watchdog) clearTimeout(q.watchdog);
  }
  queries.clear();
  // Deny all pending permissions to unblock SDK Promises
  for (const [id, entry] of permissionResolvers) {
    entry.resolve({ behavior: "deny", message: "Bridge shutting down" });
  }
  permissionResolvers.clear();
  // Close WebSocket connections
  if (currentWs) {
    currentWs.close();
    currentWs = null;
  }
  wss.close(() => process.exit(0));
  // Force exit after 2s if graceful close stalls
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);
