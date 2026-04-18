import { useState } from "react";
import { createPortal } from "react-dom";
import { Globe, Briefcase, User, Shield, Cloud, HardDrive, Lock, X } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useWorkspaceStore } from "../stores/workspaceStore";

const ICONS = [
  { key: "globe", Icon: Globe },
  { key: "briefcase", Icon: Briefcase },
  { key: "user", Icon: User },
  { key: "shield", Icon: Shield },
] as const;

interface Props {
  onClose: () => void;
}

export function NewWorkspaceDialog({ onClose }: Props) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string>("globe");
  const [cwd, setCwd] = useState<string | null>(null);
  const [inheritSecrets, setInheritSecrets] = useState(true);
  const [cloudSync, setCloudSync] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !cwd) return;
    useWorkspaceStore.getState().addWorkspace({ name: name.trim(), icon, cwd });
    onClose();
  };

  const dialog = (
    <div
      className="modal-overlay"
      style={{ position: "fixed", zIndex: 300 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="fade-in"
        style={{
          width: 380,
          borderRadius: 16,
          background: "var(--bg-modal)",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
          border: "0.5px solid var(--border)",
          boxShadow: "var(--shadow-modal)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center px-5 py-4"
          style={{ borderBottom: "0.5px solid var(--border-subtle)" }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-1)" }}>New Workspace</span>
          <button
            onClick={onClose}
            className="ml-auto w-6 h-6 flex items-center justify-center rounded-full"
            style={{ background: "var(--bg-hover)", border: "none", cursor: "pointer", color: "var(--text-3)" }}
          >
            <X size={12} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-2)" }}>Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") onClose(); }}
              placeholder="My Workspace"
              style={{
                fontSize: 13,
                color: "var(--text-1)",
                background: "var(--bg-input)",
                border: "0.5px solid var(--border)",
                borderRadius: 8,
                padding: "8px 12px",
                outline: "none",
                width: "100%",
              }}
            />
          </div>

          {/* Icon picker */}
          <div className="flex flex-col gap-1.5">
            <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-2)" }}>Icon</label>
            <div className="flex gap-2">
              {ICONS.map(({ key, Icon }) => (
                <button
                  key={key}
                  onClick={() => setIcon(key)}
                  className="w-9 h-9 rounded-[10px] flex items-center justify-center transition-all"
                  style={{
                    background: icon === key ? "var(--accent-soft)" : "var(--bg-hover)",
                    border: icon === key ? "1.5px solid var(--accent-border)" : "0.5px solid var(--border)",
                    cursor: "pointer",
                  }}
                >
                  <Icon size={16} color={icon === key ? "var(--accent)" : "var(--text-2)"} />
                </button>
              ))}
            </div>
          </div>

          {/* Folder picker */}
          <div className="flex flex-col gap-1.5">
            <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-2)" }}>Folder</label>
            <button
              onClick={async () => {
                const selected = await open({ directory: true, title: "Choose workspace folder" });
                if (selected) setCwd(selected as string);
              }}
              style={{
                fontSize: 12,
                color: cwd ? "var(--text-1)" : "var(--text-3)",
                background: "var(--bg-input)",
                border: "0.5px solid var(--border)",
                borderRadius: 8,
                padding: "8px 12px",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              {cwd ?? "Choose folder..."}
            </button>
          </div>

          {/* Inherit global secrets */}
          <div
            className="flex items-center gap-3 px-3 py-3 rounded-xl"
            style={{ background: "var(--bg-input)", border: "0.5px solid var(--border-subtle)" }}
          >
            <Lock size={15} color="var(--accent)" />
            <div className="flex flex-col flex-1">
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-1)" }}>Inherit global secrets</span>
              <span style={{ fontSize: 11, color: "var(--text-3)" }}>API keys from the Global workspace are available here</span>
            </div>
            <Toggle value={inheritSecrets} onChange={setInheritSecrets} />
          </div>

          {/* Cloud sync */}
          <div
            className="flex items-center gap-3 px-3 py-3 rounded-xl"
            style={{ background: "var(--bg-input)", border: "0.5px solid var(--border-subtle)" }}
          >
            {cloudSync ? <Cloud size={15} color="var(--accent)" /> : <HardDrive size={15} color="var(--text-3)" />}
            <div className="flex flex-col flex-1">
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-1)" }}>
                {cloudSync ? "Cloud sync" : "Local only"}
              </span>
              <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                {cloudSync ? "Workspace synced via rclone to your cloud" : "Workspace stays on this machine"}
              </span>
            </div>
            <Toggle value={cloudSync} onChange={setCloudSync} />
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-3"
          style={{ borderTop: "0.5px solid var(--border-subtle)" }}
        >
          <button
            onClick={onClose}
            style={{
              fontSize: 13,
              color: "var(--text-2)",
              background: "var(--bg-hover)",
              border: "0.5px solid var(--border)",
              borderRadius: 20,
              padding: "6px 16px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || !cwd}
            className="btn-primary"
            style={{ opacity: name.trim() && cwd ? 1 : 0.4 }}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
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
