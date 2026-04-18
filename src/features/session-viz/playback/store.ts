import { create } from 'zustand';
import type { ParsedSession, GraphNode, GraphEdge } from '../parser/types.ts';
import { buildFullGraph, buildGraphState, resetBuilder, runCleanups } from './graph-builder.ts';

export type PlaybackSpeed = 1 | 2 | 5 | 10 | 50;

export interface PlaybackState {
  session: ParsedSession | null;
  isPlaying: boolean;
  speed: PlaybackSpeed;
  currentEventIndex: number;
  elapsedMs: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
  topoVersion: number;
  /** True once the force simulation has settled and positions are frozen */
  frozen: boolean;

  setSession: (s: ParsedSession) => void;
  play: () => void;
  pause: () => void;
  setSpeed: (s: PlaybackSpeed) => void;
  stepForward: () => void;
  stepBackward: () => void;
  seekToEvent: (index: number) => void;
  seekToTime: (ms: number) => void;
  tick: (deltaMs: number) => void;
  freeze: () => void;
  reset: () => void;
}

const initialState = {
  session: null as ParsedSession | null,
  isPlaying: false,
  speed: 1 as PlaybackSpeed,
  currentEventIndex: -1,
  elapsedMs: 0,
  nodes: [] as GraphNode[],
  edges: [] as GraphEdge[],
  topoVersion: 0,
  frozen: false,
};

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  ...initialState,

  setSession: (s: ParsedSession) => {
    resetBuilder();
    runCleanups();
    // Build full graph with ALL events — positions will be set by force simulation
    const graph = buildFullGraph(s.events, s.agents);
    const lastIndex = Math.max(s.events.length - 1, -1);
    const elapsed = lastIndex >= 0 ? s.events[lastIndex]!.timestamp - s.startTime : 0;
    set({
      session: s, isPlaying: false, speed: 1,
      currentEventIndex: lastIndex, elapsedMs: elapsed,
      nodes: graph.nodes, edges: graph.edges,
      topoVersion: graph.topoVersion,
      frozen: false,
    });
    // Nudge: react-force-graph-3d needs a topology diff to properly register
    // custom nodeThreeObject. Step back then forward to force remove/re-add.
    // buildGraphState reuses positionCache (not cleared), so positions survive.
    if (lastIndex > 0) {
      setTimeout(() => {
        const prevGraph = buildGraphState(s.events, lastIndex - 1, s.agents);
        set({ nodes: prevGraph.nodes, edges: prevGraph.edges, topoVersion: prevGraph.topoVersion });
        setTimeout(() => {
          const fullGraph = buildGraphState(s.events, lastIndex, s.agents);
          set({ nodes: fullGraph.nodes, edges: fullGraph.edges, topoVersion: fullGraph.topoVersion });
        }, 200);
      }, 200);
    }
  },

  play: () => {
    const { session, currentEventIndex } = get();
    if (!session || currentEventIndex >= session.events.length - 1) return;
    set({ isPlaying: true });
  },

  pause: () => set({ isPlaying: false }),
  setSpeed: (s: PlaybackSpeed) => set({ speed: s }),

  // No graph rebuild — just move the index. RAF loop handles visibility.
  stepForward: () => {
    const { session, currentEventIndex } = get();
    if (!session) return;
    const next = currentEventIndex + 1;
    if (next >= session.events.length) return;
    const ev = session.events[next]!;
    set({ currentEventIndex: next, elapsedMs: ev.timestamp - session.startTime });
  },

  stepBackward: () => {
    const { session, currentEventIndex } = get();
    if (!session) return;
    const prev = currentEventIndex - 1;
    if (prev < -1) return;
    const elapsed = prev >= 0 ? session.events[prev]!.timestamp - session.startTime : 0;
    set({ currentEventIndex: prev, elapsedMs: elapsed });
  },

  seekToEvent: (index: number) => {
    const { session } = get();
    if (!session) return;
    const clamped = Math.max(-1, Math.min(index, session.events.length - 1));
    const elapsed = clamped >= 0 ? session.events[clamped]!.timestamp - session.startTime : 0;
    set({ currentEventIndex: clamped, elapsedMs: elapsed });
  },

  seekToTime: (ms: number) => {
    const { session } = get();
    if (!session) return;
    const targetTs = session.startTime + ms;
    let idx = -1;
    for (let i = 0; i < session.events.length; i++) {
      if (session.events[i]!.timestamp <= targetTs) idx = i;
      else break;
    }
    set({ currentEventIndex: idx, elapsedMs: ms });
  },

  tick: (deltaMs: number) => {
    const { session, isPlaying, speed, elapsedMs, currentEventIndex } = get();
    if (!session || !isPlaying) return;

    const msPerEvent = 250 / speed;
    const newElapsed = elapsedMs + deltaMs;
    const prevSteps = Math.floor(elapsedMs / msPerEvent);
    const newSteps = Math.floor(newElapsed / msPerEvent);
    const advance = newSteps - prevSteps;

    if (advance <= 0) {
      set({ elapsedMs: newElapsed });
      return;
    }

    const newIndex = Math.min(currentEventIndex + advance, session.events.length - 1);
    const atEnd = newIndex >= session.events.length - 1;
    set({ currentEventIndex: newIndex, elapsedMs: newElapsed, isPlaying: !atEnd });
  },

  freeze: () => set({ frozen: true }),

  reset: () => { resetBuilder(); set({ ...initialState }); },
}));
