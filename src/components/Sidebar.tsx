import { useState } from "react";
import { useChatStore, type SessionInfo } from "../stores/chatStore";

interface Props {
  isOpen: boolean;
  onToggle: () => void;
  onLoadSession: (id: string) => void;
  onNewChat: () => void;
  onRefresh: () => void;
}

export function Sidebar({ isOpen, onToggle, onLoadSession, onNewChat, onRefresh }: Props) {
  const sessions = useChatStore((s) => s.sessions);
  const currentSessionId = useChatStore((s) => s.currentSessionId);
  const backgroundSessions = useChatStore((s) => s.backgroundSessions);
  const [showOther, setShowOther] = useState(false);

  // Split: sessions matching current cwd vs other projects
  const ownSessions = sessions.filter((s) => s.isOwnSession);
  const otherSessions = sessions.filter((s) => !s.isOwnSession);
  const ownGrouped = groupByDate(ownSessions);
  const otherGrouped = groupByDate(otherSessions);

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed top-3 left-3 z-30 p-2 rounded-lg hover:bg-[var(--bg-active)] transition-colors text-[var(--text-3)] hover:text-[var(--text-2)]"
        title="Open sidebar"
        aria-label="Open sidebar"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    );
  }

  return (
    <nav aria-label="Session sidebar" className="w-[260px] shrink-0 flex flex-col h-full bg-[var(--bg-sidebar)]">
      {/* Top actions */}
      <div className="flex items-center justify-between p-3 pb-2">
        <button
          onClick={onToggle}
          aria-label="Close sidebar"
          className="p-1.5 -ml-1 rounded-lg hover:bg-[var(--bg-active)] transition-colors text-[var(--text-3)] hover:text-[var(--text-2)]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <button
          onClick={onNewChat}
          className="p-1.5 rounded-lg hover:bg-[var(--bg-active)] transition-colors text-[var(--text-3)] hover:text-[var(--text-2)]"
          title="New chat"
          aria-label="New chat"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {sessions.length === 0 ? (
          <p className="text-[13px] text-[var(--text-3)] text-center mt-12 px-6 leading-relaxed">
            No conversations yet.<br />Start one below.
          </p>
        ) : (
          <>
            {/* This project's sessions */}
            {ownGrouped.length > 0 && (
              <SessionList
                groups={ownGrouped}
                currentSessionId={currentSessionId}
                backgroundSessions={backgroundSessions}
                onLoadSession={onLoadSession}
              />
            )}

            {/* Other projects — collapsible */}
            {otherSessions.length > 0 && (
              <div className="mt-2">
                <button
                  onClick={() => setShowOther(!showOther)}
                  className="flex items-center gap-1.5 w-full px-3 py-2 text-[11px] font-medium text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors"
                >
                  <svg
                    width="8" height="8" viewBox="0 0 8 8" fill="currentColor"
                    className={`transition-transform ${showOther ? "rotate-90" : ""}`}
                  >
                    <polygon points="1,0 7,4 1,8" />
                  </svg>
                  Other projects
                  <span className="ml-auto text-[10px] opacity-60">{otherSessions.length}</span>
                </button>
                {showOther && (
                  <SessionList
                    groups={otherGrouped}
                    currentSessionId={currentSessionId}
                    backgroundSessions={backgroundSessions}
                    onLoadSession={onLoadSession}
                    dimmed
                  />
                )}
              </div>
            )}

            {/* All sessions are from other projects */}
            {ownSessions.length === 0 && !showOther && (
              <p className="text-[12px] text-[var(--text-3)] text-center mt-8 px-4 leading-relaxed">
                No sessions for this project yet.
              </p>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[var(--border-subtle)]">
        <button
          onClick={onRefresh}
          className="text-[11px] text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors"
        >
          Refresh sessions
        </button>
      </div>
    </nav>
  );
}

function SessionList({
  groups,
  currentSessionId,
  backgroundSessions,
  onLoadSession,
  dimmed,
}: {
  groups: [string, SessionInfo[]][];
  currentSessionId: string | null;
  backgroundSessions: string[];
  onLoadSession: (id: string) => void;
  dimmed?: boolean;
}) {
  return (
    <>
      {groups.map(([label, items]) => (
        <div key={label} className="mb-1">
          <div className="text-[11px] font-medium text-[var(--text-3)] px-3 pt-4 pb-1.5">
            {label}
          </div>
          {items.map((session) => {
            const isActive = session.id === currentSessionId;
            const isBackground = backgroundSessions.includes(session.id);
            return (
              <div key={session.id} className="group relative flex items-center">
                <button
                  onClick={() => onLoadSession(session.id)}
                  data-testid={`sidebar__session--${session.id}`}
                  className={`w-full text-left px-3 py-2 rounded-lg text-[13px] transition-colors truncate flex items-center gap-2 ${
                    isActive
                      ? "bg-[var(--bg-active)] text-[var(--text-1)]"
                      : dimmed
                        ? "text-[var(--text-3)] hover:bg-[var(--bg-active)] hover:text-[var(--text-2)]"
                        : "text-[var(--text-2)] hover:bg-[var(--bg-active)] hover:text-[var(--text-1)]"
                  }`}
                >
                  {isBackground && (
                    <span className="shrink-0 w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" title="Running in background" />
                  )}
                  {dimmed && !isBackground && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 opacity-40">
                      <polyline points="4 17 10 11 4 5" />
                      <line x1="12" y1="19" x2="20" y2="19" />
                    </svg>
                  )}
                  <span className="truncate">{formatSessionTitle(session)}</span>
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}

function formatSessionTitle(s: SessionInfo): string {
  if (s.title && s.title !== "Untitled") return s.title;
  const d = new Date(s.lastUsedAt || s.createdAt);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function groupByDate(sessions: SessionInfo[]): [string, SessionInfo[]][] {
  const now = Date.now();
  const day = 86400000;
  const groups: Record<string, SessionInfo[]> = {};
  for (const s of sessions) {
    const age = now - (s.lastUsedAt || s.createdAt);
    let label: string;
    if (age < day) label = "Today";
    else if (age < 2 * day) label = "Yesterday";
    else if (age < 7 * day) label = "Previous 7 Days";
    else label = "Older";
    (groups[label] ??= []).push(s);
  }
  const order = ["Today", "Yesterday", "Previous 7 Days", "Older"];
  return order.filter((k) => groups[k]).map((k) => [k, groups[k]]);
}
