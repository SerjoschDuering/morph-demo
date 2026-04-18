import { useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useChatStore, type SkillInfo } from "../stores/chatStore";
import { FileTree } from "./FileTree";

type Tab = "skills" | "plugins" | "mcp" | "tools";

const TABS: { id: Tab; label: string }[] = [
  { id: "skills", label: "Skills" },
  { id: "plugins", label: "Plugins" },
  { id: "mcp", label: "MCP Servers" },
  { id: "tools", label: "Tools" },
];

interface Props {
  onReadFile?: (path: string) => void;
  onListDir?: (path: string) => void;
  onInjectCommand?: (cmd: string) => void;
}

export function ExtensionsModal({ onReadFile, onListDir, onInjectCommand: _onInjectCommand }: Props) {
  const isOpen = useChatStore((s) => s.extensionsModalOpen);
  const setOpen = useChatStore((s) => s.setExtensionsModalOpen);
  const extensions = useChatStore((s) => s.extensions);
  const filePreview = useChatStore((s) => s.filePreview);
  const [tab, setTab] = useState<Tab>("plugins");
  const [expanded, setExpanded] = useState<string | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    useChatStore.getState().setFilePreview(null);
  }, [setOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    if (isOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  const handleInvoke = useCallback((name: string) => {
    useChatStore.getState().setInjectedCommand(`/${name} `);
    close();
  }, [close]);

  const handleFileClick = useCallback((path: string) => {
    if (onReadFile) onReadFile(path);
  }, [onReadFile]);

  const handleListDir = useCallback((path: string) => {
    if (onListDir) onListDir(path);
  }, [onListDir]);

  const toggleExpand = useCallback((name: string) => {
    setExpanded((prev) => prev === name ? null : name);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "var(--bg-overlay)" }}
      onClick={close}>
      <div className="w-[900px] max-w-[95vw] rounded-2xl flex overflow-hidden"
        style={{ height: "70vh", background: "var(--bg-modal)", border: "1px solid var(--border)", boxShadow: "var(--shadow-modal)" }}
        onClick={(e) => e.stopPropagation()}>

        {/* Left: Tabs */}
        <div className="w-[160px] shrink-0 flex flex-col py-3"
          style={{ borderRight: "1px solid var(--border-subtle)", background: "var(--bg-input)" }}>
          <div className="px-4 pb-2">
            <h2 className="text-[14px] font-semibold" style={{ color: "var(--text-1)" }}>Extensions</h2>
          </div>
          <div className="space-y-0.5 px-1">
            {TABS.map((t) => (
              <button key={t.id}
                onClick={() => { setTab(t.id); setExpanded(null); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-left rounded-lg transition-colors"
                style={{
                  color: tab === t.id ? "var(--accent)" : "var(--text-2)",
                  background: tab === t.id ? "var(--accent-soft)" : "transparent",
                }}>
                <TabIcon id={t.id} />
                <span>{t.label}</span>
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <button onClick={close}
            className="mx-3 py-2 rounded-lg text-[12px] text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors">
            Close
          </button>
        </div>

        {/* Middle: List with expandable tree */}
        <div className="w-[300px] shrink-0 flex flex-col min-w-0"
          style={{ borderRight: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <h3 className="text-[13px] font-medium" style={{ color: "var(--text-1)" }}>
              {TABS.find((t) => t.id === tab)?.label}
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {tab === "plugins" && (
              <PluginsList plugins={extensions.plugins} expanded={expanded}
                onToggle={toggleExpand} onFileClick={handleFileClick} onListDir={handleListDir} />
            )}
            {tab === "skills" && (
              <SkillsList skills={extensions.skills} commands={extensions.commands}
                expanded={expanded} onToggle={toggleExpand}
                onInvoke={handleInvoke} onFileClick={handleFileClick} onListDir={handleListDir} />
            )}
            {tab === "mcp" && (
              <McpList servers={extensions.mcpServers} />
            )}
            {tab === "tools" && (
              <ToolsList tools={extensions.tools} />
            )}
          </div>
        </div>

        {/* Right: File viewer */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <h3 className="text-[12px] font-mono truncate" style={{ color: "var(--text-3)" }}>
              {filePreview ? filePreview.path.split("/").slice(-2).join("/") : "File viewer"}
            </h3>
            <button onClick={close} className="p-1 rounded"
              style={{ color: "var(--text-3)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {filePreview ? (
              <div className="md-content text-[12px]">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {filePreview.content}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-[12px]" style={{ color: "var(--text-3)" }}>
                  Click a file to preview
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Tab icons ── */
function TabIcon({ id }: { id: Tab }) {
  const s = "w-3.5 h-3.5";
  if (id === "skills") return (
    <svg className={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
  if (id === "plugins") return (
    <svg className={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1zM2 21a8 8 0 0110-7.5M6 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z" />
    </svg>
  );
  if (id === "mcp") return (
    <svg className={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
    </svg>
  );
  return (
    <svg className={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

/* ── Plugins list with expandable file tree ── */
function PluginsList({ plugins, expanded, onToggle, onFileClick, onListDir }: {
  plugins: { name: string; path: string }[];
  expanded: string | null;
  onToggle: (name: string) => void;
  onFileClick: (path: string) => void;
  onListDir: (path: string) => void;
}) {
  if (plugins.length === 0) return <Empty text="No plugins installed" />;
  return (
    <div className="space-y-1">
      {plugins.map((p) => {
        const isExpanded = expanded === p.name;
        return (
          <div key={p.name} className="rounded-lg overflow-hidden"
            style={{ border: `1px solid ${isExpanded ? "var(--accent-border)" : "var(--border)"}` }}>
            <button
              onClick={() => {
                onToggle(p.name);
                if (p.path) onFileClick(p.path + "/.claude-plugin/plugin.json");
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-left transition-colors hover:bg-[var(--bg-hover)]"
              style={{ color: "var(--text-1)" }}>
              <span className="text-[10px] w-3 shrink-0" style={{ color: "var(--text-3)" }}>
                {isExpanded ? "▾" : "▸"}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0" />
              <span className="font-medium truncate">{p.name}</span>
            </button>
            {isExpanded && p.path && (
              <div className="border-t border-[var(--border-subtle)] py-1 px-1">
                <FileTree rootPath={p.path} onListDir={onListDir} onReadFile={onFileClick} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Skills list with expandable file tree ── */
function SkillsList({ skills, commands, expanded, onToggle, onInvoke, onFileClick, onListDir }: {
  skills: SkillInfo[]; commands: string[];
  expanded: string | null;
  onToggle: (name: string) => void;
  onInvoke: (name: string) => void;
  onFileClick: (path: string) => void;
  onListDir: (path: string) => void;
}) {
  if (skills.length === 0 && commands.length === 0) return <Empty text="No skills or commands" />;
  return (
    <div className="space-y-1">
      {skills.map((sk) => {
        const isExpanded = expanded === sk.name;
        return (
          <div key={sk.name} className="rounded-lg overflow-hidden"
            style={{ border: `1px solid ${isExpanded ? "var(--accent-border)" : "var(--border)"}` }}>
            <div
              className="flex items-center gap-2 px-3 py-2 text-[12px] cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
              onClick={() => {
                onToggle(sk.name);
                if (sk.path) onFileClick(sk.path + "/SKILL.md");
              }}>
              <span className="text-[10px] w-3 shrink-0" style={{ color: "var(--text-3)" }}>
                {isExpanded ? "▾" : "▸"}
              </span>
              <span className="font-mono text-[11px]" style={{ color: "var(--accent)" }}>/{sk.name}</span>
              <span className="flex-1" />
              <button onClick={(e) => { e.stopPropagation(); onInvoke(sk.name); }}
                className="px-2 py-0.5 rounded text-[10px] font-medium shrink-0"
                style={{ background: "var(--accent)", color: "var(--bg-panel)" }}>
                Invoke
              </button>
            </div>
            {isExpanded && sk.path && (
              <div className="border-t border-[var(--border-subtle)] py-1 px-1">
                <FileTree rootPath={sk.path} onListDir={onListDir} onReadFile={onFileClick} />
              </div>
            )}
          </div>
        );
      })}
      {commands.map((cmd) => (
        <div key={cmd} className="px-3 py-2 rounded-lg text-[12px]"
          style={{ border: "1px solid var(--border)" }}>
          <span className="font-mono" style={{ color: "var(--text-2)" }}>{cmd}</span>
          <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-3)" }}>Custom command</p>
        </div>
      ))}
    </div>
  );
}

/* ── Simple lists (no tree needed) ── */
function McpList({ servers }: { servers: { name: string; status: string }[] }) {
  if (servers.length === 0) return <Empty text="No MCP servers" />;
  return (
    <div className="space-y-1">
      {servers.map((srv) => (
        <div key={srv.name}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px]"
          style={{ border: "1px solid var(--border)", color: "var(--text-1)" }}>
          <span className="w-2 h-2 rounded-full shrink-0"
            style={{ background: srv.status === "connected" ? "var(--accent)" : "var(--text-3)" }} />
          <span className="font-medium">{srv.name}</span>
          <span className="flex-1" />
          <span className="text-[10px]" style={{ color: "var(--text-3)" }}>{srv.status}</span>
        </div>
      ))}
    </div>
  );
}

function ToolsList({ tools }: { tools: string[] }) {
  if (tools.length === 0) return <Empty text="No tools available" />;
  return (
    <div className="space-y-0.5">
      {tools.map((t) => (
        <div key={t} className="px-3 py-1.5 rounded text-[12px]"
          style={{ color: "var(--text-2)" }}>
          {t}
        </div>
      ))}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center py-12">
      <p className="text-[12px]" style={{ color: "var(--text-3)" }}>{text}</p>
    </div>
  );
}
