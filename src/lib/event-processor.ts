/** Pure event processing logic extracted from useBridge.
 *  Holds mutable streaming state (replaces React refs).
 *  The useBridge hook creates one instance and delegates to it. */

import { useChatStore } from "../stores/chatStore";

export interface StreamingState {
  currentAssistantId: string | null;
  pendingText: string;
  pendingThinking: string;
  turnBaseOffset: number;
  hasReceivedResponse: boolean;
  astCounter: number;
  interrupted: boolean;
}

export function createStreamingState(): StreamingState {
  return {
    currentAssistantId: null,
    pendingText: "",
    pendingThinking: "",
    turnBaseOffset: 0,
    hasReceivedResponse: false,
    astCounter: 0,
    interrupted: false,
  };
}

type Store = ReturnType<typeof useChatStore.getState>;

export function processAssistantEvent(msg: any, store: Store, state: StreamingState) {
  state.hasReceivedResponse = true;
  const content = msg.message?.content;
  if (!content) return;

  const textParts = content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  const thinkParts = content.filter((b: any) => b.type === "thinking").map((b: any) => b.thinking).join("");
  const toolParts = content.filter((b: any) => b.type === "tool_use");

  store.markAllToolsDone();

  if (!state.currentAssistantId) {
    state.currentAssistantId = msg.message?.id || `ast-${Date.now()}-${++state.astCounter}`;
    state.pendingText = "";
    state.pendingThinking = "";
    state.turnBaseOffset = 0;
    store.startAssistantMessage(state.currentAssistantId!);
  }

  if (textParts) {
    state.pendingText = state.pendingText.slice(0, state.turnBaseOffset) + textParts;
    store.setStreamingContent(state.pendingText);
  }
  if (thinkParts) {
    // Use assignment (not +=): the assistant event is authoritative and contains the full
    // thinking text. Appending would double-count if thinking deltas were already streamed
    // (e.g. after a reconnect replay).
    state.pendingThinking = thinkParts;
    store.setStreamingThinking(state.pendingThinking);
  }
  for (const tu of toolParts) {
    store.addToolUse({ id: tu.id, name: tu.name, input: tu.input || {} });
  }
}

export function processStreamEvent(msg: any, store: Store, state: StreamingState): boolean {
  const evt = msg.event;
  if (!evt) return false;

  let needsFlush = false;

  if (evt.type === "message_start") {
    state.hasReceivedResponse = true;
    store.markAllToolsDone();

    if (!state.currentAssistantId) {
      state.currentAssistantId = evt.message?.id || `ast-${Date.now()}-${++state.astCounter}`;
      state.pendingText = "";
      state.pendingThinking = "";
      state.turnBaseOffset = 0;
      store.startAssistantMessage(state.currentAssistantId!);
    } else {
      // Subsequent turn — mark where previous text ends
      state.turnBaseOffset = state.pendingText.length;
    }
  } else if (evt.type === "content_block_start") {
    if (evt.content_block?.type === "tool_use") {
      store.addToolUse({ id: evt.content_block.id, name: evt.content_block.name, input: {} });
      store.addActivity({ toolUseId: evt.content_block.id, toolName: evt.content_block.name, status: "running" });
    }
  } else if (evt.type === "content_block_delta") {
    if (evt.delta?.type === "text_delta" && evt.delta.text) {
      state.pendingText += evt.delta.text;
      needsFlush = true;
    } else if (evt.delta?.type === "thinking_delta" && evt.delta.thinking) {
      state.pendingThinking += evt.delta.thinking;
      needsFlush = true;
    }
    // input_json_delta intentionally ignored for now
  }

  return needsFlush;
}

export function processSystemEvent(msg: any, store: Store) {
  if (msg.subtype === "init") {
    // Guard: don't let a stale init event overwrite the current session ID
    if (msg.sessionId && (!store.currentSessionId || store.currentSessionId === msg.sessionId)) {
      store.setCurrentSessionId(msg.sessionId);
    }
    if (msg.slashCommands) store.setAvailableCommands(msg.slashCommands);
    store.setExtensions({
      tools: msg.tools || [],
      commands: msg.slashCommands || [],
    });
  } else if (msg.subtype === "task_started") {
    store.addActivity({
      toolUseId: msg.toolUseId || msg.taskId,
      toolName: `Agent: ${(msg.description || "subagent").slice(0, 30)}`,
      status: "running",
      taskId: msg.taskId,
    });
  } else if (msg.subtype === "task_progress") {
    store.updateActivity(msg.toolUseId || msg.taskId, {
      summary: msg.summary || msg.description,
      elapsed: msg.usage?.duration_ms ? msg.usage.duration_ms / 1000 : undefined,
    });
  } else if (msg.subtype === "compact_boundary") {
    store.addSystemMessage("Context compacted \u2014 earlier messages summarized");
  } else if (msg.subtype === "status" && msg.status === "compacting") {
    store.addSystemMessage("Compacting context...");
  } else if (msg.subtype === "task_notification") {
    store.updateActivity(msg.toolUseId || msg.taskId, {
      status: "done",
      summary: msg.summary,
    });
    if (msg.toolUseId) {
      store.updateToolStatus(msg.toolUseId,
        msg.status === "completed" ? "done" : "error");
    }
  }
}

/** Flush pending streaming state to store (replaces rAF in tests) */
export function flushToStore(store: Store, state: StreamingState) {
  store.setStreamingState(state.pendingText, state.pendingThinking);
}

/** Reset streaming state after a turn completes.
 *  Does NOT clear `interrupted` — that flag is managed by handleBridgeEvent
 *  (done/error clear it) and by sendMessage/loadSession/newChat. */
export function resetStreamingState(state: StreamingState) {
  state.currentAssistantId = null;
  state.pendingText = "";
  state.pendingThinking = "";
  state.turnBaseOffset = 0;
}

/** Process a result event */
export function processResultEvent(msg: any, store: Store, state: StreamingState) {
  flushToStore(store, state);
  store.markAllToolsDone();
  store.finishAssistantMessage(state.pendingText, state.pendingThinking);
  resetStreamingState(state);
  if (msg.sessionId && (!store.currentSessionId || store.currentSessionId === msg.sessionId)) {
    store.setCurrentSessionId(msg.sessionId);
  }
  if (msg.costUsd) store.setLastCost(msg.costUsd);
}

/** Process a done event */
export function processDoneEvent(msg: any, store: Store, state: StreamingState) {
  flushToStore(store, state);
  store.markAllToolsDone();
  store.finishAssistantMessage(state.pendingText, state.pendingThinking);
  store.clearPermissions();
  resetStreamingState(state);
  if (msg.sessionId && (!store.currentSessionId || store.currentSessionId === msg.sessionId)) {
    store.setCurrentSessionId(msg.sessionId);
  }
}

/** Process an error event — two branches: "exited with code" vs normal */
export function processErrorEvent(msg: any, store: Store, state: StreamingState) {
  flushToStore(store, state);
  store.finishAssistantMessage(state.pendingText, state.pendingThinking);
  store.clearPermissions();
  store.clearMessageQueue();
  const errMsg = msg.message || "Unknown error";
  if (errMsg.includes("exited with code")) {
    store.setCurrentSessionId(null);
    store.addSystemMessage("Session expired \u2014 starting fresh. Send your message again.");
  } else {
    store.addSystemMessage(errMsg);
    if (msg.sessionId) store.setCurrentSessionId(msg.sessionId);
  }
  resetStreamingState(state);
}

/** Process a permission request with dedup guard */
export function processPermissionRequest(msg: any, store: Store) {
  if (store.permissionQueue.some((p: any) => p.id === msg.id)) return;
  store.addPermission({
    id: msg.id, tool: msg.tool, description: msg.description,
    input: msg.input, suggestions: msg.suggestions,
  });
}
