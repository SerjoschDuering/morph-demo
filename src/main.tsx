import React from "react";
import ReactDOM from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import App from "./App";
import "./styles/globals.css";

// Capture all console output to ~/morph-debug.log for terminal debugging
(function installConsoleCapture() {
  const levels = ["log", "debug", "info", "warn", "error"] as const;
  const buf: string[] = [];
  let flushing = false;

  function flush() {
    if (flushing || buf.length === 0) return;
    flushing = true;
    const lines = buf.splice(0, buf.length);
    invoke("append_debug_log", { line: lines.join("\n") }).finally(() => {
      flushing = false;
      if (buf.length > 0) setTimeout(flush, 0);
    });
  }

  levels.forEach((level) => {
    const orig = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      orig(...args);
      const msg = args.map((a) => {
        try { return typeof a === "object" ? JSON.stringify(a) : String(a); } catch { return String(a); }
      }).join(" ");
      const ts = new Date().toISOString().slice(11, 23);
      buf.push(`${ts} [${level.toUpperCase()}] ${msg}`);
      setTimeout(flush, 50);
    };
  });

  window.addEventListener("error", (e) => {
    buf.push(`${new Date().toISOString().slice(11, 23)} [ERROR] ${e.message}${e.filename ? " @ " + e.filename + ":" + e.lineno : ""}`);
    setTimeout(flush, 50);
  });
})();

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: "monospace", color: "#ff5f57", background: "#1a1a1a", minHeight: "100vh" }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Morph crashed on startup</div>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{String(this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// Expose React for esbuild-compiled app IIFEs (require polyfill)
(window as any).React = React;
(window as any).ReactDOM = ReactDOM;
(window as any).require = (m: string): unknown => {
  if (m === "react") return React;
  if (m === "react-dom" || m === "react-dom/client") return ReactDOM;
  if (m === "react/jsx-runtime") return React;
  return {};
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
