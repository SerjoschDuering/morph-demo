import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown, ChevronRight, Folder, Plus, FolderPlus,
  Globe, Briefcase, User, Shield, FileText, Settings, Zap,
  Clock, Play, Lock, Cloud, HardDrive, Key,
  Database, Terminal, Anchor, Wrench, ScrollText, MessageSquare,
  BookOpen, Archive, Hash, Brain, Layers, Package, Box,
} from "lucide-react";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { useChatStore } from "../stores/chatStore";
import { FeatureTooltip } from "./FeatureTooltip";

type SidebarTab = "chats" | "memory" | "scripts" | "workflows" | "settings";

const WS_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  globe: Globe, briefcase: Briefcase, user: User, shield: Shield,
};

// All non-chat tabs share the same width — no jiggle
const SIDEBAR_WIDTH_CHAT = 220;
const SIDEBAR_WIDTH_PANEL = 300;

// Icon mapping for file tree nodes
const FILE_ICON_MAP: Record<string, React.ComponentType<{size?: number; color?: string}>> = {
  "CLAUDE.md": BookOpen,
  "index.md": Hash,
  "user.md": User,
  "short_term.md": Zap,
  "long_term.md": Database,
  "project.md": Archive,
  "feedback.md": MessageSquare,
  "memory/": Brain,
  ".morph/": Settings,
  "config.toml": Wrench,
  "audit.log": ScrollText,
  "hooks/": Anchor,
  "scripts/": Terminal,
  "fetch-overture.sh": Terminal,
  "index-workspace.sh": Terminal,
  "clean-artifacts.sh": Terminal,
  "on-app-created.sh": Terminal,
  "on-session-end.sh": Terminal,
};

function getFileIcon(name: string, type: "file" | "folder") {
  const Icon = FILE_ICON_MAP[name];
  if (Icon) return Icon;
  if (type === "folder") return Folder;
  if (name.endsWith(".sh")) return Terminal;
  if (name.endsWith(".toml")) return Wrench;
  if (name.endsWith(".log")) return ScrollText;
  if (name.endsWith(".md")) return FileText;
  return FileText;
}

// ─── Demo file trees ─────────────────────────────────────────────────────────

const MEMORY_TREE = [
  {
    name: "CLAUDE.md", type: "file" as const, icon: "📋",
    content: `# Workspace\n\nYou are working in a general-purpose research workspace.\n\n## Key Tools\n- Morph workspace apps compile via esbuild-wasm in-browser\n- Apps run in-process (not iframes) — share window.React and window.Morph\n- No import statements inside apps — use globals only\n\n## Project Context\nGeneral research and note-taking. Add project-specific notes below.\n\n## Notes\n- Apps push context via window.Morph.updateContext(...)\n- The agent reads that context before replying`,
  },
  {
    name: "memory/", type: "folder" as const, expanded: true,
    children: [
      { name: "index.md", type: "file" as const, content: `# Memory Index\n\n## User\n- [user_role](user.md) — Role and background\n- [user_prefs](user.md) — Preferences for output style\n\n## Project\n- [current_project](project.md) — What we're working on\n\n## Short-term\n- [session_notes](short_term.md) — Live session state\n\n## Long-term\n- [learnings](long_term.md) — Accumulated patterns and gotchas` },
      { name: "user.md", type: "file" as const, content: `---\nname: user_profile\ntype: user\n---\n\nUser is a technical generalist.\nPrefers concise, direct responses.\nWants code that runs, not explanations of code that might run.` },
      { name: "short_term.md", type: "file" as const, content: `---\nname: session_context\ntype: short_term\n---\n\nCurrently: Exploring the workspace.\nApps loaded: Markdown Notes, Calendar.\nNext: try asking the agent to build a new app.` },
      { name: "long_term.md", type: "file" as const, content: `---\nname: learnings\ntype: long_term\n---\n\n## Performance\n- esbuild-wasm compiles small apps in ~40ms\n- In-process apps (not iframes) share the React runtime cheaply\n\n## Gotchas\n- Do not use ES imports inside apps — globals only\n- Blob URL iframes would break shared state; we avoid them` },
      { name: "project.md", type: "file" as const, content: `---\nname: current_project\ntype: project\n---\n\nResearch workspace for trying things out.\n\n**Why:** Dogfood the Morph demo.\n**Status:** Poking at apps and memory.\n**Deadline:** None.\n\n**Data sources:**\n- Local notes\n- Whatever you drop in the workspace` },
      { name: "feedback.md", type: "file" as const, content: `---\nname: agent_feedback\ntype: feedback\n---\n\n## Rules\n- Always show a preview before writing new app source\n- Keep apps under 300 lines\n- Use the Morph bridge for filesystem access\n\n**Why:** Faster iteration and safer sandboxing.` },
    ],
  },
  {
    name: ".morph/", type: "folder" as const, expanded: false,
    children: [
      { name: "config.toml", type: "file" as const, content: `[workspace]\nname = "research"\nid = "research"\ncwd = "~/workspaces/research"\n\n[sync]\nenabled = false\nprovider = "rclone"\nremote = ""\n\n[secrets]\ninherit_global = true\n\n[agent]\nmodel = "claude-sonnet-4-6"\nmax_tokens = 8192\ntemperature = 0` },
      { name: "audit.log", type: "file" as const, content: `2026-04-08T09:12:03Z  Write  apps/notes/source.tsx         ok\n2026-04-08T09:10:55Z  Bash   ls ~/workspaces/research      ok\n2026-04-08T09:08:22Z  Read   ~/workspaces/research/CLAUDE.md ok\n2026-04-08T08:55:11Z  Write  memory/short_term.md          ok\n2026-04-07T17:30:02Z  Bash   refresh-cache.sh              ok` },
    ],
  },
];

const SCRIPTS_TREE = [
  {
    name: "scripts/", type: "folder" as const, expanded: true,
    children: [
      { name: "refresh-cache.sh", type: "file" as const, content: `#!/bin/bash\n# Rebuild the local cache\nrm -rf ./.morph/cache\nmkdir -p ./.morph/cache\necho "Cache refreshed: $(date)"` },
      { name: "index-workspace.sh", type: "file" as const, content: `#!/bin/bash\n# Re-index all workspace files for RAG search\ncd ~/workspaces/research\nfind . -name "*.md" -o -name "*.tsx" -o -name "*.py" | \\\n  xargs morph index --embedding all-MiniLM-L6-v2\necho "Indexed $(find . -name '*.md' | wc -l) files"` },
      { name: "clean-artifacts.sh", type: "file" as const, content: `#!/bin/bash\n# Remove compiled app blobs and reset cache\nrm -rf ./apps/*/compiled.js\nrm -rf .morph/cache/\necho "Cleaned artifacts"` },
    ],
  },
  {
    name: "hooks/", type: "folder" as const, expanded: false,
    children: [
      { name: "on-app-created.sh", type: "file" as const, content: `#!/bin/bash\n# Runs after the agent creates a new app\nAPP_NAME=$1\necho "App created: $APP_NAME" >> .morph/audit.log` },
      { name: "on-session-end.sh", type: "file" as const, content: `#!/bin/bash\n# Compact short-term memory into long-term at session end\necho "Session ended at $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> .morph/audit.log` },
    ],
  },
];

const WORKFLOW_LIST = [
  { id: "wf-1", name: "Nightly data refresh", trigger: "02:00 daily", status: "active", scope: "workspace" },
  { id: "wf-2", name: "On new file: auto-index", trigger: "file_created", status: "active", scope: "workspace" },
  { id: "wf-3", name: "Weekly report", trigger: "Mon 09:00", status: "paused", scope: "global" },
  { id: "wf-4", name: "Memory compaction", trigger: "session_end", status: "active", scope: "global" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface FileNode {
  name: string;
  type: "file" | "folder";
  content?: string;
  children?: FileNode[];
  expanded?: boolean;
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ChatSidebarProps {
  onNewChat: () => void;
  onLoadSession: (id: string) => void;
  onRefreshSessions: () => void;
  onVisualizeSession: (id: string) => void;
}

export function ChatSidebar({ onNewChat, onLoadSession, onRefreshSessions, onVisualizeSession }: ChatSidebarProps) {
  const { workspaces, activeWorkspaceId } = useWorkspaceStore();
  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0];
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("chats");
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    "Research": true, "memory/": true, "scripts/": true,
  });
  const width = sidebarTab === "chats" ? SIDEBAR_WIDTH_CHAT : SIDEBAR_WIDTH_PANEL;

  const WsIcon = WS_ICONS[activeWs.icon] ?? Globe;
  const displayPath = activeWs.cwd.replace(/^\/Users\/[^/]+/, "~").replace(/^~\/workspaces\//, "~/");

  const openFile = (node: FileNode) => {
    if (node.type !== "file" || !node.content) return;
    useChatStore.getState().setContextFile({ path: node.name, name: node.name, content: node.content });
  };

  return (
    <div
      className="shrink-0 flex flex-col glass-heavy"
      style={{
        width,
        transition: "width 0.2s ease",
        background: "var(--bg-sidebar)",
        borderRight: "0.5px solid var(--border)",
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      {/* Workspace header */}
      <div className="px-3 pt-3 pb-2 flex items-center gap-2" style={{ borderBottom: "0.5px solid var(--border)" }}>
        <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: "var(--accent-soft)" }}>
          <WsIcon size={14} color="var(--accent)" />
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", flex: 1 }}>{activeWs.name}</span>
        <span style={{ fontSize: 10, color: "var(--text-3)", fontFamily: "monospace" }}>{displayPath}</span>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {sidebarTab === "chats" && <ChatsTab activeWs={activeWs} onLoadSession={onLoadSession} onRefreshSessions={onRefreshSessions} onVisualizeSession={onVisualizeSession} />}
        {sidebarTab === "memory" && <FileTreeTab tree={MEMORY_TREE} expandedFolders={expandedFolders} setExpandedFolders={setExpandedFolders} onOpen={openFile} />}
        {sidebarTab === "scripts" && <FileTreeTab tree={SCRIPTS_TREE} expandedFolders={expandedFolders} setExpandedFolders={setExpandedFolders} onOpen={openFile} />}
        {sidebarTab === "workflows" && <WorkflowsTab activeWs={activeWs} />}
        {sidebarTab === "settings" && <SettingsTab activeWs={activeWs} />}
      </div>

      {/* New chat / project — only on chats tab */}
      {sidebarTab === "chats" && (
        <div className="px-2 pt-2 pb-1 flex gap-1.5" style={{ borderTop: "0.5px solid var(--border)" }}>
          <FeatureTooltip
            title="New conversation"
            description="Start a fresh chat in this workspace. Each chat has its own history and context."
            side="bottom"
          >
            <button onClick={onNewChat} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs" style={{ border: "1px dashed var(--border)", color: "var(--text-2)", background: "transparent", cursor: "pointer" }}>
              <Plus size={12} /> Chat
            </button>
          </FeatureTooltip>
          <button className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs" style={{ border: "1px dashed var(--border)", color: "var(--text-2)", background: "transparent", cursor: "pointer" }}>
            <FolderPlus size={12} /> Project
          </button>
        </div>
      )}

      {/* Bottom tab strip */}
      <div className="px-2 py-1.5 flex gap-0.5" style={{ borderTop: "0.5px solid var(--border-subtle)" }}>
        {(["chats", "memory", "scripts", "workflows", "settings"] as SidebarTab[]).map((t) => {
          const icons: Record<SidebarTab, React.ReactNode> = {
            chats: <MessageSquare size={11} />,
            memory: <Layers size={11} />,
            scripts: <Terminal size={11} />,
            workflows: <Clock size={11} />,
            settings: <Settings size={11} />,
          };
          return (
            <button
              key={t}
              onClick={() => setSidebarTab(t)}
              title={t.charAt(0).toUpperCase() + t.slice(1)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg transition-all"
              style={{
                color: sidebarTab === t ? "var(--accent)" : "var(--text-3)",
                background: sidebarTab === t ? "var(--accent-soft)" : "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: 9,
                fontWeight: sidebarTab === t ? 600 : 400,
                textTransform: "capitalize",
              }}
            >
              {icons[t]}
              {t}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Chats tab ────────────────────────────────────────────────────────────────

function groupByDate(sessions: ReturnType<typeof useChatStore.getState>["sessions"]) {
  const now = Date.now();
  const today: typeof sessions = [];
  const yesterday: typeof sessions = [];
  const week: typeof sessions = [];
  const older: typeof sessions = [];

  for (const s of sessions) {
    const age = now - (s.lastUsedAt || s.createdAt);
    if (age < 86_400_000) today.push(s);
    else if (age < 172_800_000) yesterday.push(s);
    else if (age < 604_800_000) week.push(s);
    else older.push(s);
  }
  return { today, yesterday, week, older };
}

function ChatsTab({ activeWs, onLoadSession, onRefreshSessions, onVisualizeSession }: {
  activeWs: ReturnType<typeof useWorkspaceStore.getState>["workspaces"][number];
  onLoadSession: (id: string) => void;
  onRefreshSessions: () => void;
  onVisualizeSession: (id: string) => void;
}) {
  const sessions = useChatStore((s) => s.sessions);
  const currentSessionId = useChatStore((s) => s.currentSessionId);
  const backgroundSessions = useChatStore((s) => s.backgroundSessions);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => { onRefreshSessions(); }, []);

  const sessionWorkspaceMap = useChatStore((s) => s.sessionWorkspaceMap);
  const isGlobal = activeWs.isGlobal;
  const display = isGlobal ? sessions : sessions.filter((s) => {
    const tagged = sessionWorkspaceMap[s.id];
    if (tagged) return tagged === activeWs.id;
    return s.cwd === activeWs.cwd; // legacy cwd fallback
  });
  const other = isGlobal ? [] : sessions.filter((s) => {
    const tagged = sessionWorkspaceMap[s.id];
    if (tagged) return tagged !== activeWs.id;
    return s.cwd !== activeWs.cwd;
  });
  const [showOther, setShowOther] = useState(false);

  const { today, yesterday, week, older } = groupByDate(display);

  const renderSession = (s: typeof sessions[number]) => {
    const isActive = s.id === currentSessionId;
    const isBg = backgroundSessions.includes(s.id);
    const isHovered = hoveredId === s.id;
    return (
      <div
        key={s.id}
        className="group flex items-center gap-2 px-2 py-1.5 mb-0.5 rounded-md cursor-pointer"
        style={{ background: isActive ? "var(--bg-active)" : undefined, boxShadow: isActive ? "var(--glow-active)" : "none" }}
        onMouseEnter={() => setHoveredId(s.id)}
        onMouseLeave={() => setHoveredId(null)}
        onClick={() => onLoadSession(s.id)}
      >
        {isBg && <span className="pulse-dot shrink-0" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", display: "inline-block" }} />}
        <span className="truncate flex-1" style={{ fontSize: 12, fontWeight: isActive ? 500 : 400, color: isActive ? "var(--text-1)" : "var(--text-2)" }}>
          {s.title}
        </span>
        {isHovered && (
          <button
            onClick={(e) => { e.stopPropagation(); onVisualizeSession(s.id); }}
            title="Visualize session"
            style={{ color: "var(--text-3)", background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex", alignItems: "center" }}
          >
            <Box size={12} />
          </button>
        )}
      </div>
    );
  };

  const renderGroup = (label: string, items: typeof sessions) => {
    if (items.length === 0) return null;
    return (
      <div key={label}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "6px 8px", marginTop: 4 }}>{label}</div>
        {items.map(renderSession)}
      </div>
    );
  };

  // Dummy projects
  const PROJECTS = [
    { id: "p1", name: "Research Notes", chats: ["Paper summaries", "Reading list cleanup", "Follow-up questions"], expanded: true },
    { id: "p2", name: "Hackathon Prep", chats: ["Workflow scaffolding", "API integration plan"], expanded: false },
  ];
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({ p1: true });
  const [projectSettingsId, setProjectSettingsId] = useState<string | null>(null);
  const settingsProject = PROJECTS.find((p) => p.id === projectSettingsId) ?? null;

  return (
    <div className="px-2 pt-2">
      {settingsProject && createPortal(
        <ProjectSettingsModal project={settingsProject} onClose={() => setProjectSettingsId(null)} />,
        document.body
      )}
      {/* Projects section */}
      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "2px 8px 6px" }}>Projects</div>
      {PROJECTS.map((proj) => {
        const isOpen = expandedProjects[proj.id] ?? proj.expanded;
        return (
          <div key={proj.id}>
            <div
              className="flex items-center gap-1.5 px-2 py-1.5 mb-0.5 rounded-md cursor-pointer hover:bg-[var(--bg-hover)]"
              onClick={() => setExpandedProjects((s) => ({ ...s, [proj.id]: !s[proj.id] }))}
            >
              {isOpen ? <ChevronDown size={11} color="var(--text-3)" /> : <ChevronRight size={11} color="var(--text-3)" />}
              <Folder size={13} color={isOpen ? "var(--accent)" : "#e89a3c"} />
              <span style={{ fontSize: 12, fontWeight: isOpen ? 600 : 500, color: isOpen ? "var(--text-1)" : "var(--text-2)", flex: 1 }} className="truncate">{proj.name}</span>
              <button
                title="Project settings"
                onClick={(e) => { e.stopPropagation(); setProjectSettingsId(proj.id); }}
                style={{ color: "var(--text-3)", background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex", opacity: 0.6 }}
              >
                <Settings size={11} />
              </button>
            </div>
            {isOpen && proj.chats.map((title, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5 mb-0.5 rounded-md cursor-pointer hover:bg-[var(--bg-hover)]" style={{ paddingLeft: 28, paddingRight: 8 }}>
                <span className="truncate" style={{ fontSize: 12, color: "var(--text-2)" }}>{title}</span>
              </div>
            ))}
          </div>
        );
      })}

      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "8px 8px 4px", marginTop: 4 }}>Recent chats</div>

      {display.length === 0 && other.length === 0 ? (
        <div style={{ padding: "12px 8px", fontSize: 12, color: "var(--text-3)" }}>
          No chats yet — start a conversation
        </div>
      ) : null}

      {renderGroup("Today", today)}
      {renderGroup("Yesterday", yesterday)}
      {renderGroup("Previous 7 days", week)}
      {renderGroup("Older", older)}

      {other.length > 0 && (
        <div>
          <div
            className="flex items-center gap-1.5 px-2 py-1.5 mb-0.5 rounded-md cursor-pointer"
            onClick={() => setShowOther((v) => !v)}
            style={{ color: "var(--text-3)" }}
          >
            {showOther ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Other workspaces</span>
            <span style={{ fontSize: 10 }}>{other.length}</span>
          </div>
          {showOther && other.map(renderSession)}
        </div>
      )}
    </div>
  );
}

// ─── File tree tab ────────────────────────────────────────────────────────────

function FileTreeTab({ tree, expandedFolders, setExpandedFolders, onOpen }: {
  tree: FileNode[];
  expandedFolders: Record<string, boolean>;
  setExpandedFolders: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onOpen: (node: FileNode) => void;
}) {
  const toggle = (name: string) => setExpandedFolders((s) => ({ ...s, [name]: !s[name] }));

  function renderNode(node: FileNode, depth = 0): React.ReactNode {
    const isExpanded = expandedFolders[node.name] ?? node.expanded ?? false;
    const indent = depth * 12 + 8;

    if (node.type === "folder") {
      const FolderIcon = getFileIcon(node.name, "folder");
      return (
        <div key={node.name}>
          <div
            className="flex items-center gap-1.5 py-1.5 mb-0.5 rounded-md cursor-pointer"
            style={{ paddingLeft: indent, paddingRight: 8, color: "var(--text-2)" }}
            onClick={() => toggle(node.name)}
          >
            {isExpanded ? <ChevronDown size={11} color="var(--text-3)" /> : <ChevronRight size={11} color="var(--text-3)" />}
            <FolderIcon size={13} color={isExpanded ? "var(--accent)" : "var(--text-3)"} />
            <span style={{ fontSize: 12, fontWeight: isExpanded ? 600 : 400, color: isExpanded ? "var(--text-1)" : "var(--text-2)" }}>{node.name}</span>
          </div>
          {isExpanded && node.children?.map((child) => renderNode(child, depth + 1))}
        </div>
      );
    }

    const FileIcon = getFileIcon(node.name, "file");
    return (
      <div
        key={node.name}
        className="flex items-center gap-1.5 py-1.5 mb-0.5 rounded-md cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
        style={{ paddingLeft: indent + 16, paddingRight: 8 }}
        onClick={() => onOpen(node)}
      >
        <FileIcon size={12} color="var(--text-3)" />
        <span style={{ fontSize: 12, color: "var(--text-2)" }}>{node.name}</span>
      </div>
    );
  }

  return (
    <div className="px-2 pt-2">
      {tree.map((node) => renderNode(node))}
    </div>
  );
}

// ─── Workflows tab ────────────────────────────────────────────────────────────

function WorkflowsTab({ activeWs }: { activeWs: ReturnType<typeof useWorkspaceStore.getState>["workspaces"][number] }) {
  const wsFlows = WORKFLOW_LIST.filter((w) => w.scope === "workspace");
  const globalFlows = WORKFLOW_LIST.filter((w) => w.scope === "global");

  return (
    <div className="px-3 py-3 flex flex-col gap-4">
      <Section label={`${activeWs.name} workflows`}>
        {wsFlows.map((wf) => <WorkflowRow key={wf.id} wf={wf} />)}
        <AddButton label="Add workflow" />
      </Section>
      <Section label="Global workflows">
        {globalFlows.map((wf) => <WorkflowRow key={wf.id} wf={wf} />)}
      </Section>
    </div>
  );
}

function WorkflowRow({ wf }: { wf: typeof WORKFLOW_LIST[number] }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "var(--bg-input)", border: "0.5px solid var(--border-subtle)" }}>
      <div className="flex flex-col flex-1 min-w-0">
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-1)" }} className="truncate">{wf.name}</span>
        <span style={{ fontSize: 10, color: "var(--text-3)" }}>{wf.trigger}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {wf.status === "active"
          ? <span style={{ fontSize: 9, fontWeight: 600, color: "var(--green)", background: "rgba(52,199,89,0.12)", borderRadius: 4, padding: "1px 6px" }}>active</span>
          : <span style={{ fontSize: 9, fontWeight: 600, color: "var(--text-3)", background: "var(--bg-active)", borderRadius: 4, padding: "1px 6px" }}>paused</span>
        }
        <Play size={12} color="var(--text-3)" style={{ cursor: "pointer" }} />
      </div>
    </div>
  );
}

// ─── Settings tab ─────────────────────────────────────────────────────────────

function SettingsTab({ activeWs }: { activeWs: ReturnType<typeof useWorkspaceStore.getState>["workspaces"][number] }) {
  const [inheritSecrets, setInheritSecrets] = useState(!activeWs.isGlobal);
  const [cloudSync, setCloudSync] = useState(false);
  const [euOnly, setEuOnly] = useState(false);
  const [localOnly, setLocalOnly] = useState(false);

  return (
    <div className="px-3 py-3 flex flex-col gap-4">
      {/* Path */}
      <div className="flex flex-col gap-1.5">
        <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Working directory</label>
        <div className="px-3 py-2 rounded-lg" style={{ background: "var(--bg-input)", border: "0.5px solid var(--border)", fontFamily: "monospace", fontSize: 11, color: "var(--text-2)" }}>
          {activeWs.cwd}
        </div>
      </div>

      {/* Secrets */}
      <div className="flex flex-col gap-2">
        <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Secrets</label>
        {activeWs.isGlobal ? (
          <div className="flex flex-col gap-1.5">
            {[
              { key: "ANTHROPIC_API_KEY", preview: "sk-ant-api03-••••3a7f" },
              { key: "OPENAI_API_KEY", preview: "sk-proj-••••9d2c" },
              { key: "GITHUB_TOKEN", preview: "ghp_••••4k1m" },
            ].map((s) => (
              <div key={s.key} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "var(--bg-input)", border: "0.5px solid var(--border-subtle)" }}>
                <Key size={11} color="var(--accent)" />
                <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-1)", flex: 1 }}>{s.key}</span>
                <span style={{ fontSize: 10, color: "var(--text-3)", fontFamily: "monospace" }}>{s.preview}</span>
              </div>
            ))}
            <AddButton label="Add secret" />
          </div>
        ) : (
          <ToggleRow icon={<Lock size={13} color="var(--accent)" />} title="Inherit global secrets" desc="API keys from Global workspace" value={inheritSecrets} onChange={setInheritSecrets} />
        )}
      </div>

      {/* Storage */}
      <div className="flex flex-col gap-2">
        <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Storage</label>
        <ToggleRow
          icon={cloudSync ? <Cloud size={13} color="var(--accent)" /> : <HardDrive size={13} color="var(--text-3)" />}
          title={cloudSync ? "Cloud sync" : "Local only"}
          desc={cloudSync ? "Synced via rclone" : "Files stay on this machine"}
          value={cloudSync}
          onChange={setCloudSync}
        />
      </div>

      {activeWs.isGlobal && (
        <div className="flex flex-col gap-2">
          <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Inheritance</label>
          <div className="px-3 py-2 rounded-lg" style={{ background: "var(--accent-soft)", border: "0.5px solid var(--accent-border)", fontSize: 11, color: "var(--accent)" }}>
            All child workspaces inherit secrets from this Global workspace unless overridden.
          </div>
        </div>
      )}

      {/* Data protection */}
      <div className="flex flex-col gap-2">
        <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Data Protection</label>
        <div className="px-3 py-2 rounded-lg text-[11px]" style={{ background: "rgba(52,199,89,0.08)", border: "0.5px solid rgba(52,199,89,0.25)", color: "var(--green)" }}>
          Per-workspace data residency — restrict which models can process data in this workspace.
        </div>
        <ToggleRow icon={<span style={{ fontSize: 13 }}>🇪🇺</span>} title="EU models only" desc="Mistral AI, EU Azure endpoints" value={euOnly} onChange={setEuOnly} />
        <ToggleRow icon={<HardDrive size={13} color="var(--text-3)" />} title="Local models only" desc="Ollama — no data leaves your machine" value={localOnly} onChange={setLocalOnly} />
      </div>

      {/* Plugins & Skills */}
      <div className="flex flex-col gap-2">
        <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Extensions</label>
        <button
          onClick={() => useChatStore.getState().setExtensionsModalOpen(true)}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl w-full text-left transition-all"
          style={{ background: "var(--bg-input)", border: "0.5px solid var(--border-subtle)", cursor: "pointer" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--bg-input)")}
        >
          <Package size={14} color="var(--accent)" />
          <div className="flex flex-col flex-1">
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-1)" }}>Plugins &amp; Skills</span>
            <span style={{ fontSize: 10, color: "var(--text-3)" }}>Browse installed plugins, skills, MCP servers</span>
          </div>
        </button>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function AddButton({ label }: { label: string }) {
  return (
    <button className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px]" style={{ border: "1px dashed var(--border)", color: "var(--accent)", background: "transparent", cursor: "pointer", width: "100%" }}>
      <Plus size={11} /> {label}
    </button>
  );
}

function ToggleRow({ icon, title, desc, value, onChange }: { icon: React.ReactNode; title: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "var(--bg-input)", border: "0.5px solid var(--border-subtle)" }}>
      {icon}
      <div className="flex flex-col flex-1">
        <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-1)" }}>{title}</span>
        <span style={{ fontSize: 10, color: "var(--text-3)" }}>{desc}</span>
      </div>
      <Toggle value={value} onChange={onChange} />
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} style={{ width: 32, height: 18, borderRadius: 9, background: value ? "var(--accent)" : "var(--bg-active)", border: "none", cursor: "pointer", position: "relative", transition: "background 0.15s", flexShrink: 0 }}>
      <div style={{ position: "absolute", top: 2, left: value ? 16 : 2, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left 0.15s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
    </button>
  );
}

// ─── Project Settings Modal ────────────────────────────────────────────────────

const TEAM_MEMBERS = [
  { name: "Alex K.", role: "Owner", avatar: "A" },
  { name: "Jamie R.", role: "Editor", avatar: "J" },
  { name: "Sam P.", role: "Editor", avatar: "S" },
  { name: "Morgan L.", role: "Viewer", avatar: "M" },
];

const PROJECT_MEMORY = [
  { name: "user.md", desc: "User profile & preferences" },
  { name: "feedback.md", desc: "Agent feedback rules" },
  { name: "project.md", desc: "Project context & goals" },
];

const PROJECT_DOCS = [
  { name: "dataset.parquet", size: "142K rows" },
  { name: "roadmap-2026.pdf", size: "8.4 MB" },
  { name: "results.csv", size: "1.2 MB" },
];

function ProjectSettingsModal({ project, onClose }: { project: { id: string; name: string }; onClose: () => void }) {
  const [tab, setTab] = useState<"general" | "memory" | "documents">("general");
  const [shared, setShared] = useState(true);
  const [name, setName] = useState(project.name);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-overlay)" }} onClick={onClose}>
      <div style={{ width: 760, maxWidth: "90vw", maxHeight: "80vh", borderRadius: 18, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg-modal)", border: "1px solid var(--border)", boxShadow: "var(--shadow-modal)" }} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 pt-5 pb-0 flex items-center gap-3" style={{ borderBottom: "0.5px solid var(--border)" }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(232,154,60,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Folder size={16} color="#e89a3c" />
          </div>
          <div className="flex-1">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ fontSize: 15, fontWeight: 600, color: "var(--text-1)", background: "none", border: "none", outline: "none", width: "100%" }}
            />
            <div style={{ fontSize: 11, color: "var(--text-3)" }}>Project · {PROJECT_DOCS.length} documents · {PROJECT_MEMORY.length} memory files</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex px-5 gap-1 pt-1" style={{ borderBottom: "0.5px solid var(--border)" }}>
          {(["general", "memory", "documents"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{ fontSize: 12, fontWeight: tab === t ? 600 : 400, color: tab === t ? "var(--text-1)" : "var(--text-3)", background: "none", border: "none", cursor: "pointer", padding: "8px 10px", borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent", textTransform: "capitalize" }}>
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">

          {tab === "general" && (
            <div className="flex flex-col gap-5">
              {/* Team sharing */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)" }}>Shared with team</div>
                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>Team members can view chats and memory in this project</div>
                  </div>
                  <Toggle value={shared} onChange={setShared} />
                </div>
                {shared && (
                  <div className="flex flex-col gap-1.5">
                    {TEAM_MEMBERS.map((m) => (
                      <div key={m.name} className="flex items-center gap-2.5 px-3 py-2 rounded-xl" style={{ background: "var(--bg-input)", border: "0.5px solid var(--border-subtle)" }}>
                        <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "var(--accent)", flexShrink: 0 }}>{m.avatar}</div>
                        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-1)", flex: 1 }}>{m.name}</span>
                        <span style={{ fontSize: 10, color: "var(--text-3)", background: "var(--bg-active)", padding: "1px 7px", borderRadius: 4 }}>{m.role}</span>
                      </div>
                    ))}
                    <button className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px]" style={{ border: "1px dashed var(--border)", color: "var(--accent)", background: "transparent", cursor: "pointer" }}>
                      <Plus size={11} /> Invite member
                    </button>
                  </div>
                )}
              </div>

              {/* Workspace */}
              <div className="flex flex-col gap-1.5">
                <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Workspace</label>
                <div className="px-3 py-2 rounded-lg flex items-center gap-2" style={{ background: "var(--bg-input)", border: "0.5px solid var(--border)" }}>
                  <Globe size={13} color="var(--accent)" />
                  <span style={{ fontSize: 12, color: "var(--text-2)" }}>Global</span>
                </div>
              </div>
            </div>
          )}

          {tab === "memory" && (
            <div className="flex flex-col gap-2">
              <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 8 }}>Memory files scoped to this project. The AI reads these on every session.</p>
              {PROJECT_MEMORY.map((f) => (
                <div key={f.name} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl" style={{ background: "var(--bg-input)", border: "0.5px solid var(--border-subtle)" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>📄</div>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-1)" }}>{f.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>{f.desc}</div>
                  </div>
                  <button style={{ color: "var(--text-3)", background: "none", border: "none", cursor: "pointer", fontSize: 11 }}>Edit</button>
                </div>
              ))}
              <button className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] mt-1" style={{ border: "1px dashed var(--border)", color: "var(--accent)", background: "transparent", cursor: "pointer" }}>
                <Plus size={11} /> Add memory file
              </button>
            </div>
          )}

          {tab === "documents" && (
            <div className="flex flex-col gap-2">
              <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 8 }}>Documents available to the AI as context in this project.</p>
              {PROJECT_DOCS.map((f) => (
                <div key={f.name} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl" style={{ background: "var(--bg-input)", border: "0.5px solid var(--border-subtle)" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--bg-active)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>
                    {f.name.endsWith(".pdf") ? "📋" : f.name.endsWith(".csv") ? "📊" : "🗂️"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-1)" }} className="truncate">{f.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>{f.size}</div>
                  </div>
                  <button style={{ color: "var(--text-3)", background: "none", border: "none", cursor: "pointer", fontSize: 11 }}>Remove</button>
                </div>
              ))}
              <button className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] mt-1" style={{ border: "1px dashed var(--border)", color: "var(--accent)", background: "transparent", cursor: "pointer" }}>
                <Plus size={11} /> Attach document
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 flex justify-end gap-2" style={{ borderTop: "0.5px solid var(--border)" }}>
          <button onClick={onClose} style={{ fontSize: 12, color: "var(--text-2)", background: "var(--bg-input)", border: "0.5px solid var(--border)", borderRadius: 8, padding: "6px 14px", cursor: "pointer" }}>Cancel</button>
          <button onClick={onClose} style={{ fontSize: 12, color: "#fff", background: "var(--accent)", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontWeight: 500 }}>Save</button>
        </div>
      </div>
    </div>
  );
}
