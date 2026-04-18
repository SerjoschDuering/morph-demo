import React, { useState, useEffect, useCallback } from "react";
import { ShimmerSkeleton } from "./ShimmerSkeleton";
import { useWorkspaceStore } from "../stores/workspaceStore";
import type { AppTab as AppTabType } from "../stores/workspaceStore";

interface Props {
  tab: AppTabType;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: (e: Error) => void },
  { error: Error | null }
> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e }; }
  componentDidCatch(e: Error) { this.props.onError(e); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16, color: "#ef4444", fontFamily: "monospace", fontSize: 11 }}>
          <strong>Runtime error:</strong>
          <pre style={{ whiteSpace: "pre-wrap" }}>{String(this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function ErrorDisplay({ error }: { error?: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6" style={{ background: "var(--bg-panel)" }}>
      <div style={{ fontSize: 13, color: "#ef4444", fontWeight: 600 }}>Compilation failed</div>
      <pre
        className="text-[11px] max-w-lg overflow-auto p-3 rounded-lg"
        style={{ background: "var(--bg-active)", color: "var(--text-2)", fontFamily: "monospace" }}
      >
        {error ?? "Unknown error"}
      </pre>
    </div>
  );
}

export function AppTabContent({ tab }: Props) {
  const [Component, setComponent] = useState<React.ComponentType | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);
  const activeWorkspaceId = useWorkspaceStore(s => s.activeWorkspaceId);

  useEffect(() => {
    if (tab.status !== "ready" || !tab.compiledJs) return;
    setComponent(null);
    setEvalError(null);
    // Scope command handlers to this app (clear only THIS app's handlers)
    const safeName = tab.name.toLowerCase().replace(/\s+/g, "-");
    if ((window as any).Morph) {
      (window as any).Morph._currentAppName = safeName;
      (window as any).Morph._commandHandlers.delete(safeName);
    }
    try {
      // esbuild IIFE assigns to `var MorphApp` (local scope inside new Function).
      // Return it from the function body so we capture it without polluting window.
      // eslint-disable-next-line no-new-func
      const exported = new Function(`${tab.compiledJs}\n;return typeof MorphApp!=="undefined"?MorphApp:undefined;`)();
      const App = exported?.default ?? exported;
      if (typeof App !== "function") throw new Error(`No renderable component. Got: ${typeof exported}`);
      setComponent(() => App as React.ComponentType);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      setEvalError(errMsg);
      // Propagate to store so buildSystemContext can surface it to the AI
      const store = useWorkspaceStore.getState();
      store.updateApp(activeWorkspaceId, tab.id, { status: "error", error: errMsg });
    }
  }, [tab.compiledJs, tab.status]);

  // Per-app command listener — routes morph:app-command events to this app's handlers
  useEffect(() => {
    const safeName = tab.name.toLowerCase().replace(/\s+/g, "-");
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.appFile && detail.appFile !== safeName) return;
      const handlers = (window as any).Morph?._commandHandlers?.get(safeName) ?? [];
      handlers.forEach((h: any) => h(detail));
    };
    window.addEventListener("morph:app-command", handler);
    return () => window.removeEventListener("morph:app-command", handler);
  }, [tab.name]);

  const handleRuntimeError = useCallback((e: Error) => {
    useWorkspaceStore.getState().updateApp(activeWorkspaceId, tab.id, {
      status: "error", error: e.message,
    });
  }, [activeWorkspaceId, tab.id]);

  if (tab.status === "compiling") return <ShimmerSkeleton />;
  if (tab.status === "error") return <ErrorDisplay error={tab.error} />;
  if (evalError) return <ErrorDisplay error={evalError} />;
  if (!Component) return <ShimmerSkeleton />;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-auto">
      <AppErrorBoundary onError={handleRuntimeError}>
        <Component />
      </AppErrorBoundary>
    </div>
  );
}
