/**
 * Session Visualizer — entry point.
 * Reads JSONL via Tauri, lazy-loads the 3D viz, handles loading/error/cleanup.
 */
import { Suspense, lazy, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { parseSession } from "./parser/jsonl-parser.ts";
import type { ParsedSession } from "./parser/types.ts";

const VizView = lazy(() => import("./VizView.tsx"));

interface Props {
  sessionId: string;
  sessionCwd: string;
  onClose: () => void;
}

export function SessionViz({ sessionId, sessionCwd, onClose }: Props) {
  const [session, setSession] = useState<ParsedSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSession(null);

    invoke<{ main: string; subagents: Record<string, string> }>(
      "read_session_jsonl",
      { sessionId, cwd: sessionCwd },
    )
      .then((data) => {
        if (cancelled) return;
        const hasSubs = Object.keys(data.subagents).length > 0;
        const parsed = parseSession(data.main, hasSubs ? data.subagents : undefined);
        if (parsed.events.length === 0) {
          setError("No tool events found in this session.");
        } else {
          setSession(parsed);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [sessionId, sessionCwd]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        <p className="text-[13px] text-[var(--text-3)]">Loading session data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-8">
        <p className="text-[13px] text-[#ef4444]">{error}</p>
        <button
          onClick={onClose}
          className="px-4 py-2 text-[13px] rounded-lg bg-[var(--bg-active)] text-[var(--text-2)] hover:text-[var(--text-1)] transition-colors"
        >
          Back to chat
        </button>
      </div>
    );
  }

  if (!session) return null;

  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center h-full gap-3">
          <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          <p className="text-[13px] text-[var(--text-3)]">Loading 3D visualizer...</p>
        </div>
      }
    >
      <VizView session={session} onClose={onClose} />
    </Suspense>
  );
}
