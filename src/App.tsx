import { useEffect, useState, useCallback, useRef, lazy, Suspense } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { open } from "@tauri-apps/plugin-dialog";
import { useChatStore } from "./stores/chatStore";
import { useWorkspaceStore, type MorphAppManifest } from "./stores/workspaceStore";
import { useSettingsStore, resolveTheme } from "./stores/settingsStore";
import { useBridge } from "./hooks/useBridge";
import { useEsbuildInit } from "./hooks/useEsbuild";
import markdownNotesSource from './apps/markdown-notes.tsx?raw';
import travelSource from './apps/travel-companion.tsx?raw';
import taxSource from './apps/tax-assistant.tsx?raw';
import calendarSource from './apps/calendar.tsx?raw';
import aiStudioSource from './apps/ai-studio.tsx?raw';
// CI demo: shared data as window global (esbuild-wasm has no filesystem for local imports)
import * as CIData from './apps/ci-data';
(window as any).CIData = CIData;
// CI demo apps
import ciEntityNetworkSource from './apps/ci-entity-network.tsx?raw';
import ciEntityProfileSource from './apps/ci-entity-profile.tsx?raw';
import ciIntelMapSource from './apps/ci-intel-map.tsx?raw';
import ciPowerRankingsSource from './apps/ci-power-rankings.tsx?raw';
import ciSignalFeedSource from './apps/ci-signal-feed.tsx?raw';
import ciCapexTrackerSource from './apps/ci-capex-tracker.tsx?raw';
import ciTimelineSource from './apps/ci-timeline.tsx?raw';
import ciThreatMatrixSource from './apps/ci-threat-matrix.tsx?raw';
import ciScenarioModelerSource from './apps/ci-scenario-modeler.tsx?raw';
import ciMysteryDossierSource from './apps/ci-mystery-dossier.tsx?raw';
import { ChatPanel } from "./components/ChatPanel";
import { PermissionDialog } from "./components/PermissionDialog";
import { WorkspaceRail } from "./components/WorkspaceRail";
import { ChatSidebar } from "./components/ChatSidebar";
import { AppPanel } from "./components/AppPanel";
import { SettingsModal } from "./components/management/SettingsModal";
import { MiniThumbnailBar } from "./components/MiniThumbnail";
import { ExtensionsModal } from "./components/ExtensionsModal";

const SessionViz = lazy(() =>
  import("./features/session-viz").then((m) => ({ default: m.SessionViz }))
);

export default function App() {
  const { cwd, permissionQueue } = useChatStore();
  const bridge = useBridge();
  useEsbuildInit();
  const theme = useSettingsStore(s => s.theme);
  const setTheme = useSettingsStore(s => s.setTheme);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);
  const [vizSessionId, setVizSessionId] = useState<string | null>(null);
  const [vizSessionCwd, setVizSessionCwd] = useState("");
  const [focusMode, setFocusMode] = useState(false);
  const savedLargeSize = useRef({
    w: parseInt(localStorage.getItem("morph-large-w") ?? "1200"),
    h: parseInt(localStorage.getItem("morph-large-h") ?? "700"),
  });
  const savedSmallSize = useRef({
    w: parseInt(localStorage.getItem("morph-small-w") ?? "830"),
    h: parseInt(localStorage.getItem("morph-small-h") ?? "700"),
  });

  useEffect(() => {
    const handler = () => {
      setWindowWidth(window.innerWidth);
      // Persist manual resizes to the appropriate bucket
      const size = { w: window.innerWidth, h: window.innerHeight };
      if (window.innerWidth >= 920) {
        savedLargeSize.current = size;
        localStorage.setItem("morph-large-w", String(size.w));
        localStorage.setItem("morph-large-h", String(size.h));
      } else {
        savedSmallSize.current = size;
        localStorage.setItem("morph-small-w", String(size.w));
        localStorage.setItem("morph-small-h", String(size.h));
      }
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const isNarrow = windowWidth < 920;
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const hasApps = (activeWorkspace?.apps ?? []).length > 0;
  const contextFile = useChatStore((s) => s.contextFile);
  const showRightPanel = hasApps;
  const prevWorkspaceIdRef = useRef<string | null>(null);

  useEffect(() => {
    (window as any).Morph = {
      updateContext: (data: unknown) => {
        const { workspaces, activeWorkspaceId, updateAppContext } = useWorkspaceStore.getState();
        const ws = workspaces.find(w => w.id === activeWorkspaceId);
        const tab = ws?.apps.find(a => a.id === ws.activeTabId) ?? ws?.apps[0];
        if (!tab || !ws) return;
        updateAppContext(ws.id, tab.name, data);
        const safe = tab.name.toLowerCase().replace(/\s+/g, "-");
        invoke("write_file_for_app", {
          path: `~/morph-workspace/apps/${ws.id}/${safe}/state.json`,
          content: JSON.stringify(data, null, 2),
        }).catch(() => {});
      },
      register: (manifest: unknown) => {
        const { workspaces, activeWorkspaceId, registerAppManifest, updateApp } = useWorkspaceStore.getState();
        const ws = workspaces.find(w => w.id === activeWorkspaceId);
        const tab = ws?.apps.find(a => a.id === ws.activeTabId) ?? ws?.apps[0];
        if (!tab || !ws) return;
        registerAppManifest(ws.id, tab.name, manifest as MorphAppManifest);
        // Set tab icon from manifest if provided
        const m = manifest as Record<string, unknown>;
        if (typeof m.icon === "string" && m.icon) {
          updateApp(ws.id, tab.id, { icon: m.icon });
        }
        const safe = tab.name.toLowerCase().replace(/\s+/g, "-");
        invoke("write_file_for_app", {
          path: `~/morph-workspace/apps/${ws.id}/${safe}/manifest.json`,
          content: JSON.stringify(manifest, null, 2),
        }).catch(() => {});
      },
      readFile: (path: string) => invoke<string>("read_file_for_app", { path }),
      readBinaryFile: (path: string) => invoke<ArrayBuffer>("read_binary_file_for_app", { path }),
      listDir: (path: string) => invoke("list_dir_for_app", { path }),
      onCommand: (cb: (cmd: any) => void) => {
        const name = (window as any).Morph._currentAppName;
        if (!name) return;
        const map = (window as any).Morph._commandHandlers;
        if (!map.has(name)) map.set(name, []);
        map.get(name)!.push(cb);
      },
      _commandHandlers: new Map<string, Array<(cmd: any) => void>>(),
      _currentAppName: null as string | null,
    };
  }, []);

  useEffect(() => {
    const apply = () =>
      document.documentElement.setAttribute("data-theme", resolveTheme(theme));
    apply();
    if (theme === "auto") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [theme]);

  useEffect(() => {
    const ws = workspaces.find((w) => w.id === activeWorkspaceId);
    if (ws?.cwd) useChatStore.getState().setCwd(ws.cwd);

    // Isolate chat messages per workspace
    const prev = prevWorkspaceIdRef.current;
    if (prev !== null && prev !== activeWorkspaceId) {
      useChatStore.getState().switchToWorkspace(activeWorkspaceId, prev);
    }
    prevWorkspaceIdRef.current = activeWorkspaceId;
  }, [activeWorkspaceId, workspaces]);

  useEffect(() => {
    if (!cwd) {
      invoke<string>("get_default_cwd")
        .then((dir) => {
          useChatStore.getState().setCwd(dir);
          useWorkspaceStore.getState().updateWorkspaceCwd("global", dir);
        })
        .catch(() => useChatStore.getState().setCwd("~"));
    }
  }, [cwd]);

  useEffect(() => {
    const { workspaces, addApp, updateApp } = useWorkspaceStore.getState();
    const personalWs = workspaces.find(w => w.id === 'personal');
    const geoWs = workspaces.find(w => w.id === 'geo');

    const personalApps = [
      { name: 'Markdown Notes', src: markdownNotesSource, icon: 'notebook' },
      { name: 'Tax Assistant', src: taxSource, icon: 'receipt' },
      { name: 'Calendar', src: calendarSource, icon: 'calendar' },
      { name: 'AI Studio', src: aiStudioSource, icon: 'palette' },
    ];

    if (personalWs) {
      if (personalWs.apps.length === 0) {
        for (const { name, src, icon } of personalApps) addApp(personalWs.id, name, src, icon);
      } else {
        // Auto-update stale source + add missing apps
        for (const { name, src, icon } of personalApps) {
          const app = personalWs.apps.find(a => a.name === name);
          if (app && app.sourceCode !== src) {
            updateApp(personalWs.id, app.id, { sourceCode: src, compiledJs: undefined, status: 'compiling' });
          } else if (!app) {
            addApp(personalWs.id, name, src, icon);
          }
        }
      }
    }

    if (geoWs) {
      if (geoWs.apps.length === 0) {
        addApp(geoWs.id, 'Travel Companion', travelSource, 'compass');
      } else {
        const app = geoWs.apps.find(a => a.name === 'Travel Companion');
        if (app && app.sourceCode !== travelSource) {
          updateApp(geoWs.id, app.id, { sourceCode: travelSource, compiledJs: undefined, status: 'compiling' });
        }
      }
    }

    // --- CI Demo: Landscape workspace (5 apps) ---
    const landscapeWs = workspaces.find(w => w.id === 'ci-landscape');
    const landscapeApps = [
      { name: 'Entity Network', src: ciEntityNetworkSource, icon: 'zap' },
      { name: 'Power Rankings', src: ciPowerRankingsSource, icon: 'star' },
      { name: 'Capex Tracker', src: ciCapexTrackerSource, icon: 'receipt' },
      { name: 'Intel Map', src: ciIntelMapSource, icon: 'map' },
      { name: 'Arms Race Timeline', src: ciTimelineSource, icon: 'calendar' },
    ];
    if (landscapeWs) {
      if (landscapeWs.apps.length === 0) {
        for (const { name, src, icon } of landscapeApps) addApp(landscapeWs.id, name, src, icon);
      } else {
        for (const { name, src, icon } of landscapeApps) {
          const app = landscapeWs.apps.find(a => a.name === name);
          if (app && app.sourceCode !== src) {
            updateApp(landscapeWs.id, app.id, { sourceCode: src, compiledJs: undefined, status: 'compiling' });
          } else if (!app) {
            addApp(landscapeWs.id, name, src, icon);
          }
        }
      }
    }

    // --- CI Demo: Dossier workspace (5 apps) ---
    const dossierWs = workspaces.find(w => w.id === 'ci-dossier');
    const dossierApps = [
      { name: 'Entity Profile', src: ciEntityProfileSource, icon: 'briefcase' },
      { name: 'Threat Matrix', src: ciThreatMatrixSource, icon: 'database' },
      { name: 'Signal Feed', src: ciSignalFeedSource, icon: 'notebook' },
      { name: 'Scenario Modeler', src: ciScenarioModelerSource, icon: 'settings' },
      { name: 'Inference Systems LLC', src: ciMysteryDossierSource, icon: 'code' },
    ];
    if (dossierWs) {
      if (dossierWs.apps.length === 0) {
        for (const { name, src, icon } of dossierApps) addApp(dossierWs.id, name, src, icon);
      } else {
        for (const { name, src, icon } of dossierApps) {
          const app = dossierWs.apps.find(a => a.name === name);
          if (app && app.sourceCode !== src) {
            updateApp(dossierWs.id, app.id, { sourceCode: src, compiledJs: undefined, status: 'compiling' });
          } else if (!app) {
            addApp(dossierWs.id, name, src, icon);
          }
        }
      }
    }

    useWorkspaceStore.getState().switchWorkspace('ci-landscape');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVisualizeSession = useCallback((sessionId: string) => {
    const session = useChatStore.getState().sessions.find((s) => s.id === sessionId);
    setVizSessionCwd(session?.cwd || cwd);
    setVizSessionId(sessionId);
  }, [cwd]);

  const handlePickFolder = useCallback(async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected) {
      useChatStore.getState().setCwd(selected as string);
      invoke("set_cwd", { cwd: selected });
      useWorkspaceStore.getState().updateWorkspaceCwd(activeWorkspaceId, selected as string);
    }
  }, [activeWorkspaceId]);

  const currentPermission = permissionQueue.length > 0 ? permissionQueue[0] : null;

  const showThumbnails = isNarrow && hasApps;
  const hasRightPanel = showThumbnails || showRightPanel || !!vizSessionId;

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        background: "transparent",
        overflow: "hidden",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', system-ui, sans-serif",
      }}
    >
      {/* LEFT CARD — primary foreground: rail + sidebar + chat, always fully visible */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          borderRadius: hasRightPanel ? "12px 0 0 12px" : 12,
          overflow: "hidden",
          background: "var(--bg-window)",
          boxShadow: "var(--shadow-left-card)",
          flexShrink: 0,
          position: "relative",
          zIndex: 20,
        }}
      >
        <WorkspaceRail
          onOpenSettings={() => setSettingsOpen(true)}
          onThemeToggle={() => setTheme(theme === "dark" ? "light" : theme === "light" ? "auto" : "dark")}
          theme={theme}
        />
        {/* Sidebar: always visible (both normal and narrow/thumbnail mode) */}
        {!focusMode && (
          <ChatSidebar
            onNewChat={bridge.newChat}
            onLoadSession={bridge.loadSession}
            onRefreshSessions={bridge.refreshSessions}
            onVisualizeSession={handleVisualizeSession}
          />
        )}
        {/* File preview — between sidebar and chat */}
        {!isNarrow && contextFile && (
          <div
            style={{
              width: 300,
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              borderRight: "0.5px solid var(--border)",
              background: "var(--bg-card)",
            }}
          >
            <div className="h-9 flex items-center px-3 gap-2 shrink-0" style={{ borderBottom: "0.5px solid var(--border)" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text-2)", flex: 1 }} className="truncate">{contextFile.path.split("/").slice(-2).join("/")}</span>
              <button onClick={() => useChatStore.getState().setContextFile(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: 4 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <pre style={{ flex: 1, margin: 0, padding: "14px 16px", fontSize: 11.5, lineHeight: 1.75, fontFamily: "'SF Mono','Fira Code',monospace", color: "var(--text-1)", overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {contextFile.content}
            </pre>
          </div>
        )}
        {/* Chat panel: always visible, narrower when collapsed (isNarrow) */}
        {!vizSessionId && (
          <div
            className={
              isNarrow ? "w-[410px] shrink-0 flex flex-col" :
              !showRightPanel ? "flex-1 flex flex-col" :
              focusMode ? "w-[280px] shrink-0 flex flex-col" :
              "w-[410px] shrink-0 flex flex-col"
            }
            style={{ background: "var(--bg-chat)" }}
          >
            <ChatPanel
              onSendMessage={bridge.sendMessage}
              onInterrupt={bridge.interruptQuery}
              onPickFolder={handlePickFolder}
              cwd={cwd}
              workspaceName={activeWorkspace?.name}
            />
          </div>
        )}
      </div>

      {/* RIGHT CARD — app canvas, secondary/background actor */}
      {vizSessionId ? (
        <div style={{ flex: 1, borderRadius: "0 12px 12px 0", overflow: "hidden", display: "flex", background: "var(--bg-panel)", boxShadow: "0 2px 16px rgba(0,0,0,0.08), 0 0 0 1px var(--border)", zIndex: 10 }}>
          <Suspense fallback={<div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)", fontSize: 13 }}>Loading viz…</div>}>
            <SessionViz sessionId={vizSessionId} sessionCwd={vizSessionCwd} onClose={() => setVizSessionId(null)} />
          </Suspense>
        </div>
      ) : showThumbnails ? (
        <div className="fade-in" style={{ borderRadius: "0 12px 12px 0", overflow: "hidden", display: "flex", flexDirection: "column", background: "var(--bg-panel)", boxShadow: "0 2px 16px rgba(0,0,0,0.08), 0 0 0 1px var(--border)", zIndex: 10 }}>
          <MiniThumbnailBar
            onExpand={() => getCurrentWindow().setSize(new LogicalSize(savedLargeSize.current.w, savedLargeSize.current.h)).catch(() => {})}
          />
        </div>
      ) : showRightPanel ? (
        <div className="fade-in" style={{ flex: 1, borderRadius: "0 12px 12px 0", overflow: "hidden", display: "flex", flexDirection: "column", background: "var(--bg-panel)", boxShadow: "0 2px 16px rgba(0,0,0,0.08), 0 0 0 1px var(--border)", zIndex: 10 }}>
          <AppPanel
            focusMode={focusMode}
            onToggleFocus={() => setFocusMode(f => !f)}
            onCollapseApps={() => getCurrentWindow().setSize(new LogicalSize(savedSmallSize.current.w, savedSmallSize.current.h)).catch(() => {})}
          />
        </div>
      ) : null}

      {currentPermission && (
        <PermissionDialog
          permission={currentPermission}
          queueSize={permissionQueue.length}
          onRespond={bridge.respondPermission}
        />
      )}

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ExtensionsModal onReadFile={bridge.readFile} onListDir={bridge.listDir} />
    </div>
  );
}
