import { useState, useRef, useCallback, useEffect } from "react";
import { useChatStore } from "../stores/chatStore";

type ModelEntry = { id: string; label: string; provider: string; badge?: string; eu?: boolean; local?: boolean };
const MODEL_GROUPS: { label: string; models: ModelEntry[] }[] = [
  {
    label: "Anthropic Claude",
    models: [
      { id: "claude-opus-4-6", label: "Claude Opus 4.6", provider: "Anthropic", badge: "Most capable" },
      { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", provider: "Anthropic", badge: "Recommended" },
      { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", provider: "Anthropic", badge: "Fast" },
    ],
  },
  {
    label: "OpenAI",
    models: [
      { id: "gpt-4o", label: "GPT-4o", provider: "OpenAI" },
      { id: "gpt-4o-mini", label: "GPT-4o Mini", provider: "OpenAI", badge: "Fast" },
      { id: "o3", label: "o3", provider: "OpenAI", badge: "Reasoning" },
    ],
  },
  {
    label: "Google",
    models: [
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", provider: "Google", badge: "Fast" },
      { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro", provider: "Google" },
    ],
  },
  {
    label: "EU Hosted",
    models: [
      { id: "mistral-large", label: "Mistral Large", provider: "Mistral AI", badge: "EU", eu: true },
      { id: "mistral-small", label: "Mistral Small", provider: "Mistral AI", badge: "EU Fast", eu: true },
    ],
  },
  {
    label: "Local (Ollama)",
    models: [
      { id: "ollama/llama3.2", label: "Llama 3.2", provider: "Local", local: true },
      { id: "ollama/phi4", label: "Phi-4", provider: "Local", badge: "Compact", local: true },
      { id: "ollama/qwen2.5", label: "Qwen 2.5", provider: "Local", local: true },
    ],
  },
];
const ALL_MODELS = MODEL_GROUPS.flatMap((g) => g.models);
const DEFAULT_MODEL = ALL_MODELS[1]; // Sonnet 4.6

interface Props {
  onSend: (message: string) => void;
  onInterrupt: () => void;
  disabled: boolean;
  isStreaming: boolean;
  injectedValue?: string;
  onInjectedConsumed?: () => void;
  placeholderOverride?: string;
}

export function ChatInput({ onSend, onInterrupt, disabled, isStreaming, injectedValue, onInjectedConsumed, placeholderOverride }: Props) {
  const [value, setValue] = useState("");
  const [showCmds, setShowCmds] = useState(false);
  const [cmdFilter, setCmdFilter] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);
  const cmds = useChatStore((s) => s.availableCommands);
  const selectedModel = useChatStore((s) => s.selectedModel);
  const [showModels, setShowModels] = useState(false);
  const modelRef = useRef<HTMLDivElement>(null);

  // Close model dropdown on outside click
  useEffect(() => {
    if (!showModels) return;
    const handler = (e: MouseEvent) => {
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) {
        setShowModels(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showModels]);

  const filtered = cmds.filter((c) => c.toLowerCase().includes(cmdFilter)).slice(0, 8);

  // Handle injected commands from ExtensionsStrip
  useEffect(() => {
    if (injectedValue) {
      setValue(injectedValue);
      onInjectedConsumed?.();
      ref.current?.focus();
    }
  }, [injectedValue, onInjectedConsumed]);

  const send = useCallback(() => {
    const t = value.trim();
    if (!t || disabled) return;
    onSend(t);
    setValue("");
    setShowCmds(false);
    if (ref.current) ref.current.style.height = "auto";
  }, [value, disabled, onSend]);

  const onKey = (e: React.KeyboardEvent) => {
    if (showCmds && filtered.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => (i + 1) % filtered.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => (i - 1 + filtered.length) % filtered.length); return; }
      if (e.key === "Tab" || (e.key === "Enter" && showCmds)) {
        e.preventDefault();
        const idx = Math.min(activeIdx, filtered.length - 1);
        if (idx >= 0) setValue("/" + filtered[idx] + " ");
        setShowCmds(false);
        return;
      }
      if (e.key === "Escape") { setShowCmds(false); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isStreaming) {
        const t = value.trim();
        if (t) {
          useChatStore.getState().enqueueMessage(t);
          setValue("");
          if (ref.current) ref.current.style.height = "auto";
        }
      } else {
        send();
      }
    }
  };

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setValue(v);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
    if (v.startsWith("/") && !v.includes(" ")) {
      setShowCmds(true);
      setCmdFilter(v.slice(1).toLowerCase());
      setActiveIdx(0);
    } else {
      setShowCmds(false);
    }
  };

  useEffect(() => { ref.current?.focus(); }, []);

  return (
    <form className="relative" onSubmit={(e) => { e.preventDefault(); send(); }}>
      {/* Slash autocomplete */}
      {showCmds && filtered.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl overflow-hidden bg-[var(--bg-active)] border border-[var(--border)] shadow-[var(--shadow-modal)] z-20">
          {filtered.map((cmd, i) => (
            <button
              key={cmd}
              className={`w-full text-left px-4 py-2.5 text-[13px] flex items-center gap-3 transition-colors ${
                i === activeIdx
                  ? "bg-[var(--bg-hover)] text-[var(--text-1)]"
                  : "text-[var(--text-2)] hover:bg-[var(--bg-hover)]"
              }`}
              onMouseEnter={() => setActiveIdx(i)}
              onClick={() => {
                setValue("/" + cmd + " ");
                setShowCmds(false);
                ref.current?.focus();
              }}
            >
              <span className="text-[var(--accent)] font-mono text-xs opacity-60">/</span>
              <span className="font-medium">{cmd}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input box */}
      <div
        className={`rounded-2xl border transition-all duration-150 ${
          disabled
            ? "bg-[var(--bg-sidebar)] border-[var(--border-subtle)] opacity-60"
            : "bg-[var(--bg-active)] border-[var(--border)] hover:border-[var(--bg-active)] focus-within:border-[var(--accent-border)] focus-within:shadow-[0_0_0_1px_rgba(0,229,200,0.1)]"
        }`}
      >
        <textarea
          ref={ref}
          value={value}
          onChange={onChange}
          onKeyDown={onKey}
          disabled={disabled}
          aria-label="Message to Claude"
          placeholder={placeholderOverride ?? (disabled ? "Connecting..." : isStreaming ? "Queue a message..." : "Message Claude...")}
          rows={1}
          className="w-full bg-transparent text-[14px] text-[var(--text-1)] placeholder:text-[var(--text-3)] resize-none outline-none px-4 pt-3.5 pb-1 min-h-[44px] max-h-[200px] leading-relaxed"
        />
        <div className="flex items-center justify-between px-3 pb-2.5">
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-[var(--text-3)] select-none">
              <kbd className="font-mono">/</kbd> commands
            </span>
            <div className="relative" ref={modelRef}>
              <button
                onClick={() => setShowModels(true)}
                className="text-[11px] text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors flex items-center gap-1"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-60">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
                {(selectedModel ? ALL_MODELS.find((m) => m.id === selectedModel)?.label : null) ?? DEFAULT_MODEL.label}
              </button>
            </div>
            {showModels && <ModelPickerModal onClose={() => setShowModels(false)} />}
          </div>
          {isStreaming ? (
            <button
              onClick={onInterrupt}
              aria-label="Stop generating"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#ef4444] text-[var(--bg-panel)] hover:brightness-110 transition-all text-[12px] font-medium"
              title="Stop generating"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
              Stop
            </button>
          ) : (
            <button
              onClick={send}
              disabled={disabled || !value.trim()}
              aria-label="Send message"
              className="p-1.5 rounded-lg bg-[var(--accent)] text-[var(--bg-panel)] disabled:opacity-15 disabled:cursor-not-allowed hover:brightness-110 transition-all"
              title="Send message"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

function ModelPickerModal({ onClose }: { onClose: () => void }) {
  const selectedModel = useChatStore((s) => s.selectedModel);
  const active = selectedModel ?? DEFAULT_MODEL.id;
  const [search, setSearch] = useState("");

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const filtered = search
    ? MODEL_GROUPS.map((g) => ({ ...g, models: g.models.filter((m) => m.label.toLowerCase().includes(search.toLowerCase()) || m.provider.toLowerCase().includes(search.toLowerCase())) })).filter((g) => g.models.length > 0)
    : MODEL_GROUPS;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "var(--bg-overlay)" }} onClick={onClose}>
      <div className="w-[580px] max-w-[95vw] rounded-2xl overflow-hidden flex flex-col" style={{ background: "var(--bg-modal)", border: "1px solid var(--border)", boxShadow: "var(--shadow-modal)", maxHeight: "70vh" }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center justify-between mb-3">
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-1)" }}>Select model</h2>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: 4 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search models..."
            style={{ width: "100%", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "var(--text-1)", outline: "none" }}
          />
        </div>

        {/* Model list */}
        <div className="overflow-y-auto flex-1 px-3 pb-4">
          {filtered.map((group) => (
            <div key={group.label} className="mb-3">
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "4px 8px 6px" }}>{group.label}</div>
              {group.models.map((m) => {
                const isActive = m.id === active;
                return (
                  <button
                    key={m.id}
                    onClick={() => { useChatStore.getState().setSelectedModel(m.id === DEFAULT_MODEL.id ? null : m.id); onClose(); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left mb-0.5"
                    style={{ background: isActive ? "var(--accent-soft)" : "transparent", border: `1px solid ${isActive ? "var(--accent-border)" : "transparent"}` }}
                    onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "var(--bg-hover)"; }}
                    onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: m.local ? "var(--bg-active)" : m.eu ? "rgba(52,199,89,0.12)" : "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>
                      {m.local ? "⬡" : m.eu ? "🇪🇺" : "◈"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)" }}>{m.label}</div>
                      <div style={{ fontSize: 11, color: "var(--text-3)" }}>{m.provider}</div>
                    </div>
                    {m.badge && (
                      <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 5, background: m.eu ? "rgba(52,199,89,0.15)" : m.local ? "var(--bg-active)" : "var(--accent-soft)", color: m.eu ? "var(--green)" : "var(--accent)" }}>
                        {m.badge}
                      </span>
                    )}
                    {isActive && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div style={{ padding: "10px 20px", borderTop: "0.5px solid var(--border)", fontSize: 11, color: "var(--text-3)", display: "flex", gap: 16 }}>
          <span>EU models: data stays in Europe</span>
          <span>·</span>
          <span>Local models: fully offline, no API cost</span>
        </div>
      </div>
    </div>
  );
}
