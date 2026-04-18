import { useRef, useEffect, useState, useCallback } from "react";
import { useChatStore } from "../stores/chatStore";
import { useWorkspaceStore, extractSummary } from "../stores/workspaceStore";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { ExtensionsStrip } from "./ExtensionsStrip";

function QueuedMessages() {
  const queue = useChatStore((s) => s.messageQueue);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const cancelledRef = useRef(false);

  const startEdit = useCallback((i: number) => {
    cancelledRef.current = false;
    setEditingIdx(i);
    setEditValue(queue[i]);
  }, [queue]);

  const saveEdit = useCallback(() => {
    if (cancelledRef.current) return;
    if (editingIdx !== null && editValue.trim()) {
      useChatStore.getState().editQueuedMessage(editingIdx, editValue.trim());
    }
    setEditingIdx(null);
  }, [editingIdx, editValue]);

  const cancelEdit = useCallback(() => {
    cancelledRef.current = true;
    setEditingIdx(null);
  }, []);

  return (
    <div className="mb-2 space-y-1.5">
      <div className="text-[11px] text-[var(--text-3)] px-1 flex items-center gap-1.5">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
        Queued ({queue.length})
        <button
          onClick={() => useChatStore.getState().clearMessageQueue()}
          className="ml-auto text-[var(--text-3)] hover:text-[#ef4444] transition-colors"
        >
          Clear all
        </button>
      </div>
      {queue.map((msg, i) => (
        <div
          key={i}
          className="flex items-start gap-2 px-3 py-2 rounded-xl bg-[var(--bg-sidebar)] border border-[var(--border-subtle)] text-[13px]"
        >
          <span className="text-[11px] text-[var(--text-3)] font-mono mt-0.5 shrink-0">
            {i + 1}
          </span>
          {editingIdx === i ? (
            <input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
              onBlur={saveEdit}
              className="flex-1 bg-transparent outline-none text-[var(--text-1)] text-[13px]"
            />
          ) : (
            <span
              className="flex-1 text-[var(--text-2)] cursor-pointer truncate"
              onClick={() => startEdit(i)}
              title="Click to edit"
            >
              {msg}
            </span>
          )}
          <button
            onClick={() => useChatStore.getState().removeQueuedMessage(i)}
            className="shrink-0 p-0.5 rounded text-[var(--text-3)] hover:text-[#ef4444] transition-colors"
            title="Remove"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

interface Props {
  onSendMessage: (msg: string) => void;
  onInterrupt: () => void;
  onPickFolder: () => void;
  cwd: string;
  workspaceName?: string;
}

export function ChatPanel({ onSendMessage, onInterrupt, onPickFolder, cwd, workspaceName }: Props) {
  const workspaces = useWorkspaceStore(s => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore(s => s.activeWorkspaceId);
  const appContexts = useWorkspaceStore(s => s.appContexts);
  const activeWs = workspaces.find(w => w.id === activeWorkspaceId);
  const appsWithContext = (activeWs?.apps ?? []).filter(a => appContexts[`${activeWorkspaceId}:${a.name}`]);

  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const isConnected = useChatStore((s) => s.isConnected);
  const lastCost = useChatStore((s) => s.lastCost);
  const activities = useChatStore((s) => s.activities);
  const injectedCommand = useChatStore((s) => s.injectedCommand);
  const currentSessionId = useChatStore((s) => s.currentSessionId);
  const messageQueue = useChatStore((s) => s.messageQueue);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastLen = useRef(0);
  const displayPath = cwd.replace(/^\/Users\/[^/]+/, "~");
  const [injectedCmd, setInjectedCmd] = useState("");

  // Pick up injected commands from store (e.g. from ExtensionsModal Invoke button)
  useEffect(() => {
    if (injectedCommand) {
      setInjectedCmd(injectedCommand);
      useChatStore.getState().setInjectedCommand("");
    }
  }, [injectedCommand]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current && messages.length > lastLen.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
    lastLen.current = messages.length;
  }, [messages.length]);

  // Scroll to bottom on session switch
  useEffect(() => {
    if (scrollRef.current && currentSessionId) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [currentSessionId]);

  // Streaming scroll is handled by StreamingContent's scrollIntoView

  const hasMessages = messages.length > 0;

  return (
    <main className="flex flex-col flex-1 min-h-0 relative">
      {/* Top bar */}
      <div
        data-tauri-drag-region
        className="flex items-center h-11 shrink-0 select-none border-b border-[var(--border-subtle)] px-3 gap-2"
      >
        {workspaceName && (
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)", letterSpacing: "-0.01em" }}>
            {workspaceName}
          </span>
        )}
        <button
          onClick={onPickFolder}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-[var(--text-3)] hover:text-[var(--text-2)] hover:bg-[var(--bg-active)] transition-colors"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-60">
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
          </svg>
          <span className="font-mono">{displayPath || "~/Desktop"}</span>
        </button>
        <div className="ml-auto flex items-center gap-2">
          <span style={{ fontSize: 11, color: "var(--text-3)" }}>claude-sonnet-4-6</span>
          <div
            className={isConnected && isStreaming ? "pulse-dot" : ""}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: isConnected ? "var(--green)" : "#ef4444",
            }}
          />
        </div>
      </div>

      {/* Messages / Empty state */}
      <div ref={scrollRef} role="log" aria-label="Conversation" aria-live="polite" className="flex-1 overflow-y-auto">
        {!hasMessages ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="text-center max-w-sm px-6">
              <div className="text-[42px] mb-3">
                ✦
              </div>
              <p className="text-[15px] text-[var(--text-2)] mb-1">
                Morph
              </p>
              <p className="text-[12px] text-[var(--text-3)]">
                The workspace that builds itself.
              </p>
            </div>
          </div>
        ) : (
          <div className="max-w-[740px] mx-auto px-5 py-4">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {/* ThinkingIndicator — shown at bottom during streaming */}
            {isStreaming && (
              <ThinkingIndicator activities={activities} />
            )}
            {/* Cost */}
            {lastCost !== null && !isStreaming && (
              <div className="text-center py-2 text-[11px] text-[var(--text-3)]">
                ${lastCost.toFixed(4)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="w-full px-5 pb-4">
        <div className="max-w-[740px] mx-auto">
          {/* App context pills — shown when apps have shared state */}
          {appsWithContext.length > 0 && (
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              <span style={{ fontSize: 10, color: "var(--text-3)" }}>Context:</span>
              {appsWithContext.map(app => {
                const ctx = appContexts[`${activeWorkspaceId}:${app.name}`];
                return (
                  <div
                    key={app.id}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full border"
                    style={{ fontSize: 10, background: "var(--bg-active)", borderColor: "var(--border-subtle)", color: "var(--text-3)" }}
                    title={`${app.name}: ${extractSummary(ctx)}`}
                  >
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--green)", flexShrink: 0 }} />
                    {app.name}
                    <span style={{ opacity: 0.6 }}>· {extractSummary(ctx)}</span>
                  </div>
                );
              })}
            </div>
          )}
          {/* Extensions strip above input */}
          <ExtensionsStrip onInjectCommand={(cmd) => setInjectedCmd(cmd)} />
          {/* Queued messages */}
          {messageQueue.length > 0 && (
            <QueuedMessages />
          )}
          <ChatInput
            onSend={onSendMessage}
            onInterrupt={onInterrupt}
            disabled={!isConnected}
            isStreaming={isStreaming}
            injectedValue={injectedCmd}
            onInjectedConsumed={() => setInjectedCmd("")}
          />
        </div>
      </div>
    </main>
  );
}
