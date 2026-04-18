import { useState } from "react";
import { Cloud, HardDrive, Lock, Key, FileText, Zap } from "lucide-react";
import { useWorkspaceStore } from "../stores/workspaceStore";

interface Props {
  tab: "context" | "scripts" | "settings";
}

export function WorkspacePanel({ tab }: Props) {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const ws = workspaces.find((w) => w.id === activeWorkspaceId);
  const isGlobal = ws?.isGlobal;

  if (tab === "context") return <ContextTab cwd={ws?.cwd ?? ""} isGlobal={isGlobal} />;
  if (tab === "scripts") return <ScriptsTab />;
  return <SettingsTab ws={ws} />;
}

function ContextTab({ cwd, isGlobal }: { cwd: string; isGlobal?: boolean }) {
  const placeholder = isGlobal
    ? `# Global Workspace Context\n\nThis context is inherited by all workspaces.\n\n## Global Secrets\n- ANTHROPIC_API_KEY is set\n- OPENAI_API_KEY is set\n\n## Instructions\nAdd instructions here that apply to all your workspaces.`
    : `# Workspace Context\n\nAdd instructions specific to this workspace.\nThe agent reads this file at the start of every session.\n\n## Project\n\n## Tech Stack\n\n## Notes`;

  const [value, setValue] = useState(placeholder);

  return (
    <div className="flex flex-col flex-1 min-h-0 px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <FileText size={13} color="var(--text-3)" />
        <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "monospace" }}>
          {cwd}/CLAUDE.md
        </span>
        {isGlobal && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: "var(--accent)",
              background: "var(--accent-soft)",
              border: "0.5px solid var(--accent-border)",
              borderRadius: 4,
              padding: "1px 6px",
              marginLeft: "auto",
            }}
          >
            inherited by all
          </span>
        )}
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        style={{
          flex: 1,
          resize: "none",
          fontSize: 12,
          lineHeight: 1.6,
          fontFamily: "monospace",
          color: "var(--text-1)",
          background: "var(--bg-input)",
          border: "0.5px solid var(--border)",
          borderRadius: 10,
          padding: "12px 14px",
          outline: "none",
        }}
      />
    </div>
  );
}

function ScriptsTab() {
  const SCRIPTS = [
    { icon: "🗺️", name: "Fetch Overture Maps", desc: "Download building + road data for a bounding box", tag: "geo" },
    { icon: "📊", name: "Generate KPI Dashboard", desc: "Build a live data app from a CSV", tag: "data" },
    { icon: "🔍", name: "RAG Index Workspace", desc: "Re-index all files for semantic search", tag: "memory" },
    { icon: "🧹", name: "Clean App Artifacts", desc: "Remove compiled blobs and reset app tabs", tag: "system" },
  ];

  return (
    <div className="flex flex-col gap-2 px-4 py-3 overflow-y-auto">
      <div className="flex items-center gap-2 mb-1">
        <Zap size={13} color="var(--text-3)" />
        <span style={{ fontSize: 11, color: "var(--text-3)" }}>Quick scripts</span>
      </div>
      {SCRIPTS.map((s) => (
        <button
          key={s.name}
          className="flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
          style={{
            background: "var(--bg-input)",
            border: "0.5px solid var(--border-subtle)",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--bg-input)")}
        >
          <span style={{ fontSize: 18, lineHeight: 1.2 }}>{s.icon}</span>
          <div className="flex flex-col">
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-1)" }}>{s.name}</span>
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>{s.desc}</span>
          </div>
          <span
            style={{
              marginLeft: "auto",
              fontSize: 10,
              fontWeight: 500,
              color: "var(--text-3)",
              background: "var(--bg-active)",
              borderRadius: 4,
              padding: "1px 6px",
              alignSelf: "center",
              flexShrink: 0,
            }}
          >
            {s.tag}
          </span>
        </button>
      ))}
    </div>
  );
}

function SettingsTab({ ws }: { ws: ReturnType<typeof useWorkspaceStore.getState>["workspaces"][number] | undefined }) {
  const [inheritSecrets, setInheritSecrets] = useState(!ws?.isGlobal);
  const [cloudSync, setCloudSync] = useState(false);

  return (
    <div className="flex flex-col gap-3 px-4 py-3 overflow-y-auto">
      {/* Workspace path */}
      <div className="flex flex-col gap-1.5">
        <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-2)" }}>Working directory</label>
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ background: "var(--bg-input)", border: "0.5px solid var(--border)", fontFamily: "monospace", fontSize: 12, color: "var(--text-2)" }}
        >
          {ws?.cwd ?? "~"}
        </div>
      </div>

      {/* Secrets */}
      <div className="flex flex-col gap-2">
        <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-2)" }}>Secrets &amp; access</label>

        {ws?.isGlobal ? (
          <div className="flex flex-col gap-2">
            {[
              { key: "ANTHROPIC_API_KEY", preview: "sk-ant-api03-••••••••3a7f" },
              { key: "OPENAI_API_KEY", preview: "sk-proj-••••••••9d2c" },
              { key: "GITHUB_TOKEN", preview: "ghp_••••••••4k1m" },
            ].map((s) => (
              <div
                key={s.key}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                style={{ background: "var(--bg-input)", border: "0.5px solid var(--border-subtle)" }}
              >
                <Key size={13} color="var(--accent)" />
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-1)", flex: 1 }}>{s.key}</span>
                <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "monospace" }}>{s.preview}</span>
              </div>
            ))}
            <button
              style={{
                fontSize: 12,
                color: "var(--accent)",
                background: "var(--accent-soft)",
                border: "0.5px solid var(--accent-border)",
                borderRadius: 8,
                padding: "7px 14px",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              + Add secret
            </button>
          </div>
        ) : (
          <Row icon={<Lock size={14} color="var(--accent)" />} title="Inherit global secrets" desc="API keys from Global workspace">
            <Toggle value={inheritSecrets} onChange={setInheritSecrets} />
          </Row>
        )}
      </div>

      {/* Cloud sync */}
      <div className="flex flex-col gap-2">
        <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-2)" }}>Storage</label>
        <Row
          icon={cloudSync ? <Cloud size={14} color="var(--accent)" /> : <HardDrive size={14} color="var(--text-3)" />}
          title={cloudSync ? "Cloud sync enabled" : "Local only"}
          desc={cloudSync ? "Synced via rclone" : "Files stay on this machine"}
        >
          <Toggle value={cloudSync} onChange={setCloudSync} />
        </Row>
      </div>
    </div>
  );
}

function Row({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
      style={{ background: "var(--bg-input)", border: "0.5px solid var(--border-subtle)" }}
    >
      {icon}
      <div className="flex flex-col flex-1">
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-1)" }}>{title}</span>
        <span style={{ fontSize: 11, color: "var(--text-3)" }}>{desc}</span>
      </div>
      {children}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        background: value ? "var(--accent)" : "var(--bg-active)",
        border: "none",
        cursor: "pointer",
        position: "relative",
        transition: "background 0.15s",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 3,
          left: value ? 19 : 3,
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.15s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }}
      />
    </button>
  );
}
