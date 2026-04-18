import type { ComponentType } from "react";
import { useWorkspaceStore } from "../stores/workspaceStore";
import {
  Notebook, Receipt, Calendar, Compass, Globe, Briefcase, FileText,
  Code, Map, Music, Video, Image, Database, Settings, Star, Zap, Box,
} from "lucide-react";

const ICON_MAP: Record<string, ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  notebook: Notebook,
  receipt: Receipt,
  calendar: Calendar,
  compass: Compass,
  globe: Globe,
  briefcase: Briefcase,
  "file-text": FileText,
  code: Code,
  map: Map,
  music: Music,
  video: Video,
  image: Image,
  database: Database,
  settings: Settings,
  star: Star,
  zap: Zap,
  box: Box,
};

interface Props {
  onExpand: (appId: string) => void;
}

export function MiniThumbnailBar({ onExpand }: Props) {
  const { workspaces, activeWorkspaceId, setActiveTab } = useWorkspaceStore();
  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId);
  const apps = activeWs?.apps ?? [];

  if (apps.length === 0) return null;

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: 6,
      padding: "10px 8px",
      overflowY: "auto",
      width: 72,
      flexShrink: 0,
    }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
        {apps.map((app) => {
          const isActive = activeWs?.activeTabId === app.id;
          const IconComp = ICON_MAP[app.icon ?? ""] ?? Box;
          return (
            <div key={app.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <button
                title={app.name}
                onClick={() => {
                  setActiveTab(activeWorkspaceId, app.id);
                  onExpand(app.id);
                }}
                style={{
                  width: 54,
                  height: 54,
                  background: isActive ? "var(--accent-soft)" : "var(--bg-hover)",
                  border: `0.5px solid ${isActive ? "var(--accent-border)" : "var(--border)"}`,
                  boxShadow: isActive ? "var(--glow-active)" : "none",
                  borderRadius: 12,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                  position: "relative",
                  transition: "all 0.12s",
                }}
              >
                {/* Status dot */}
                <div style={{
                  position: "absolute",
                  top: 5,
                  right: 5,
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: app.status === "ready" ? "var(--green)" : app.status === "error" ? "#ef4444" : "var(--amber)",
                }} />
                <IconComp
                  size={24}
                  color={isActive ? "var(--accent)" : "var(--text-2)"}
                  strokeWidth={1.5}
                />
              </button>
              <span style={{
                fontSize: 9,
                fontWeight: 500,
                color: isActive ? "var(--accent)" : "var(--text-3)",
                textAlign: "center",
                lineHeight: 1.1,
                maxWidth: 60,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {app.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
