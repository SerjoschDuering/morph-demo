import { create } from "zustand";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  toolUses?: ToolUse[];
  thinkingText?: string;
  widget?: { type: "app-config"; appName: string; appId: string } | null;
}

export interface ToolUse {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
  elapsed?: number;
  status?: "running" | "done" | "error";
}

export interface ToolActivity {
  toolUseId: string;
  toolName: string;
  status: "running" | "done";
  elapsed?: number;
  summary?: string;
  taskId?: string;
}

export interface PermissionRequest {
  id: string;
  tool: string;
  description: string;
  input?: Record<string, unknown>;
  suggestions?: unknown[];
}

export interface SessionInfo {
  id: string;
  title: string;
  createdAt: number;
  lastUsedAt: number;
  cwd: string;
  isOwnSession?: boolean; // true = created by morph in current cwd
}

export interface SkillInfo {
  name: string;
  plugin: string;
  path: string;
}

export interface ExtensionsState {
  skills: SkillInfo[];
  plugins: { name: string; path: string }[];
  mcpServers: { name: string; status: string }[];
  tools: string[];
  commands: string[];
}

export interface FilePreview {
  path: string;
  content: string;
  isError?: boolean;
}

export interface DirEntry {
  name: string;
  isDir: boolean;
  path: string;
}

interface ChatState {
  messages: ChatMessage[];
  messagesByWorkspace: Record<string, ChatMessage[]>;
  sessions: SessionInfo[];
  currentSessionId: string | null;
  isStreaming: boolean;
  cwd: string;
  isConnected: boolean;
  isAuthenticated: boolean;
  cliInstalled: boolean;
  permissionQueue: PermissionRequest[];
  availableCommands: string[];
  lastCost: number | null;
  sidebarOpen: boolean;
  activities: ToolActivity[];
  extensions: ExtensionsState;
  extensionsModalOpen: boolean;
  filePreview: FilePreview | null;
  dirListings: Record<string, DirEntry[]>;
  injectedCommand: string;
  messageQueue: string[];
  backgroundSessions: string[];
  selectedModel: string | null;
  streamingContent: string;
  streamingThinking: string;
  streamingStartedAt: number | null;

  addUserMessage: (content: string) => void;
  startAssistantMessage: (id: string) => void;
  setAssistantContent: (text: string) => void;
  appendToAssistant: (text: string) => void;
  setAssistantThinking: (text: string) => void;
  addToolUse: (tu: ToolUse) => void;
  updateToolResult: (id: string, result: string, isError: boolean) => void;
  updateToolStatus: (id: string, status: "running" | "done" | "error", elapsed?: number) => void;
  markAllToolsDone: () => void;
  finishAssistantMessage: (finalContent?: string, finalThinking?: string) => void;
  setStreaming: (v: boolean) => void;
  setCwd: (cwd: string) => void;
  setConnected: (v: boolean) => void;
  setAuthenticated: (v: boolean) => void;
  setCliInstalled: (v: boolean) => void;
  setSessions: (s: SessionInfo[]) => void;
  setCurrentSessionId: (id: string | null) => void;
  addPermission: (p: PermissionRequest) => void;
  shiftPermission: () => void;
  removePermission: (id: string) => void;
  clearPermissions: () => void;
  setAvailableCommands: (cmds: string[]) => void;
  setLastCost: (cost: number) => void;
  setSidebarOpen: (v: boolean) => void;
  clearMessages: () => void;
  addSystemMessage: (content: string) => void;
  addActivity: (a: ToolActivity) => void;
  updateActivity: (toolUseId: string, updates: Partial<ToolActivity>) => void;
  clearActivities: () => void;
  setExtensions: (ext: Partial<ExtensionsState>) => void;
  setExtensionsModalOpen: (v: boolean) => void;
  setFilePreview: (fp: FilePreview | null) => void;
  setDirListing: (path: string, entries: DirEntry[]) => void;
  setInjectedCommand: (cmd: string) => void;
  enqueueMessage: (content: string) => void;
  dequeueMessage: () => string | undefined;
  removeQueuedMessage: (index: number) => void;
  editQueuedMessage: (index: number, content: string) => void;
  clearMessageQueue: () => void;
  addBackgroundSession: (id: string) => void;
  removeBackgroundSession: (id: string) => void;
  setSelectedModel: (model: string | null) => void;
  setStreamingState: (content: string, thinking: string) => void;
  setStreamingContent: (text: string) => void;
  setStreamingThinking: (text: string) => void;
  addWidgetMessage: (widget: NonNullable<ChatMessage["widget"]>) => void;
  switchToWorkspace: (wsId: string, prevWsId: string) => void;
  contextFile: { path: string; name: string; content: string } | null;
  setContextFile: (f: { path: string; name: string; content: string } | null) => void;
  sessionWorkspaceMap: Record<string, string>;
  tagSessionWorkspace: (sessionId: string, workspaceId: string) => void;
}

let idCounter = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now()}-${++idCounter}`;

/** Find the streaming assistant message — may NOT be the last message (system messages can interleave). */
function findStreamingAssistant(msgs: ChatMessage[]): number {
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === "assistant" && msgs[i].isStreaming) return i;
  }
  return -1;
}

/** Find the last assistant message (streaming or not). */
function findLastAssistant(msgs: ChatMessage[]): number {
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === "assistant") return i;
  }
  return -1;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  messagesByWorkspace: {},
  sessions: [],
  currentSessionId: null,
  isStreaming: false,
  cwd: "",
  isConnected: false,
  isAuthenticated: false,
  cliInstalled: false,
  permissionQueue: [],
  availableCommands: [],
  lastCost: null,
  sidebarOpen: true,
  activities: [],
  extensions: { skills: [], plugins: [], mcpServers: [], tools: [], commands: [] },
  extensionsModalOpen: false,
  filePreview: null,
  dirListings: {},
  injectedCommand: "",
  messageQueue: [],
  backgroundSessions: [],
  selectedModel: null,
  streamingContent: "",
  streamingThinking: "",
  streamingStartedAt: null,
  contextFile: null,
  sessionWorkspaceMap: (() => { try { return JSON.parse(localStorage.getItem('morph-session-ws-map') || '{}'); } catch { return {}; } })(),

  addUserMessage: (content) =>
    set((s) => ({
      messages: [...s.messages, {
        id: nextId("user"), role: "user", content, timestamp: Date.now(),
      }],
    })),

  startAssistantMessage: (id) =>
    set((s) => ({
      messages: [...s.messages, {
        id, role: "assistant", content: "", timestamp: Date.now(),
        isStreaming: true, toolUses: [], thinkingText: "",
      }],
      isStreaming: true,
      streamingStartedAt: Date.now(),
    })),

  setAssistantContent: (text) =>
    set((s) => {
      const msgs = [...s.messages];
      const idx = findStreamingAssistant(msgs);
      if (idx >= 0) msgs[idx] = { ...msgs[idx], content: text };
      return { messages: msgs };
    }),

  appendToAssistant: (text) =>
    set((s) => {
      const msgs = [...s.messages];
      const idx = findStreamingAssistant(msgs);
      if (idx >= 0) msgs[idx] = { ...msgs[idx], content: msgs[idx].content + text };
      return { messages: msgs };
    }),

  setAssistantThinking: (text) =>
    set((s) => {
      const msgs = [...s.messages];
      const idx = findStreamingAssistant(msgs);
      if (idx >= 0) msgs[idx] = { ...msgs[idx], thinkingText: text };
      return { messages: msgs };
    }),

  addToolUse: (tu) =>
    set((s) => {
      const msgs = [...s.messages];
      // Prefer streaming assistant; fall back to last assistant (for session restoration)
      const streamIdx = findStreamingAssistant(msgs);
      const idx = streamIdx >= 0 ? streamIdx : findLastAssistant(msgs);
      if (idx >= 0) {
        const msg = msgs[idx];
        const existing = msg.toolUses?.find((t) => t.id === tu.id);
        if (!existing) {
          msgs[idx] = { ...msg, toolUses: [...(msg.toolUses || []), { ...tu, status: "running" }] };
        }
      }
      return { messages: msgs };
    }),

  updateToolResult: (id, result, isError) =>
    set((s) => {
      const msgs = s.messages.map((m) => {
        if (m.role !== "assistant" || !m.toolUses) return m;
        const hasT = m.toolUses.some((t) => t.id === id);
        if (!hasT) return m;
        return {
          ...m, toolUses: m.toolUses.map((t) =>
            t.id === id ? { ...t, result, isError, status: isError ? "error" as const : "done" as const } : t
          ),
        };
      });
      return { messages: msgs };
    }),

  updateToolStatus: (id, status, elapsed) =>
    set((s) => {
      const msgs = s.messages.map((m) => {
        if (m.role !== "assistant" || !m.toolUses) return m;
        const hasT = m.toolUses.some((t) => t.id === id);
        if (!hasT) return m;
        return {
          ...m, toolUses: m.toolUses.map((t) =>
            t.id === id ? { ...t, status, elapsed: elapsed ?? t.elapsed } : t
          ),
        };
      });
      return { messages: msgs };
    }),

  markAllToolsDone: () =>
    set((s) => {
      const msgs = s.messages.map((m) => {
        if (m.role !== "assistant" || !m.toolUses) return m;
        const hasRunning = m.toolUses.some((t) => t.status === "running");
        if (!hasRunning) return m;
        return {
          ...m, toolUses: m.toolUses.map((t) =>
            t.status === "running" ? { ...t, status: "done" as const } : t
          ),
        };
      });
      return { messages: msgs };
    }),

  finishAssistantMessage: (finalContent?: string, finalThinking?: string) =>
    set((s) => {
      const msgs = [...s.messages];
      const idx = findStreamingAssistant(msgs);
      if (idx >= 0) {
        const msg = msgs[idx];
        const toolUses = msg.toolUses?.map((t) =>
          t.status === "running" ? { ...t, status: "done" as const } : t
        );
        msgs[idx] = {
          ...msg,
          isStreaming: false,
          toolUses,
          content: finalContent ?? (s.streamingContent ?? msg.content),
          thinkingText: finalThinking ?? (s.streamingThinking ?? msg.thinkingText),
        };
      }
      return { messages: msgs, isStreaming: false, activities: [], streamingContent: "", streamingThinking: "", streamingStartedAt: null };
    }),

  setStreaming: (isStreaming) => set({ isStreaming }),
  setCwd: (cwd) => set({ cwd }),
  setConnected: (isConnected) => set({ isConnected }),
  setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  setCliInstalled: (cliInstalled) => set({ cliInstalled }),
  setSessions: (sessions) => set({ sessions }),
  setCurrentSessionId: (currentSessionId) => set({ currentSessionId }),

  addPermission: (p) =>
    set((s) => ({ permissionQueue: [...s.permissionQueue, p] })),

  shiftPermission: () =>
    set((s) => ({ permissionQueue: s.permissionQueue.slice(1) })),

  removePermission: (id) =>
    set((s) => ({ permissionQueue: s.permissionQueue.filter((p) => p.id !== id) })),

  clearPermissions: () => set({ permissionQueue: [] }),

  setAvailableCommands: (availableCommands) => set({ availableCommands }),
  setLastCost: (lastCost) => set({ lastCost }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  clearMessages: () => set({ messages: [], isStreaming: false, activities: [], streamingContent: "", streamingThinking: "", streamingStartedAt: null }),

  addSystemMessage: (content) =>
    set((s) => ({
      messages: [...s.messages, {
        id: nextId("sys"), role: "system", content, timestamp: Date.now(),
      }],
    })),

  addActivity: (a) =>
    set((s) => {
      const existing = s.activities.find((x) => x.toolUseId === a.toolUseId);
      if (existing) {
        return { activities: s.activities.map((x) =>
          x.toolUseId === a.toolUseId ? { ...x, ...a } : x
        ) };
      }
      return { activities: [...s.activities, a] };
    }),

  updateActivity: (toolUseId, updates) =>
    set((s) => ({
      activities: s.activities.map((a) =>
        a.toolUseId === toolUseId ? { ...a, ...updates } : a
      ),
    })),

  clearActivities: () => set({ activities: [] }),

  setExtensions: (ext) =>
    set((s) => ({ extensions: { ...s.extensions, ...ext } })),

  setExtensionsModalOpen: (extensionsModalOpen) => set({ extensionsModalOpen }),
  setFilePreview: (filePreview) => set({ filePreview }),
  setDirListing: (path, entries) =>
    set((s) => ({ dirListings: { ...s.dirListings, [path]: entries } })),
  setInjectedCommand: (injectedCommand) => set({ injectedCommand }),
  enqueueMessage: (content) =>
    set((s) => ({ messageQueue: [...s.messageQueue, content] })),
  dequeueMessage: () => {
    const q = get().messageQueue;
    if (q.length === 0) return undefined;
    const [first, ...rest] = q;
    set({ messageQueue: rest });
    return first;
  },
  removeQueuedMessage: (index) =>
    set((s) => ({ messageQueue: s.messageQueue.filter((_, i) => i !== index) })),
  editQueuedMessage: (index, content) =>
    set((s) => ({ messageQueue: s.messageQueue.map((m, i) => i === index ? content : m) })),
  clearMessageQueue: () => set({ messageQueue: [] }),
  addBackgroundSession: (id) =>
    set((s) => ({
      backgroundSessions: s.backgroundSessions.includes(id)
        ? s.backgroundSessions
        : [...s.backgroundSessions, id],
    })),
  removeBackgroundSession: (id) =>
    set((s) => ({
      backgroundSessions: s.backgroundSessions.filter((x) => x !== id),
    })),
  setSelectedModel: (selectedModel) => set({ selectedModel }),
  setStreamingState: (streamingContent, streamingThinking) => set({ streamingContent, streamingThinking }),
  setStreamingContent: (streamingContent) => set({ streamingContent }),
  setStreamingThinking: (streamingThinking) => set({ streamingThinking }),
  addWidgetMessage: (widget) =>
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id: `widget-${Date.now()}`,
          role: "system" as const,
          content: "",
          widget,
          timestamp: Date.now(),
        },
      ],
    })),

  setContextFile: (contextFile) => set({ contextFile }),
  tagSessionWorkspace: (sessionId, workspaceId) =>
    set((s) => {
      const next = { ...s.sessionWorkspaceMap, [sessionId]: workspaceId };
      try { localStorage.setItem('morph-session-ws-map', JSON.stringify(next)); } catch {}
      return { sessionWorkspaceMap: next };
    }),

  switchToWorkspace: (wsId, prevWsId) =>
    set((s) => ({
      messagesByWorkspace: {
        ...s.messagesByWorkspace,
        [prevWsId]: s.messages,
      },
      messages: s.messagesByWorkspace[wsId] ?? [],
      isStreaming: false,
      activities: [],
      streamingContent: "",
      streamingThinking: "",
      streamingStartedAt: null,
    })),
}));
