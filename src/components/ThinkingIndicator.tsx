import { useState } from "react";
import type { ToolActivity } from "../stores/chatStore";

interface Props {
  activities: ToolActivity[];
}

function formatElapsed(seconds?: number): string {
  if (!seconds || seconds < 1) return "";
  return seconds < 60
    ? `${Math.round(seconds)}s`
    : `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

const MAX_VISIBLE = 5;

export function ThinkingIndicator({ activities }: Props) {
  const [showAll, setShowAll] = useState(false);

  // Only show activities not already visible as tool cards in the message
  // (subagent progress, background tasks)
  const bgActivities = activities.filter((a) =>
    a.taskId || a.toolName.startsWith("Agent:")
  );

  if (bgActivities.length === 0) return null;

  const hidden = bgActivities.length - MAX_VISIBLE;
  const visible = showAll ? bgActivities : bgActivities.slice(-MAX_VISIBLE);

  return (
    <div className="px-4 py-1.5 space-y-0.5">
      {!showAll && hidden > 0 && (
        <button onClick={() => setShowAll(true)}
          className="flex items-center gap-1 text-[10px]"
          style={{ color: "var(--text-3)" }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
          {hidden} more
        </button>
      )}
      {visible.map((a, i) => (
        <div key={`${a.toolUseId}-${i}`} className="flex items-center gap-2 text-[11px] font-mono">
          {a.status === "done" ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--accent)"
              strokeWidth="2.5" className="shrink-0">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          ) : (
            <span className="flex gap-0.5 shrink-0 w-2.5 justify-center">
              {[0, 1, 2].map((j) => (
                <span key={j} className="w-0.5 h-0.5 rounded-full dot-pulse"
                  style={{ background: "var(--accent)", animationDelay: `${j * 200}ms` }} />
              ))}
            </span>
          )}
          <span className="truncate"
            style={{ color: a.status === "done" ? "var(--text-3)" : "var(--text-2)" }}>
            {a.toolName}
          </span>
          {a.summary && (
            <span className="truncate flex-1" style={{ color: "var(--text-3)" }}>
              {a.summary}
            </span>
          )}
          {a.elapsed && a.status !== "done" && (
            <span className="ml-auto tabular-nums shrink-0 opacity-60"
              style={{ color: "var(--text-3)" }}>
              {formatElapsed(a.elapsed)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
