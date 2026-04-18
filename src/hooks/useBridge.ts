import { useEffect, useRef, useCallback } from "react";
import { useChatStore } from "../stores/chatStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { compileAndStore } from "./useEsbuild";
import {
  createStreamingState,
  processAssistantEvent,
  processStreamEvent,
  processSystemEvent,
  processResultEvent,
  processDoneEvent,
  processErrorEvent,
  processPermissionRequest,
  flushToStore,
  resetStreamingState,
} from "../lib/event-processor";

let astCounter = 0;
const MAX_RECONNECT = 15;
const BASE_DELAY = 1000;
const MAX_DELAY = 30_000;
const PING_INTERVAL = 30_000;

/**
 * WebSocket connection to the Node.js bridge sidecar.
 * Patterns: exponential backoff, ping keepalive, message queue.
 */
export function useBridge() {
  const ws = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pingTimer = useRef<ReturnType<typeof setInterval>>(undefined);
  const messageQueue = useRef<string[]>([]);
  const rafId = useRef(0);
  const unmounted = useRef(false);
  const ss = useRef(createStreamingState());
  const lastSeenEventId = useRef<number>(-1);

  useEffect(() => {
    unmounted.current = false;
    connectToBridge();
    return () => {
      unmounted.current = true;
      reconnectAttempts.current = MAX_RECONNECT;
      ws.current?.close();
      ws.current = null;
      clearTimers();
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  function clearTimers() {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    if (pingTimer.current) clearInterval(pingTimer.current);
  }

  async function connectToBridge() {
    if (unmounted.current) return;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      let port: number;

      if (reconnectAttempts.current >= 3 && reconnectAttempts.current <= 5) {
        // Multiple reconnect failures — restart the bridge process
        try {
          port = await invoke<number>("restart_bridge");
        } catch {
          port = await invoke<number>("get_bridge_port");
        }
      } else {
        port = await invoke<number>("get_bridge_port");
      }

      if (port > 0) {
        connect(port);
      } else {
        // Bridge not started — schedule retries with existing backoff
        if (reconnectAttempts.current < MAX_RECONNECT) {
          useChatStore.getState().addSystemMessage("Bridge not started — retrying...");
          const delay = Math.min(BASE_DELAY * Math.pow(2, reconnectAttempts.current), MAX_DELAY);
          reconnectAttempts.current++;
          reconnectTimer.current = setTimeout(() => connectToBridge(), delay);
        } else {
          useChatStore.getState().addSystemMessage(
            "Bridge failed to start. Check that Node.js is installed and restart the app."
          );
        }
      }
    } catch {
      useChatStore.getState().addSystemMessage("Bridge not available — check that Node.js is installed");
    }
  }

  function connect(port: number) {
    if (unmounted.current) return;
    const socket = new WebSocket(`ws://127.0.0.1:${port}?lastSeenEventId=${lastSeenEventId.current}`);
    ws.current = socket;

    socket.onopen = () => {
      if (unmounted.current) return;
      const attemptsBeforeReset = reconnectAttempts.current;
      reconnectAttempts.current = 0;
      const s = useChatStore.getState();
      s.setConnected(true);
      // Only clear background sessions if bridge was restarted (reconnectAttempts 3-5 trigger restart_bridge).
      // Simple reconnects reuse the same sidecar — background queries are still running.
      if (attemptsBeforeReset >= 3) {
        lastSeenEventId.current = -1;
        if (s.backgroundSessions.length > 0) {
          for (const id of s.backgroundSessions) s.removeBackgroundSession(id);
        }
      }
      // Reset pending buffers before replaying — bridge will replay buffered events
      // and delta replays would double-append to existing pendingText
      ss.current.pendingText = "";
      ss.current.pendingThinking = "";
      ss.current.turnBaseOffset = 0;
      for (const msg of messageQueue.current) socket.send(msg);
      messageQueue.current = [];
      pingTimer.current = setInterval(() => {
        if (socket.readyState === 1) socket.send(JSON.stringify({ type: "ping" }));
      }, PING_INTERVAL);
      socket.send(JSON.stringify({ type: "list_sessions" }));
    };

    socket.onclose = () => {
      if (unmounted.current || ws.current !== socket) return; // Stale socket from StrictMode remount
      const s = useChatStore.getState();
      // Don't finalize streaming messages — bridge buffers events and replays on reconnect.
      // Only finalize if we've exhausted all reconnect attempts (bridge is truly dead).
      s.setConnected(false);
      clearTimers();
      if (reconnectAttempts.current < MAX_RECONNECT) {
        const delay = Math.min(BASE_DELAY * Math.pow(2, reconnectAttempts.current), MAX_DELAY);
        reconnectAttempts.current++;
        reconnectTimer.current = setTimeout(() => connectToBridge(), delay);
      } else {
        // All retries exhausted — bridge is dead. Unconditionally reset all state.
        flushStreamingRaf();
        s.finishAssistantMessage(ss.current.pendingText, ss.current.pendingThinking);
        s.clearPermissions();
        resetStreamingState(ss.current);
      }
    };

    socket.onerror = (e) => { console.error("[useBridge] WebSocket error:", e); };

    socket.onmessage = (event) => {
      if (unmounted.current) return;
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "pong") return;
        handleBridgeEvent(msg);
      } catch { /* ignore parse errors */ }
    };
  }

  function flushStreamingRaf() {
    if (rafId.current) {
      cancelAnimationFrame(rafId.current);
      rafId.current = 0;
    }
    // Always flush pending state — rAF may not have been scheduled yet
    flushToStore(useChatStore.getState(), ss.current);
    // Clear assistant ID so stale refs don't bleed into next message
    ss.current.currentAssistantId = null;
  }

  function handleBridgeEvent(msg: any) {
    // Ignore post-interrupt events until done/error clears the flag
    if (ss.current.interrupted && msg.type !== "done" && msg.type !== "error") return;
    // Track cursor only for events the frontend actually processed (not suppressed ones)
    if (typeof msg.eventId === "number") {
      lastSeenEventId.current = msg.eventId;
    }
    const store = useChatStore.getState();

    // Tag session→workspace as soon as we see a sessionId (before list_sessions refreshes sidebar)
    if (msg.sessionId && !store.sessionWorkspaceMap[msg.sessionId]) {
      store.tagSessionWorkspace(msg.sessionId, useWorkspaceStore.getState().activeWorkspaceId);
    }

    switch (msg.type) {
      case "morph_output_written": {
        // Claude wrote ~/morph-output/{appFile}.json — parse content and dispatch structured command
        let parsed: Record<string, unknown> = {};
        try { parsed = JSON.parse(msg.content || "{}"); } catch {}
        window.dispatchEvent(new CustomEvent("morph:app-command", {
          detail: {
            appFile: msg.appFile,
            command: parsed.command ?? "reload",
            path: msg.path,
            data: parsed.data ?? parsed,
          },
        }));
        break;
      }

      case "app_created":
      case "app_updated": {
        const wsId = useWorkspaceStore.getState().activeWorkspaceId;
        const { appName, sourceCode } = msg;
        const ws = useWorkspaceStore.getState().workspaces.find((w) => w.id === wsId);
        const existingApp = ws?.apps.find((a) => a.name === appName);
        if (existingApp) {
          useWorkspaceStore.getState().updateApp(wsId, existingApp.id, { sourceCode, status: "compiling" });
          compileAndStore(wsId, existingApp.id, sourceCode);
        } else {
          const appId = useWorkspaceStore.getState().addApp(wsId, appName, sourceCode);
          compileAndStore(wsId, appId, sourceCode);
          // Show config widget in chat only for newly created apps
          if (msg.type === "app_created") {
            useChatStore.getState().addWidgetMessage({
              type: "app-config",
              appName,
              appId,
            });
          }
        }
        break;
      }

      case "system":
        processSystemEvent(msg, store);
        break;

      case "extensions_scan":
        store.setExtensions({
          skills: msg.skills || [],
          plugins: msg.plugins || [],
          mcpServers: msg.mcpServers || [],
          tools: msg.tools || [],
          commands: msg.commands || [],
        });
        break;

      case "assistant":
        processAssistantEvent(msg, store, ss.current);
        break;

      case "stream": {
        const needsFlush = processStreamEvent(msg, store, ss.current);
        if (needsFlush && !rafId.current) {
          rafId.current = requestAnimationFrame(() => {
            rafId.current = 0;
            flushToStore(useChatStore.getState(), ss.current);
          });
        }
        break;
      }

      case "result":
        flushStreamingRaf();
        processResultEvent(msg, store, ss.current);
        break;

      case "done":
        ss.current.interrupted = false;
        flushStreamingRaf();
        processDoneEvent(msg, store, ss.current);
        {
          const finalSessionId = msg.sessionId ?? useChatStore.getState().currentSessionId;
          if (finalSessionId) {
            const activeWsId = useWorkspaceStore.getState().activeWorkspaceId;
            useChatStore.getState().tagSessionWorkspace(finalSessionId, activeWsId);
          }
        }
        rawSend({ type: "list_sessions" });
        if (!msg.stopRequested) {
          // Auto-send next queued message
          const next = store.dequeueMessage();
          if (next) {
            const s = useChatStore.getState();
            s.addUserMessage(next);
            s.clearPermissions();
            const placeholderId = `ast-${Date.now()}-${++astCounter}`;
            ss.current.currentAssistantId = placeholderId;
            ss.current.pendingText = "";
            ss.current.pendingThinking = "";
            ss.current.turnBaseOffset = 0;
            ss.current.hasReceivedResponse = false;
            s.startAssistantMessage(placeholderId);
            const sCwd = s.currentSessionId
              ? s.sessions.find((x) => x.id === s.currentSessionId)?.cwd
              : undefined;
            const activeWsId2 = useWorkspaceStore.getState().activeWorkspaceId;
            const ws2 = useWorkspaceStore.getState().workspaces.find(w => w.id === activeWsId2);
            rawSend({
              type: "send_message", content: next,
              cwd: sCwd || s.cwd, sessionId: s.currentSessionId,
              model: s.selectedModel || undefined,
              systemContext: ws2?.systemContext,
            });
          }
        } else {
          store.clearMessageQueue();
        }
        break;

      case "error":
        ss.current.interrupted = false;
        flushStreamingRaf();
        processErrorEvent(msg, store, ss.current);
        break;

      case "permission_request":
        processPermissionRequest(msg, store);
        break;

      case "tool_progress":
        store.addActivity({
          toolUseId: msg.toolUseId, toolName: msg.toolName,
          status: "running", elapsed: msg.elapsed, taskId: msg.taskId,
        });
        store.updateToolStatus(msg.toolUseId, "running", msg.elapsed);
        break;

      case "tool_use_summary":
        if (msg.precedingToolUseIds) {
          for (const id of msg.precedingToolUseIds) {
            store.updateToolStatus(id, "done");
            store.updateActivity(id, { status: "done", summary: msg.summary });
          }
        }
        break;

      case "user": {
        // Tool results come as user messages with tool_result content blocks
        const content = msg.message?.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "tool_result" && block.tool_use_id) {
              const resultText = typeof block.content === "string"
                ? block.content
                : Array.isArray(block.content)
                  ? block.content.map((c: any) => c.text || "").join("")
                  : "";
              store.updateToolResult(
                block.tool_use_id,
                resultText.slice(0, 2000),
                !!block.is_error
              );
            }
          }
        }
        break;
      }

      case "sessions_list":
        if (msg.sessions) {
          const currentCwd = store.cwd;
          store.setSessions(
            msg.sessions.map((s: any) => ({
              id: s.sessionId || s.id || s.session_id,
              title: truncate(s.summary || s.firstPrompt || s.name || s.title || "", 60),
              createdAt: s.lastModified || s.created_at || Date.now(),
              lastUsedAt: s.lastModified || s.last_active_at || Date.now(),
              cwd: s.cwd || "",
              isOwnSession: !!(s.cwd && currentCwd && s.cwd === currentCwd),
            }))
          );
        }
        break;

      case "file_content":
        store.setFilePreview({
          path: msg.path, content: msg.content, isError: msg.isError,
        });
        break;

      case "dir_listing":
        store.setDirListing(msg.path, msg.items || []);
        break;

      case "rate_limit_event": {
        const info = msg.rateLimitInfo;
        if (info?.resetsAt) {
          const resetTime = new Date(info.resetsAt).toLocaleTimeString();
          store.addSystemMessage(`Rate limited \u2014 resets at ${resetTime}`);
        } else {
          store.addSystemMessage("Rate limited \u2014 retrying...");
        }
        break;
      }

      case "background_done":
        // A detached query finished in the background — remove from tracking
        if (msg.sessionId) {
          store.removeBackgroundSession(msg.sessionId);
        }
        // Surface background errors to user
        if (msg.error) {
          store.addSystemMessage(`Background query failed: ${msg.error}`);
        }
        // Refresh session list so sidebar shows updated state
        rawSend({ type: "list_sessions" });
        break;

      case "re_attach_status":
        // Guard: ignore if user already navigated away (rapid switching)
        if (msg.sessionId && msg.sessionId !== store.currentSessionId) break;
        if (msg.userPrompt) {
          store.addUserMessage(msg.userPrompt);
        }
        break;

      case "session_messages":
        // Guard: ignore responses for sessions we've navigated away from (rapid switching)
        if (msg.sessionId && msg.sessionId !== store.currentSessionId) break;
        if (msg.messages) {
          store.clearMessages();
          for (const m of msg.messages) {
            // SDK SessionMessage: { type, uuid, message: { role, content }, ... }
            const role = m.type || m.role;
            const content = m.message?.content ?? m.content;
            const id = m.uuid || m.id || `restored-${Date.now()}-${Math.random()}`;
            const blocks = Array.isArray(content) ? content : [];

            if (role === "user") {
              // Skip tool_result-only messages (intermediate tool responses)
              const hasToolResult = blocks.some((c: any) => c.type === "tool_result");
              const textContent = typeof content === "string" ? content
                : blocks.filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
              if (hasToolResult && !textContent) continue;
              store.addUserMessage(textContent || (typeof content === "string" ? content : ""));
            } else if (role === "assistant") {
              const text = typeof content === "string" ? content
                : blocks.filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
              const thinking = blocks.filter((c: any) => c.type === "thinking").map((c: any) => c.thinking).join("");
              const toolUses = blocks.filter((c: any) => c.type === "tool_use");

              store.startAssistantMessage(id);
              if (text) store.setAssistantContent(text);
              if (thinking) store.setAssistantThinking(thinking);
              for (const tu of toolUses) {
                store.addToolUse({ id: tu.id, name: tu.name, input: tu.input || {} });
                store.updateToolStatus(tu.id, "done");
              }
              store.finishAssistantMessage(text || undefined, thinking || undefined);
            }
          }
        }
        break;
    }
  }

  const rawSend = useCallback((data: Record<string, unknown>) => {
    const serialized = JSON.stringify(data);
    if (ws.current?.readyState === 1) {
      ws.current.send(serialized);
    } else {
      messageQueue.current.push(serialized);
    }
  }, []);

  const sendMessage = useCallback((content: string) => {
    if (!content.trim()) return;
    const store = useChatStore.getState();

    // Finalize any in-flight streaming message before creating a new placeholder.
    // This prevents orphaned streaming messages with stuck thinking dots.
    // Must happen on frontend (not via bridge done event) to avoid racing with the new placeholder.
    if (store.isStreaming) {
      flushStreamingRaf();
      store.markAllToolsDone();
      store.finishAssistantMessage(ss.current.pendingText, ss.current.pendingThinking);
    }

    store.addUserMessage(content);

    // Clear stale permissions from previous query (bridge kill() already denied them)
    store.clearPermissions();
    // Clear interrupted flag — new query supersedes any prior interrupt
    ss.current.interrupted = false;

    // Immediately show thinking dots — don't wait for first stream event
    const placeholderId = `ast-${Date.now()}-${++astCounter}`;
    ss.current.currentAssistantId = placeholderId;
    ss.current.pendingText = "";
    ss.current.pendingThinking = "";
    ss.current.turnBaseOffset = 0;
    ss.current.hasReceivedResponse = false;
    store.startAssistantMessage(placeholderId);

    // Use the session's original cwd when resuming/forking (critical for SDK lookup)
    const sessionId = store.currentSessionId;
    const sessionCwd = sessionId
      ? store.sessions.find((s) => s.id === sessionId)?.cwd
      : undefined;

    const activeWsId = useWorkspaceStore.getState().activeWorkspaceId;
    const ws = useWorkspaceStore.getState().workspaces.find(w => w.id === activeWsId);
    rawSend({
      type: "send_message", content,
      cwd: sessionCwd || store.cwd, sessionId,
      model: store.selectedModel || undefined,
      systemContext: ws?.systemContext,
    });
  }, [rawSend]);

  const respondPermission = useCallback((id: string, allow: boolean, updatedPermissions?: unknown[]) => {
    useChatStore.getState().removePermission(id);
    rawSend({ type: "permission_response", id, allow, updatedPermissions });
  }, [rawSend]);

  const interruptQuery = useCallback(() => {
    ss.current.interrupted = true; // ignore late events
    rawSend({ type: "interrupt" });
    if (!ss.current.hasReceivedResponse) {
      // No SDK response yet — bridge may have no foreground query to kill.
      // Finalize placeholder locally to unblock the UI.
      flushStreamingRaf();
      const s = useChatStore.getState();
      s.finishAssistantMessage(ss.current.pendingText, ss.current.pendingThinking);
      s.clearPermissions();
      resetStreamingState(ss.current);
    }
  }, [rawSend]);

  const loadSession = useCallback((sessionId: string) => {
    const store = useChatStore.getState();
    // Don't reload the session we're already viewing
    if (sessionId === store.currentSessionId) return;
    if (store.isStreaming) {
      // Detach the running query — let it finish in the background
      rawSend({ type: "detach" });
      if (store.currentSessionId) {
        store.addBackgroundSession(store.currentSessionId);
      }
    }
    // Always reset streaming refs — stale IDs cause ghost state
    resetStreamingState(ss.current);
    ss.current.interrupted = false; // new session supersedes any prior interrupt
    if (rafId.current) { cancelAnimationFrame(rafId.current); rafId.current = 0; }
    store.clearMessages();
    store.clearPermissions();
    store.clearMessageQueue();
    store.setCurrentSessionId(sessionId);
    if (store.backgroundSessions.includes(sessionId)) {
      store.removeBackgroundSession(sessionId);
      // Pass -1 (full replay) — global cursor is not per-session and could skip
      // session-specific events that were never seen if a background query advanced it.
      rawSend({ type: "re_attach", sessionId, lastSeenEventId: -1 });
    } else {
      rawSend({ type: "get_session_messages", sessionId });
    }
  }, [rawSend]);

  const refreshSessions = useCallback(() => {
    rawSend({ type: "list_sessions" });
  }, [rawSend]);

  const readFile = useCallback((path: string) => {
    rawSend({ type: "read_file", path });
  }, [rawSend]);

  const listDir = useCallback((path: string) => {
    rawSend({ type: "list_dir", path });
  }, [rawSend]);

  const newChat = useCallback(() => {
    const store = useChatStore.getState();
    if (store.isStreaming) {
      // Detach the running query — let it finish in the background
      rawSend({ type: "detach" });
      if (store.currentSessionId) {
        store.addBackgroundSession(store.currentSessionId);
      }
    }
    // Always reset streaming refs — stale IDs cause ghost state
    resetStreamingState(ss.current);
    ss.current.interrupted = false; // new chat supersedes any prior interrupt
    if (rafId.current) { cancelAnimationFrame(rafId.current); rafId.current = 0; }
    store.clearMessages();
    store.clearPermissions();
    store.clearMessageQueue();
    store.setCurrentSessionId(null);
  }, [rawSend]);

  return { sendMessage, respondPermission, interruptQuery, loadSession, refreshSessions, newChat, readFile, listDir };
}

function truncate(s: string, max: number): string {
  if (!s) return "Untitled";
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max) + "..." : clean;
}
