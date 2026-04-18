import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "../stores/chatStore";
import { useChatStore } from "../stores/chatStore";
import { ToolUseDisplay, isInlineTool } from "./ToolUseDisplay";
import { ConfigWidget } from "./ConfigWidget";

// Entity names for CI demo — clickable pills that command Entity Network
const CI_ENTITIES = [
  'Nvidia', 'OpenAI', 'Anthropic', 'Google DeepMind', 'xAI',
  'Meta AI', 'Microsoft', 'TSMC', 'AMD', 'Inference Systems LLC',
];
const ENTITY_ID_MAP: Record<string, string> = {
  'Nvidia': 'nvidia', 'OpenAI': 'openai', 'Anthropic': 'anthropic',
  'Google DeepMind': 'google', 'xAI': 'xai', 'Meta AI': 'meta',
  'Microsoft': 'microsoft', 'TSMC': 'tsmc', 'AMD': 'amd',
  'Inference Systems LLC': 'inference-systems',
};
// Build regex: longest names first to avoid partial matches
const ENTITY_RE = new RegExp(`(${[...CI_ENTITIES].sort((a, b) => b.length - a.length).map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');

function EntityPillText({ children }: { children: string }) {
  const parts = children.split(ENTITY_RE);
  if (parts.length === 1) return <>{children}</>;
  return (
    <>
      {parts.map((part, i) => {
        const entityId = ENTITY_ID_MAP[part];
        if (!entityId) return <React.Fragment key={i}>{part}</React.Fragment>;
        return (
          <span
            key={i}
            onClick={() => {
              window.dispatchEvent(new CustomEvent('morph:app-command', {
                detail: { appName: 'Entity Network', command: 'zoom', data: { entityId } },
              }));
            }}
            style={{
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              padding: '1px 6px',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 'inherit',
              border: '1px solid var(--accent-border)',
            }}
          >
            {part}
          </span>
        );
      })}
    </>
  );
}

const REMARK_PLUGINS = [remarkGfm];

/**
 * Open a URL in the system browser via Tauri shell plugin.
 * Dynamic import avoids top-level import failure in test environments (happy-dom has no Tauri globals).
 */
function openExternal(href: string) {
  import("@tauri-apps/plugin-shell")
    .then(({ open }) => open(href))
    .catch((err) => console.error("[openExternal] failed to open URL:", href, err));
}

/** Block dangerous URLs; open safe ones in system browser via Tauri shell */
const MD_COMPONENTS = {
  // node is a hast element injected by react-markdown — discard to avoid React DOM warnings
  a: ({ href, children, node: _node, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { node?: unknown; children?: React.ReactNode }) => {
    if (!href || /^(javascript|data|vbscript):/i.test(href)) {
      return <span>{children}</span>;
    }
    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      openExternal(href);
    };
    // Spread props first so our security attrs (rel, onClick) take precedence
    return <a {...props} href={href} onClick={handleClick} rel="noopener noreferrer">{children}</a>;
  },
  // Entity pill rendering — wrap known entity names in clickable accent spans
  p: ({ children, node: _node, ...props }: React.HTMLAttributes<HTMLParagraphElement> & { node?: unknown; children?: React.ReactNode }) => {
    const mapped = React.Children.map(children, child => {
      if (typeof child === 'string') return <EntityPillText>{child}</EntityPillText>;
      return child;
    });
    return <p {...props}>{mapped}</p>;
  },
};

interface Props {
  message: ChatMessage;
}

const fmtElapsed = (s: number) => s < 60 ? s + 's' : Math.floor(s / 60) + 'm ' + (s % 60) + 's';

/** Live streaming content — subscribes to store, auto-scrolls */
function StreamingContent({ hasTools }: { hasTools: boolean }) {
  const content = useChatStore((s) => s.streamingContent);
  const thinking = useChatStore((s) => s.streamingThinking);
  const startedAt = useChatStore((s) => s.streamingStartedAt);
  const endRef = useRef<HTMLDivElement>(null);
  const thinkingRef = useRef<HTMLPreElement>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "instant" as ScrollBehavior });
  }, [content]);

  // Auto-scroll thinking pre to bottom
  useEffect(() => {
    if (thinkingRef.current) thinkingRef.current.scrollTop = thinkingRef.current.scrollHeight;
  }, [thinking]);

  // Elapsed timer — tick every 1s while streaming
  useEffect(() => {
    if (!startedAt) { setElapsed(0); return; }
    setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [startedAt]);

  if (!content && !hasTools) {
    // Thinking phase — show dots + elapsed + full thinking text
    return (
      <div className="py-2">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-1.5 h-1.5 rounded-full dot-pulse"
              style={{ background: "var(--accent)", animationDelay: `${i * 200}ms` }} />
          ))}
          <span className="text-[11px]" style={{ color: "var(--text-3)" }}>
            {elapsed >= 5 ? `Thinking · ${fmtElapsed(elapsed)}` : "Thinking"}
          </span>
        </div>
        {thinking && (
          <pre ref={thinkingRef}
            className="mt-1.5 text-[10px] font-mono whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed pl-3"
            style={{ color: "var(--text-3)", borderLeft: "2px solid var(--border-subtle)" }}>
            {thinking}
          </pre>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Show elapsed timer while content is streaming */}
      {elapsed >= 5 && (
        <div className="text-[10px] mb-1" style={{ color: "var(--text-3)" }}>
          {fmtElapsed(elapsed)}
        </div>
      )}
      {content && (
        <div className="md-content">
          <pre className="whitespace-pre-wrap text-[14px] leading-relaxed m-0 font-[inherit]">{content}</pre>
        </div>
      )}
      {content && (
        <span className="cursor-blink inline-block ml-0.5 align-text-bottom"
          style={{ color: "var(--accent)" }}>&#x2588;</span>
      )}
      <div ref={endRef} />
    </>
  );
}

/** Copy button — shown on hover */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);

  return (
    <button
      onClick={copy}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-[var(--bg-hover)]"
      title="Copy"
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      )}
    </button>
  );
}

/** Collapse 4+ consecutive inline-done tools into a toggle */
function ToolList({ tools }: { tools: NonNullable<ChatMessage["toolUses"]> }) {
  const [expandedBatches, setExpandedBatches] = useState<Set<number>>(new Set());

  // Group consecutive inline-done tools into batches
  const groups: { type: "inline"; tools: typeof tools; startIdx: number }[] | { type: "card"; tool: typeof tools[0] }[] = [];
  let inlineBuf: typeof tools = [];
  let inlineStart = 0;
  const flush = () => {
    if (inlineBuf.length > 0) {
      (groups as any[]).push({ type: "inline", tools: [...inlineBuf], startIdx: inlineStart });
      inlineBuf = [];
    }
  };
  tools.forEach((t, i) => {
    if (isInlineTool(t)) {
      if (inlineBuf.length === 0) inlineStart = i;
      inlineBuf.push(t);
    } else {
      flush();
      (groups as any[]).push({ type: "card", tool: t });
    }
  });
  flush();

  return (
    <div className="space-y-1 mb-2">
      {(groups as any[]).map((g, gi) => {
        if (g.type === "card") {
          return <ToolUseDisplay key={g.tool.id} toolUse={g.tool} />;
        }
        // Inline batch
        const batch = g.tools as typeof tools;
        if (batch.length < 4) {
          return batch.map((t: typeof tools[0]) => <ToolUseDisplay key={t.id} toolUse={t} />);
        }
        const expanded = expandedBatches.has(gi);
        return (
          <div key={gi}>
            <button
              onClick={() => setExpandedBatches(s => { const n = new Set(s); expanded ? n.delete(gi) : n.add(gi); return n; })}
              className="flex items-center gap-1.5 text-[11px] font-mono py-0.5 hover:brightness-125 transition-all"
              style={{ color: "var(--text-3)", background: "none", border: "none", cursor: "pointer" }}
            >
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className="shrink-0 transition-transform" style={{ transform: expanded ? "rotate(90deg)" : "" }}>
                <path d="M9 18l6-6-6-6" />
              </svg>
              {expanded ? `${batch.length} tools` : `▸ ${batch.length} tools completed`}
            </button>
            {expanded && batch.map((t: typeof tools[0]) => <ToolUseDisplay key={t.id} toolUse={t} />)}
          </div>
        );
      })}
    </div>
  );
}

export const MessageBubble = React.memo(function MessageBubble({ message }: Props) {
  if (message.role === "system") {
    // Widget message — render inline glass card
    if (message.widget?.type === "app-config") {
      return (
        <div className="py-2 flex justify-start">
          <ConfigWidget appName={message.widget.appName} appId={message.widget.appId} />
        </div>
      );
    }
    return (
      <div className="py-1 flex justify-center">
        <span className="text-[10px] text-[var(--text-3)] opacity-70">
          {message.content}
        </span>
      </div>
    );
  }

  if (message.role === "user") {
    return (
      <div className="py-1.5 flex justify-end">
        <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-br-md text-[14px] leading-relaxed whitespace-pre-wrap"
          style={{ background: "var(--bg-active)", color: "var(--text-1)" }}>
          {message.content}
        </div>
      </div>
    );
  }

  // Assistant message
  const hasTools = message.toolUses && message.toolUses.length > 0;

  if (message.isStreaming) {
    return (
      <div className="py-1.5">
        <div className="max-w-[95%]">
          {hasTools && <ToolList tools={message.toolUses!} />}
          <StreamingContent hasTools={!!hasTools} />
        </div>
      </div>
    );
  }

  // Finished assistant message — render full markdown
  const hasContent = !!message.content;

  return (
    <div className="py-1.5 group relative">
      <div className="max-w-[95%]">
        {hasTools && <ToolList tools={message.toolUses!} />}
        {hasContent && (
          <div className="md-content">
            <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MD_COMPONENTS}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
        {message.thinkingText && (
          <ThinkingToggle text={message.thinkingText} />
        )}
      </div>
      {/* Copy button — top-right on hover */}
      {hasContent && (
        <div className="absolute top-1 right-0">
          <CopyButton text={message.content} />
        </div>
      )}
    </div>
  );
});

function ThinkingToggle({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const preview = text.slice(0, 80).replace(/\n/g, " ");

  return (
    <div className="mt-1">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[10px] hover:brightness-125 transition-all max-w-full"
        style={{ color: "var(--text-3)" }}>
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className="shrink-0 transition-transform" style={{ transform: open ? "rotate(90deg)" : "" }}>
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span className="shrink-0">thinking</span>
        {!open && (
          <span className="truncate opacity-60 ml-1">{preview}</span>
        )}
      </button>
      {open && (
        <pre className="mt-1 text-[10px] font-mono whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed pl-3"
          style={{ color: "var(--text-3)", borderLeft: "2px solid var(--border-subtle)" }}>
          {text}
        </pre>
      )}
    </div>
  );
}
