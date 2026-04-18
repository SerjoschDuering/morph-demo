import { useState } from "react";
import { X } from "lucide-react";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { SecretsPanel } from "./SecretsPanel";
import { ScriptsPanel } from "./ScriptsPanel";
import { PluginsPanel } from "./PluginsPanel";
import { AutomationsPanel } from "./AutomationsPanel";
import { GeneralPanel } from "./GeneralPanel";

interface Props {
  open: boolean;
  onClose: () => void;
}

const TABS = [
  { id: "secrets",     label: "Secrets",     emoji: "🔑" },
  { id: "scripts",     label: "Scripts",     emoji: "📜" },
  { id: "plugins",     label: "Plugins",     emoji: "🔌" },
  { id: "automations", label: "Automations", emoji: "⚡" },
  { id: "general",     label: "General",     emoji: "⚙" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function SettingsModal({ open, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("secrets");
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId);

  if (!open) return null;

  return (
    /* Backdrop */
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 500,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.3)",
        backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Modal container */}
      <div
        className="fade-in"
        style={{
          width: 700, maxWidth: "calc(100vw - 40px)",
          height: 520, maxHeight: "calc(100vh - 80px)",
          borderRadius: 16, overflow: "hidden",
          display: "flex", flexDirection: "column",
          background: "var(--bg-modal)",
          backdropFilter: "blur(40px)", WebkitBackdropFilter: "blur(40px)",
          border: "0.5px solid var(--border)",
          boxShadow: "var(--shadow-modal)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex", alignItems: "center", padding: "16px 20px 0",
            borderBottom: "0.5px solid var(--border)", flexShrink: 0,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-1)" }}>
              {activeWs?.name ?? "Workspace"} Settings
            </div>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 1, fontFamily: "monospace" }}>
              {activeWs?.cwd ?? "~/workspaces"}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "var(--bg-hover)", border: "0.5px solid var(--border)",
              cursor: "pointer", color: "var(--text-2)",
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Tab bar */}
        <div
          style={{
            display: "flex", padding: "0 20px", flexShrink: 0,
            borderBottom: "0.5px solid var(--border)",
          }}
        >
          {TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "10px 14px", fontSize: 13, fontWeight: 500,
                  color: isActive ? "var(--text-1)" : "var(--text-2)",
                  background: "transparent", border: "none",
                  borderBottom: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                  cursor: "pointer", transition: "all 0.12s",
                  marginBottom: -1,
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = "var(--text-1)"; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = "var(--text-2)"; }}
              >
                <span style={{ fontSize: 14 }}>{tab.emoji}</span>
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content area */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {activeTab === "secrets"     && <SecretsPanel />}
          {activeTab === "scripts"     && <ScriptsPanel />}
          {activeTab === "plugins"     && <PluginsPanel />}
          {activeTab === "automations" && <AutomationsPanel />}
          {activeTab === "general"     && <GeneralPanel />}
        </div>
      </div>
    </div>
  );
}
