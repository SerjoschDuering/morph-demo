import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Declared by each app via Morph.register() on mount. Tells Claude the full contract. */
export interface MorphAppManifest {
  description: string;          // What this app does
  contextHint?: string;         // Human-readable description of what updateContext sends
  inputFile?: string;           // Path Claude should write JSON to (~/morph-output/{name}.json)
  commands?: string[];          // Commands this app's onCommand handler accepts
  capabilities?: Array<"readFile" | "listDir">;
  icon?: string;                // Emoji for the tab icon (e.g. "📊", "🗺️", "📝")
}

export interface AppTab {
  id: string;
  name: string;
  sourceCode: string;
  compiledJs?: string;       // IIFE JS string, not persisted
  status: "compiling" | "ready" | "error";
  error?: string;
  locked?: boolean;          // locked = AI cannot modify; triggers git commit
  icon?: string;             // emoji or lucide icon name
  sharesState?: boolean;     // green dot = app is exposing state back to AI
}

export interface Workspace {
  id: string;
  name: string;
  icon: string;              // lucide icon name: "globe" | "briefcase" | "user" | "shield"
  cwd: string;               // working directory for the SDK
  apps: AppTab[];
  activeTabId: string | null;
  isGlobal?: boolean;        // true for Global workspace
  systemContext?: string;
}

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  appContexts: Record<string, unknown>;        // keyed by "wsId:appName"
  appManifests: Record<string, MorphAppManifest>; // keyed by "wsId:appName"

  switchWorkspace: (id: string) => void;
  addWorkspace: (opts: { name: string; icon: string; cwd: string }) => void;
  addApp: (workspaceId: string, name: string, sourceCode: string, icon?: string) => string;
  updateApp: (workspaceId: string, appId: string, updates: Partial<AppTab>) => void;
  removeApp: (workspaceId: string, appId: string) => void;
  setActiveTab: (workspaceId: string, tabId: string | null) => void;
  updateAppContext: (wsId: string, appName: string, data: unknown) => void;
  registerAppManifest: (wsId: string, appName: string, manifest: MorphAppManifest) => void;
  updateWorkspaceCwd: (wsId: string, cwd: string) => void;
}

let appIdCounter = 0;
const nextAppId = () => `app-${Date.now()}-${++appIdCounter}`;

const INITIAL_WORKSPACES: Workspace[] = [
  {
    id: "global",
    name: "Global",
    icon: "globe",
    cwd: "~/Desktop",
    apps: [],
    activeTabId: null,
    isGlobal: true,
  },
  {
    id: "personal",
    name: "Private",
    icon: "user",
    cwd: "~/Desktop",
    apps: [],
    activeTabId: null,
  },
  {
    id: "geo",
    name: "Geo Lab",
    icon: "globe",
    cwd: "~/Desktop",
    apps: [],
    activeTabId: null,
  },
  {
    id: "ci-landscape",
    name: "Landscape",
    icon: "globe",
    cwd: "~/Desktop",
    apps: [],
    activeTabId: null,
  },
  {
    id: "ci-dossier",
    name: "Dossier",
    icon: "shield",
    cwd: "~/Desktop",
    apps: [],
    activeTabId: null,
  },
  {
    id: "ci-warroom",
    name: "War Room",
    icon: "briefcase",
    cwd: "~/Desktop",
    apps: [],
    activeTabId: null,
  },
];

/** Derive a short (~5 token) human-readable summary from app context data. */
export function extractSummary(ctx: unknown): string {
  if (!ctx || typeof ctx !== "object") return "active";
  const c = ctx as Record<string, unknown>;
  if (typeof c._summary === "string") return c._summary;
  if (typeof c.selected === "string") return `viewing ${c.selected}`;
  if (typeof c.destination === "string") return `viewing ${c.destination}`;
  if (typeof c.currentFile === "string") return c.currentFile.split("/").pop() || "file open";
  if (c.dataLoaded === false) return "no data";
  if (c.dataLoaded === true) return c.year ? `${c.year} loaded` : "data loaded";
  if (c.selectedEvent && typeof c.selectedEvent === "object") {
    const e = c.selectedEvent as { title?: string };
    return e.title ? `"${e.title}"` : "event selected";
  }
  return "active";
}


function buildSystemContext(
  ws: Workspace,
  appContexts: Record<string, unknown>,
  appManifests: Record<string, MorphAppManifest> = {},
): string {
  if (ws.apps.length === 0) return `Workspace: "${ws.name}" (cwd: ${ws.cwd})`;

  const appLines = ws.apps.map(app => {
    const ctx = appContexts[`${ws.id}:${app.name}`];
    const manifest = appManifests[`${ws.id}:${app.name}`];
    const safe = app.name.toLowerCase().replace(/\s+/g, "-");
    const basePath = `~/morph-workspace/apps/${ws.id}/${safe}`;
    const stateStr = ctx ? ` — state: ${JSON.stringify(ctx)}` : " (no state yet)";
    const errorStr = app.status === "error" && app.error
      ? ` ⚠️ ERROR: ${app.error.slice(0, 200)}`
      : "";
    const cmdStr = manifest?.commands?.length
      ? `\n    commands: ${manifest.commands.join(", ")}`
      : "";
    return `  - ${app.name}${stateStr}${errorStr}\n    files: ${basePath}/{manifest.json,state.json}${cmdStr}`;
  }).join("\n");

  return [
    `Workspace: "${ws.name}" (cwd: ${ws.cwd})`,
    `Apps open:\n${appLines}`,
    `Note: ~ expands to the user's home dir. Use Read with the absolute path if Glob fails.`,
    `To update an app: write JSON to its inputFile (see manifest). Commands "reload" and "reset" are auto-relayed.`,
  ].join("\n");
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      workspaces: INITIAL_WORKSPACES,
      activeWorkspaceId: "personal",
      appContexts: {},
      appManifests: {},

      switchWorkspace: (id) => set({ activeWorkspaceId: id }),

      addWorkspace: ({ name, icon, cwd }) => {
        const id = `ws-${Date.now()}`;
        set((s) => ({
          workspaces: [...s.workspaces, { id, name, icon, cwd, apps: [], activeTabId: null }],
          activeWorkspaceId: id,
        }));
      },

      addApp: (workspaceId, name, sourceCode, icon) => {
        const id = nextAppId();
        set((s) => ({
          workspaces: s.workspaces.map((ws) =>
            ws.id !== workspaceId ? ws : {
              ...ws,
              apps: [...ws.apps, { id, name, sourceCode, status: "compiling", ...(icon ? { icon } : {}) }],
              activeTabId: id,
            }
          ),
        }));
        return id;
      },

      updateApp: (workspaceId, appId, updates) =>
        set((s) => ({
          workspaces: s.workspaces.map((ws) =>
            ws.id !== workspaceId ? ws : {
              ...ws,
              apps: ws.apps.map((app) => app.id !== appId ? app : { ...app, ...updates }),
            }
          ),
        })),

      removeApp: (workspaceId, appId) =>
        set((s) => ({
          workspaces: s.workspaces.map((ws) => {
            if (ws.id !== workspaceId) return ws;
            const apps = ws.apps.filter((a) => a.id !== appId);
            const activeTabId = ws.activeTabId === appId
              ? (apps.length > 0 ? apps[apps.length - 1].id : null)
              : ws.activeTabId;
            return { ...ws, apps, activeTabId };
          }),
        })),

      setActiveTab: (workspaceId, tabId) =>
        set((s) => ({
          workspaces: s.workspaces.map((ws) =>
            ws.id !== workspaceId ? ws : { ...ws, activeTabId: tabId }
          ),
        })),

      updateAppContext: (wsId, appName, data) =>
        set(state => {
          const appContexts = { ...state.appContexts, [`${wsId}:${appName}`]: data };
          const ws = state.workspaces.find(w => w.id === wsId);
          if (!ws) return { appContexts };
          const systemContext = buildSystemContext(ws, appContexts, state.appManifests);
          const workspaces = state.workspaces.map(w =>
            w.id !== wsId ? w : {
              ...w,
              systemContext,
              apps: w.apps.map(a => a.name !== appName ? a : { ...a, sharesState: true }),
            }
          );
          return { workspaces, appContexts };
        }),

      registerAppManifest: (wsId, appName, manifest) =>
        set(state => {
          const appManifests = { ...state.appManifests, [`${wsId}:${appName}`]: manifest };
          const ws = state.workspaces.find(w => w.id === wsId);
          if (!ws) return { appManifests };
          const systemContext = buildSystemContext(ws, state.appContexts, appManifests);
          const workspaces = state.workspaces.map(w => w.id === wsId ? { ...w, systemContext } : w);
          return { workspaces, appManifests };
        }),

      updateWorkspaceCwd: (wsId, cwd) => set(state => ({
        workspaces: state.workspaces.map(w => w.id === wsId ? { ...w, cwd } : w),
      })),
    }),
    {
      name: "morph-workspaces-v4",
      version: 1,
      migrate: (persisted: unknown, version: number) => {
        const s = persisted as { workspaces?: Workspace[]; activeWorkspaceId?: string };
        const LEGACY_IDS = new Set(["morph"]);
        // v1→v2: prune stale AI-created test apps from previous sessions
        const STALE_APPS = version < 2 ? new Set(["test-app", "test-three", "test-four", "3d-viewer"]) : new Set<string>();
        const kept: Workspace[] = (s.workspaces ?? [])
          .filter(ws => !LEGACY_IDS.has(ws.id))
          .map(ws => ({
            ...ws,
            apps: ws.apps
              .filter(a => !STALE_APPS.has(a.name.toLowerCase().replace(/\s+/g, "-")))
              .map(a => ({ ...a, compiledJs: undefined, status: "compiling" as const })),
          }));
        // Ensure canonical workspaces exist
        if (!kept.find(w => w.id === "global")) {
          kept.unshift({ id: "global", name: "Global", icon: "globe", cwd: "~/Desktop", apps: [], activeTabId: null, isGlobal: true });
        }
        if (!kept.find(w => w.id === "personal")) {
          const idx = kept.findIndex(w => w.id === "global");
          kept.splice(idx + 1, 0, { id: "personal", name: "Private", icon: "user", cwd: "~/Desktop", apps: [], activeTabId: null });
        }
        // Rename urban-lab → geo if it exists
        const urbanLabIdx = kept.findIndex(w => w.id === "urban-lab");
        if (urbanLabIdx >= 0) {
          kept[urbanLabIdx] = { ...kept[urbanLabIdx], id: "geo", name: "Geo Lab" };
        }
        if (!kept.find(w => w.id === "geo")) {
          kept.push({ id: "geo", name: "Geo Lab", icon: "globe", cwd: "~/Desktop", apps: [], activeTabId: null });
        }
        // Ensure CI demo workspaces exist
        if (!kept.find(w => w.id === "ci-landscape")) {
          kept.push({ id: "ci-landscape", name: "Landscape", icon: "globe", cwd: "~/Desktop", apps: [], activeTabId: null });
        }
        if (!kept.find(w => w.id === "ci-dossier")) {
          kept.push({ id: "ci-dossier", name: "Dossier", icon: "shield", cwd: "~/Desktop", apps: [], activeTabId: null });
        }
        if (!kept.find(w => w.id === "ci-warroom")) {
          kept.push({ id: "ci-warroom", name: "War Room", icon: "briefcase", cwd: "~/Desktop", apps: [], activeTabId: null });
        }
        const storedId = s.activeWorkspaceId ?? "personal";
        // Remap urban-lab active workspace to geo
        const remappedId = storedId === "urban-lab" ? "geo" : storedId;
        const activeExists = kept.find(w => w.id === remappedId);
        return {
          workspaces: kept,
          activeWorkspaceId: activeExists ? remappedId : "personal",
          appContexts: {},
          appManifests: {},
        };
      },
      partialize: (state) => ({
        workspaces: state.workspaces.map(ws => ({
          ...ws,
          systemContext: undefined,
          apps: ws.apps.map(a => ({ ...a, compiledJs: undefined, status: "compiling" as const })),
        })),
        activeWorkspaceId: state.activeWorkspaceId,
        appContexts: {} as Record<string, unknown>,
        appManifests: {} as Record<string, import("./workspaceStore").MorphAppManifest>,
      }),
    }
  )
);
