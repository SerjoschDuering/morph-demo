import type { ComponentType } from "react";
import { useState } from "react";
import { Globe, Briefcase, User, Shield, Plus, Sparkles } from "lucide-react";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { NewWorkspaceDialog } from "./NewWorkspaceDialog";
import { MorphAboutModal } from "./MorphAboutModal";

const ICON_MAP: Record<string, ComponentType<{ size?: number; color?: string }>> = {
  globe: Globe,
  briefcase: Briefcase,
  user: User,
  shield: Shield,
};

interface Props {
  onOpenSettings: () => void;
  onThemeToggle: () => void;
  theme: string;
}

export function WorkspaceRail({ onOpenSettings: _onOpenSettings, onThemeToggle, theme }: Props) {
  const { workspaces, activeWorkspaceId, switchWorkspace } = useWorkspaceStore();
  const globalWs = workspaces.find((w) => w.isGlobal);
  const userWorkspaces = workspaces.filter((w) => !w.isGlobal);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <div
      className="w-[52px] shrink-0 flex flex-col items-center py-3 glass-heavy"
      style={{ background: "var(--bg-rail)", borderRight: "0.5px solid var(--border)" }}
    >
      {/* Morph logo */}
      <button
        className="morph-logo-btn w-9 h-9 rounded-[10px] flex items-center justify-center mb-3 shrink-0"
        onClick={() => setAboutOpen(true)}
        style={{
          background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
          boxShadow: "0 2px 6px rgba(139,92,246,0.3)",
          border: "none",
          cursor: "pointer",
          padding: 0,
        }}
        title="About Morph"
      >
        <Sparkles size={16} color="#fff" />
      </button>

      {/* Global workspace */}
      {globalWs && (
        <WsButton
          workspace={globalWs}
          isActive={activeWorkspaceId === globalWs.id}
          onClick={() => switchWorkspace(globalWs.id)}
        />
      )}

      {/* Separator */}
      <div style={{ width: 20, height: 0.5, background: "var(--border)", margin: "6px auto" }} />

      {/* User workspaces */}
      {userWorkspaces.map((ws) => (
        <WsButton
          key={ws.id}
          workspace={ws}
          isActive={activeWorkspaceId === ws.id}
          onClick={() => switchWorkspace(ws.id)}
        />
      ))}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Theme toggle */}
      <button
        onClick={onThemeToggle}
        className="w-8 h-8 rounded-full flex items-center justify-center mb-1"
        style={{ background: "var(--bg-hover)", border: "0.5px solid var(--border)", cursor: "pointer" }}
        title={`Theme: ${theme}`}
      >
        <span style={{ fontSize: 11 }}>{theme === "dark" ? "☀" : theme === "light" ? "◑" : "◐"}</span>
      </button>

      {/* Add workspace */}
      <div
        className="ws-btn w-10 h-10 rounded-[12px] flex items-center justify-center cursor-pointer"
        style={{ border: "1.5px dashed var(--border)", color: "var(--text-3)" }}
        onClick={() => setShowNewDialog(true)}
      >
        <Plus size={16} />
        <div className="ws-tip">New workspace</div>
      </div>

      {aboutOpen && <MorphAboutModal onClose={() => setAboutOpen(false)} />}
      {showNewDialog && <NewWorkspaceDialog onClose={() => setShowNewDialog(false)} />}
    </div>
  );
}

function WsButton({
  workspace,
  isActive,
  onClick,
}: {
  workspace: import("../stores/workspaceStore").Workspace;
  isActive: boolean;
  onClick: () => void;
}) {
  const Icon = ICON_MAP[workspace.icon] ?? Globe;
  return (
    <button
      className={`ws-btn w-10 h-10 rounded-[12px] flex items-center justify-center mb-2 ${isActive ? "active" : ""}`}
      style={{
        background: isActive ? "var(--accent-soft)" : "var(--bg-hover)",
        boxShadow: isActive ? "var(--glow-active)" : "none",
        border: "none",
        cursor: "pointer",
      }}
      onClick={onClick}
      title={workspace.name}
    >
      <Icon size={20} color={isActive ? "var(--accent)" : "var(--text-2)"} />
      <div className="ws-tip">{workspace.name}</div>
    </button>
  );
}
