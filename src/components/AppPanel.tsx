import {
  Lock, Maximize2,
  Notebook, Receipt, CalendarDays, Compass, Globe, Briefcase, FileText,
  Code, Map, Music, Video, Image, Database, Settings, Star, Zap, Box,
} from "lucide-react";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { AppTabContent } from "./AppTab";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  notebook: Notebook, receipt: Receipt, calendar: CalendarDays, compass: Compass,
  globe: Globe, briefcase: Briefcase, "file-text": FileText, code: Code,
  map: Map, music: Music, video: Video, image: Image, database: Database,
  settings: Settings, star: Star, zap: Zap, box: Box,
};

interface AppPanelProps {
  focusMode: boolean;
  onToggleFocus: () => void;
  onCollapseApps: () => void;
}

export function AppPanel({ focusMode, onToggleFocus, onCollapseApps }: AppPanelProps) {
  const { workspaces, activeWorkspaceId, setActiveTab } = useWorkspaceStore();
  const ws = workspaces.find((w) => w.id === activeWorkspaceId);
  const apps = ws?.apps ?? [];
  const activeTabId = ws?.activeTabId ?? null;
  const activeTab = apps.find((a) => a.id === activeTabId) ?? apps[0];

  if (apps.length === 0) {
    return null;
  }

  return (
    <div
      className="flex-1 flex min-w-0"
      style={{ background: "var(--bg-panel)" }}
    >
      {/* Vertical app icon rail — same size as collapsed mode */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        width: 72,
        flexShrink: 0,
        borderRight: "0.5px solid var(--border)",
        padding: "10px 8px",
        gap: 6,
        overflowY: "auto",
        overflowX: "hidden",
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
          {apps.map((app) => {
            const isActive = app.id === activeTab?.id;
            const IconComp = ICON_MAP[app.icon ?? ""] ?? Box;

            return (
              <div key={app.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <button
                  title={app.name}
                  onClick={() => {
                    if (isActive) {
                      onCollapseApps();
                    } else {
                      setActiveTab(activeWorkspaceId, app.id);
                    }
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
                  {app.sharesState && app.status === "ready" && (
                    <div style={{
                      position: "absolute", top: 4, right: 4,
                      width: 5, height: 5, borderRadius: "50%",
                      background: "var(--green)", boxShadow: "0 0 3px var(--green)",
                    }} />
                  )}
                  {app.status === "compiling" && (
                    <div style={{
                      position: "absolute", top: 4, right: 4,
                      width: 5, height: 5, borderRadius: "50%",
                      background: "var(--amber)",
                    }} />
                  )}
                  {app.status === "error" && (
                    <div style={{
                      position: "absolute", top: 4, right: 4,
                      width: 5, height: 5, borderRadius: "50%",
                      background: "#ef4444",
                    }} />
                  )}
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

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
          <button
            onClick={onToggleFocus}
            title={focusMode ? "Exit focus mode" : "Focus mode"}
            style={{
              width: 36, height: 36, borderRadius: 10,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: focusMode ? "var(--accent)" : "var(--text-3)",
              background: "transparent", border: "none", cursor: "pointer",
            }}
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </div>

      {/* App content — all apps stay mounted, inactive ones hidden */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0" style={{ position: "relative", isolation: "isolate" }}>
        {apps.map((app) => (
          <div
            key={app.id}
            className="flex-1 flex flex-col min-h-0"
            style={{ display: app.id === activeTab?.id ? "flex" : "none" }}
          >
            <AppTabContent tab={app} />
          </div>
        ))}
      </div>
    </div>
  );
}
