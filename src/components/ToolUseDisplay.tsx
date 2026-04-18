import { useState, useEffect } from "react";
import type { ToolUse } from "../stores/chatStore";

const INLINE_TOOLS = new Set(["Read", "Glob", "Grep", "Write", "Edit"]);

/** Returns true if a tool should render as a compact single-line */
export function isInlineTool(t: ToolUse): boolean {
  const status = t.status || (t.result !== undefined ? (t.isError ? "error" : "done") : "running");
  return INLINE_TOOLS.has(t.name) && status === "done" && !t.isError;
}

interface Props {
  toolUse: ToolUse;
}

export function ToolUseDisplay({ toolUse }: Props) {
  if (isInlineTool(toolUse)) return <InlineToolUse toolUse={toolUse} />;
  return <CardToolUse toolUse={toolUse} />;
}

/** Compact single-line display for completed Read/Glob/Grep/Write/Edit */
function InlineToolUse({ toolUse }: Props) {
  const summary = getSummary(toolUse);
  return (
    <div className="flex items-center gap-1.5 font-mono text-[11px] py-0.5 px-1" style={{ color: "var(--text-3)" }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" className="shrink-0">
        <path d="M20 6L9 17l-5-5" />
      </svg>
      <span className="shrink-0" style={{ color: "var(--text-2)" }}>{toolUse.name}</span>
      <span className="truncate">{summary}</span>
    </div>
  );
}

/** Full card display for Bash/Agent/errors/running tools */
function CardToolUse({ toolUse }: Props) {
  const [open, setOpen] = useState(false);
  const summary = getSummary(toolUse);
  const status = toolUse.status || (toolUse.result !== undefined ? (toolUse.isError ? "error" : "done") : "running");
  const isDone = status === "done" || status === "error";
  const isError = status === "error";

  useEffect(() => {
    if (status === "done") setOpen(false);
    if (status === "error") setOpen(true);
  }, [status]);

  const elapsed = toolUse.elapsed;
  const elapsedStr = elapsed
    ? elapsed < 60 ? `${Math.round(elapsed)}s` : `${Math.floor(elapsed / 60)}m ${Math.round(elapsed % 60)}s`
    : "";

  return (
    <div className="rounded-lg overflow-hidden my-0.5"
      style={{ border: "1px solid var(--border)", background: "var(--bg-active)" }}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-[12px]"
        style={{ background: "transparent" }}
        onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.25)")}
        onMouseLeave={(e) => (e.currentTarget.style.filter = "")}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className="shrink-0 transition-transform" style={{
            color: "var(--text-3)",
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
          }}>
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span className="shrink-0 font-medium" style={{ color: "var(--text-1)" }}>{toolUse.name}</span>
        <span className="truncate flex-1 font-mono text-[11px]" style={{ color: "var(--text-3)" }}>
          {summary}
        </span>
        {elapsedStr && !isDone && (
          <span className="text-[10px] tabular-nums shrink-0" style={{ color: "var(--text-3)" }}>
            {elapsedStr}
          </span>
        )}
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0"
          style={{
            background: isError ? "rgba(239,68,68,0.08)" : "var(--accent-soft)",
            color: isError ? "#ef4444" : "var(--accent)",
          }}>
          {!isDone && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              className="animate-spin">
              <path d="M21 12a9 9 0 11-6.219-8.56" />
            </svg>
          )}
          {isDone && !isError && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          )}
          {isError ? "Error" : isDone ? "Done" : "Running"}
        </span>
      </button>

      {open && (
        <div className="px-3 pb-2 text-[12px] space-y-1.5" style={{ borderTop: "1px solid var(--border)" }}>
          {toolUse.input && Object.keys(toolUse.input).length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider mt-1.5 mb-0.5" style={{ color: "var(--text-3)" }}>Input</div>
              <pre className="p-2 rounded overflow-x-auto font-mono text-[11px] max-h-32 overflow-y-auto"
                style={{ background: "rgba(0,0,0,0.2)", color: "var(--text-2)" }}>
                {formatInput(toolUse)}
              </pre>
            </div>
          )}
          {toolUse.result && (
            <div>
              <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "var(--text-3)" }}>Result</div>
              <pre className="p-2 rounded overflow-x-auto font-mono text-[11px] max-h-48 overflow-y-auto whitespace-pre-wrap break-words"
                style={{ background: "rgba(0,0,0,0.2)", color: isError ? "#ef4444" : "var(--text-2)" }}>
                {toolUse.result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatInput(t: ToolUse): string {
  const i = t.input;
  switch (t.name) {
    case "Bash": return (i.command as string) || JSON.stringify(i, null, 2);
    case "Read": return (i.file_path as string) || JSON.stringify(i, null, 2);
    case "Write": case "Edit":
      return `${i.file_path || ""}${i.old_string ? `\n--- old ---\n${i.old_string}\n--- new ---\n${i.new_string}` : ""}`;
    case "Glob": case "Grep": return (i.pattern as string) || JSON.stringify(i, null, 2);
    case "Agent": return (i.prompt as string)?.slice(0, 200) || JSON.stringify(i, null, 2);
    default: return JSON.stringify(i, null, 2);
  }
}

function getSummary(t: ToolUse): string {
  const i = t.input;
  if (!i || Object.keys(i).length === 0) return "";
  switch (t.name) {
    case "Bash": return (i.command as string) || "";
    case "Read": case "Write": case "Edit":
      return ((i.file_path as string) || "").split("/").slice(-2).join("/");
    case "Glob": case "Grep": return (i.pattern as string) || "";
    case "Agent": return (i.description as string) || "";
    default: {
      const s = JSON.stringify(i);
      return s === "{}" ? "" : s.slice(0, 60);
    }
  }
}
