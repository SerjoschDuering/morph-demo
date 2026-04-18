import { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
/* eslint-disable @typescript-eslint/no-explicit-any */
type FGRef = any; // ForceGraphMethods generics don't expose graphData/d3AlphaTarget
import {
  SphereGeometry, OctahedronGeometry, RingGeometry, TorusGeometry,
  MeshBasicMaterial, Mesh, Object3D, Vector2, Color,
  CanvasTexture, SpriteMaterial, Sprite, DoubleSide,
} from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { forceX, forceY } from 'd3-force-3d';
import { usePlaybackStore } from '../playback/store.ts';
import { useSelectionStore } from '../playback/selection-store.ts';
import { useHeatmapStore } from '../playback/heatmap-store.ts';
import { updatePositionCache, getCachedPosition, registerCleanup } from '../playback/graph-builder.ts';
import {
  spatialZoneForce, directoryClusterForce,
  Z_MAIN_AGENT, Z_SUBAGENT, Z_DIR, Z_BASH, Z_URL, Z_GRAVEYARD,
  Z_DIR_DEPTH_STEP,
} from './custom-forces.ts';

interface GNode {
  id: string; kind: string; label: string; color: string;
  tokens: number; accessCount: number; lastActiveAt: number;
  spawnedAt: number; firstAppearAt: number;
  directory?: string; depth?: number;
  opacity: number;
  x?: number; y?: number; z?: number;
  fx?: number; fy?: number;
  __threeObj?: Object3D;
}

interface GLink {
  source: string; target: string; opacity: number; color: string;
  active: boolean; direction: 'read' | 'write'; agentColor: string;
  structural: boolean;
  lastActiveAt: number;
  firstAppearAt: number;
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

function easeOutBack(t: number): number {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

const ANIM_MS = 400;
const COLOR_DEAD = new Color('#4a5568');

const HEAT_COLORS = ['#1e1e2e', '#4a3728', '#b45309', '#eab308', '#f97316', '#ef4444'];
function heatColor(accessCount: number): string {
  if (accessCount <= 0) return HEAT_COLORS[0];
  if (accessCount <= 1) return HEAT_COLORS[1];
  if (accessCount <= 3) return HEAT_COLORS[2];
  if (accessCount <= 10) return HEAT_COLORS[3];
  if (accessCount <= 30) return HEAT_COLORS[4];
  return HEAT_COLORS[5];
}

const _heatColorObj = new Color();

const labelTexCache = new Map<string, { tex: CanvasTexture; w: number; h: number }>();

export function clearLabelCache() {
  for (const entry of labelTexCache.values()) entry.tex.dispose();
  labelTexCache.clear();
}

registerCleanup(clearLabelCache);

function makeLabel(text: string, color: string, bold: boolean): Sprite {
  const t = text.length > 22 ? text.slice(0, 19) + '...' : text;
  const key = `${t}|${color}|${bold}`;
  let entry = labelTexCache.get(key);
  if (!entry) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const fs = bold ? 34 : 26;
    const font = `${bold ? 'bold ' : ''}${fs}px "SF Mono","Fira Code",monospace`;
    ctx.font = font;
    const pad = bold ? 18 : 10;
    const w = ctx.measureText(t).width + pad * 2;
    const h = fs + pad;
    canvas.width = w; canvas.height = h;
    ctx.font = font;
    if (bold) {
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.beginPath(); ctx.roundRect(0, 0, w, h, h / 2); ctx.fill();
    }
    ctx.fillStyle = color; ctx.globalAlpha = 0.95;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(t, w / 2, h / 2);
    entry = { tex: new CanvasTexture(canvas), w, h };
    labelTexCache.set(key, entry);
  }
  const mat = new SpriteMaterial({ map: entry.tex, transparent: true, depthWrite: false });
  mat.userData = { opScale: 0.95, origColor: color };
  const sprite = new Sprite(mat);
  sprite.scale.set(entry.w / 12, entry.h / 12, 1);
  return sprite;
}

const ORBIT_RADIUS = 340;
const ORBIT_SPEED = 0.0003;
const ORBIT_TILT = -100;
const ORBIT_LOOK_Z = 5;

// Freeze delay: how long after simulation start to freeze positions
const FREEZE_DELAY_MS = 4300;

export function SessionForceGraph({ width, height, isDark = true }: { width: number; height: number; isDark?: boolean }) {
  const fgRef = useRef<FGRef>(null);
  const bloomAdded = useRef(false);
  const bloomPassRef = useRef<UnrealBloomPass | null>(null);
  const birthTimes = useRef(new Map<string, number>());
  const orbitAngle = useRef(0);
  const orbitActive = useRef(true);

  const prevTopoRef = useRef(0);
  const stableGraphRef = useRef<{ nodes: GNode[]; links: GLink[] }>({ nodes: [], links: [] });
  const eventIndexRef = useRef(-1);

  const lastOpMap = useRef(new WeakMap<Object3D, number>());

  // nodeObjMap populated by nodeThreeObject callback (fallback)
  const nodeObjMap = useRef(new Map<string, Object3D>());

  const initialLayoutDone = useRef(false);

  const heatmapRef = useRef(false);
  const prevHeatmapRef = useRef(false);

  // Frozen state ref for RAF loop (non-reactive)
  const frozenRef = useRef(false);
  const freezeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const nodes = usePlaybackStore((s) => s.nodes);
  const edges = usePlaybackStore((s) => s.edges);
  const topoVersion = usePlaybackStore((s) => s.topoVersion);
  const frozen = usePlaybackStore((s) => s.frozen);
  const select = useSelectionStore((s) => s.select);

  // Sync frozen ref
  useEffect(() => { frozenRef.current = frozen; }, [frozen]);

  // Subscribe to currentEventIndex without re-render
  useEffect(() => {
    const unsub = usePlaybackStore.subscribe(
      (state) => { eventIndexRef.current = state.currentEventIndex; },
    );
    eventIndexRef.current = usePlaybackStore.getState().currentEventIndex;
    return unsub;
  }, []);

  // Subscribe to heatmap state non-reactively
  useEffect(() => {
    const unsub = useHeatmapStore.subscribe(
      (s) => { heatmapRef.current = s.enabled; },
    );
    heatmapRef.current = useHeatmapStore.getState().enabled;
    return unsub;
  }, []);

  // Freeze after simulation settles: timer-based approach
  // When nodes arrive (session loaded), start a timer. After FREEZE_DELAY_MS,
  // pin all nodes at their current positions.
  useEffect(() => {
    if (nodes.length === 0 || frozen) return;
    clearTimeout(freezeTimerRef.current);
    freezeTimerRef.current = setTimeout(() => {
      const fg = fgRef.current;
      if (!fg) return;
      const gd = fg.graphData() as { nodes: GNode[] };
      for (const n of gd.nodes) {
        if (n.x != null && n.y != null) { n.fx = n.x; n.fy = n.y; }
        updatePositionCache(n.id, n.x ?? 0, n.y ?? 0, n.z ?? 0);
      }
      usePlaybackStore.getState().freeze();
    }, FREEZE_DELAY_MS);
    return () => clearTimeout(freezeTimerRef.current);
  }, [nodes.length, frozen]);

  const agentColorMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of nodes) {
      if (n.kind === 'agent' || n.kind === 'subagent') m.set(n.id, n.color);
    }
    return m;
  }, [nodes]);

  // Save positions periodically during initial settle (before freeze)
  useEffect(() => {
    const iv = setInterval(() => {
      if (frozenRef.current) return;
      const fg = fgRef.current;
      if (!fg || typeof fg.graphData !== 'function') return;
      for (const n of (fg.graphData() as { nodes: GNode[] }).nodes) {
        if (n.x != null && n.y != null) updatePositionCache(n.id, n.x, n.y, n.z ?? 0);
      }
    }, 500);
    return () => clearInterval(iv);
  }, []);

  // Mark initial layout done after first render with data
  useEffect(() => {
    if (nodes.length > 0) initialLayoutDone.current = true;
    if (nodes.length === 0) { initialLayoutDone.current = false; nodeObjMap.current.clear(); }
  }, [nodes.length]);

  // Stop orbit on user interaction, resume on play
  useEffect(() => {
    const el = fgRef.current?.renderer?.()?.domElement;
    if (!el) return;
    const stop = () => { orbitActive.current = false; };
    el.addEventListener('pointerdown', stop);
    return () => el.removeEventListener('pointerdown', stop);
  }, []);

  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  useEffect(() => {
    if (isPlaying) orbitActive.current = true;
  }, [isPlaying]);

  // Bloom always on (topology is frozen, no perf concern) — except during heatmap
  const heatmapEnabled = useHeatmapStore((s) => s.enabled);
  useEffect(() => {
    if (bloomPassRef.current) {
      bloomPassRef.current.enabled = !heatmapEnabled;
    }
  }, [heatmapEnabled]);

  // Animation loop: visibility, opacity, scale-in, ring rotation, orbit camera, heatmap
  useEffect(() => {
    let raf: number;
    let mapRebuilt = false;
    const animate = () => {
      const fg = fgRef.current;
      if (fg && typeof fg.graphData === 'function') {
        const now = Date.now();
        const idx = eventIndexRef.current;
        const allNodes = (fg.graphData() as { nodes: GNode[] }).nodes;

        // Auto-rebuild nodeObjMap from scene if lookups fail
        // This handles StrictMode double-mount, nudge hack timing, HMR, etc.
        if (allNodes.length > 0 && !mapRebuilt) {
          const first = allNodes[0];
          const obj0 = nodeObjMap.current.get(first.id);
          if (!obj0 || !obj0.parent) {
            const scene = (fg.scene as (() => Object3D) | undefined)?.();
            if (scene) {
              nodeObjMap.current.clear();
              scene.traverse((child: Object3D) => {
                const data = (child as any).__data;
                if ((child as any).__graphObjType === 'node' && data?.id) {
                  nodeObjMap.current.set(data.id as string, child);
                }
              });
              if (nodeObjMap.current.size > 0) {
                mapRebuilt = true;
              }
            }
          } else {
            mapRebuilt = true;
          }
        }

        // Heatmap transition detection
        const isHeatmap = heatmapRef.current;
        const wasHeatmap = prevHeatmapRef.current;
        if (wasHeatmap && !isHeatmap) {
          for (const n2 of allNodes) {
            const obj2 = nodeObjMap.current.get(n2.id);
            if (!obj2 || !obj2.parent) continue;
            const mats = obj2.userData.fadeMaterials as MeshBasicMaterial[] | undefined;
            if (mats) {
              for (const mat of mats) {
                mat.color.set(mat.userData.origColor);
              }
            }
            if (!birthTimes.current.has(n2.id)) obj2.scale.setScalar(1);
          }
          lastOpMap.current = new WeakMap<Object3D, number>();
        }
        prevHeatmapRef.current = isHeatmap;

        for (const n of allNodes) {
          const obj = nodeObjMap.current.get(n.id);
          if (!obj || !obj.parent) continue;

          // VISIBILITY CHECK: hide nodes not yet born at current timeline position
          const notYetBorn = n.firstAppearAt > idx;
          if (notYetBorn) {
            obj.visible = false;
            obj.scale.setScalar(0.001);
            const mats = obj.userData.fadeMaterials as MeshBasicMaterial[] | undefined;
            if (mats) for (const mat of mats) mat.opacity = 0;
            obj.userData.timelineHidden = true;
            lastOpMap.current.delete(obj);
            continue;
          }
          // Restore when node becomes visible after being hidden by timeline
          if (obj.userData.timelineHidden) {
            obj.visible = true;
            obj.scale.setScalar(1);
            obj.userData.timelineHidden = false;
          }

          // Live opacity computation
          const fadeRate = n.kind === 'bash' ? 0.1 : n.kind === 'subagent' ? 0.04 : 0.02;
          const minOp = n.kind === 'bash' ? 0.08 : n.kind === 'subagent' ? 0.10 : 0.35;
          const rawOp = Math.max(minOp, 1 - (idx - n.lastActiveAt) * fadeRate);
          const gap = idx - n.lastActiveAt;
          const isDead = n.kind === 'subagent' && gap > 30;
          const targetOp = isDead ? 0.15 : rawOp;

          n.opacity = targetOp;

          // Hide faded bash via scale
          if (!isHeatmap && n.kind === 'bash' && rawOp <= 0.08) {
            obj.scale.setScalar(0.001);
            continue;
          }

          // HEATMAP MODE
          if (isHeatmap) {
            const mats = obj.userData.fadeMaterials as MeshBasicMaterial[] | undefined;
            if (mats) {
              const hc = heatColor(n.accessCount);
              _heatColorObj.set(hc);
              const ac = n.accessCount || 0;
              const baseOp = ac <= 0 ? 0.15 : Math.min(1.0, 0.5 + ac * 0.05);
              for (const mat of mats) {
                mat.opacity = mat.userData.opScale < 0.2 ? 0.02 : baseOp * Math.max(0.3, mat.userData.opScale);
                mat.color.copy(_heatColorObj);
              }
            }
            const ac = n.accessCount || 0;
            const heatScale = ac <= 0 ? 0.4 : 0.7 + Math.log2(ac + 1) * 0.6;
            if (!birthTimes.current.has(n.id)) {
              obj.scale.setScalar(heatScale);
            }
          } else {
            // NORMAL MODE
            const lastOp = lastOpMap.current.get(obj);
            const wasDead = obj.userData.wasDeadBefore ?? false;
            const deadChanged = isDead !== wasDead;
            if (lastOp !== undefined && Math.abs(targetOp - lastOp) < 0.001 && !deadChanged) {
              // Skip material updates
            } else {
              lastOpMap.current.set(obj, targetOp);
              obj.userData.wasDeadBefore = isDead;

              const mats = obj.userData.fadeMaterials as MeshBasicMaterial[] | undefined;
              if (mats) {
                const isBash = n.kind === 'bash';
                for (const mat of mats) {
                  const raw = targetOp * mat.userData.opScale;
                  const noFloor = isBash || isDead || mat.userData.opScale < 0.2 || mat.userData.opScale >= 0.9;
                  mat.opacity = noFloor ? raw : Math.max(0.10, raw);
                  if (deadChanged) {
                    if (isDead) mat.color.copy(COLOR_DEAD);
                    else mat.color.set(mat.userData.origColor);
                  }
                }
              }
            }
          }

          // Scale-in animation (only during initial settle, not during scrubbing)
          const birth = birthTimes.current.get(n.id);
          if (birth != null) {
            const age = now - birth;
            if (age < ANIM_MS) {
              obj.scale.setScalar(Math.max(0.001, easeOutBack(age / ANIM_MS)));
            } else {
              if (obj.scale.x < 0.95) obj.scale.setScalar(1);
              birthTimes.current.delete(n.id);
            }
          }
          // Rotate torus rings
          if (n.kind === 'agent' || n.kind === 'subagent') {
            for (const child of obj.children) {
              if ((child as Mesh).geometry instanceof TorusGeometry) child.rotation.z += 0.004;
            }
          }

          // Z enforcement
          if (isDead) {
            if (n.z !== Z_GRAVEYARD) { n.z = Z_GRAVEYARD; obj.position.z = Z_GRAVEYARD; }
            const cx = n.x ?? 0, cy = n.y ?? 0;
            const dist = Math.sqrt(cx * cx + cy * cy) || 1;
            if (dist < 500) {
              n.x = cx + (cx / dist) * 0.3;
              n.y = cy + (cy / dist) * 0.3;
              obj.position.x = n.x;
              obj.position.y = n.y;
            }
          } else {
            const depth = (n.depth as number) ?? 0;
            let targetZ: number;
            switch (n.kind) {
              case 'agent':     targetZ = Z_MAIN_AGENT; break;
              case 'subagent':  targetZ = Z_SUBAGENT; break;
              case 'bash':      targetZ = Z_BASH; break;
              case 'file':      targetZ = Z_DIR + (depth - 1) * Z_DIR_DEPTH_STEP - 6; break;
              case 'directory': targetZ = Z_DIR + depth * Z_DIR_DEPTH_STEP; break;
              case 'url':       targetZ = Z_URL; break;
              default:          targetZ = 0;
            }
            if (n.z !== targetZ) { n.z = targetZ; obj.position.z = targetZ; }
          }
        }

        // Slow orbit camera
        if (orbitActive.current) {
          orbitAngle.current += ORBIT_SPEED;
          const a = orbitAngle.current;
          fg.cameraPosition(
            { x: Math.sin(a) * ORBIT_RADIUS, y: ORBIT_TILT + Math.cos(a) * 40, z: 200 + Math.cos(a) * 60 },
            { x: 0, y: 0, z: ORBIT_LOOK_Z },
          );
        }
      }
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Build a nodeId→firstAppearAt map for edge visibility checks
  const nodeFirstAppearMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of nodes) m.set(n.id, n.firstAppearAt);
    return m;
  }, [nodes]);

  const graphData = useMemo(() => {
    const graphNodes: GNode[] = nodes.map((n) => ({
      id: n.id, kind: n.kind, label: n.label, color: n.color,
      tokens: n.tokens, accessCount: n.accessCount,
      lastActiveAt: n.lastActiveAt, spawnedAt: n.spawnedAt,
      firstAppearAt: n.firstAppearAt,
      directory: n.directory, depth: n.depth,
      opacity: 1,
      ...((n as Record<string, unknown>).x != null ? {
        x: (n as Record<string, unknown>).x as number,
        y: (n as Record<string, unknown>).y as number,
        z: (n as Record<string, unknown>).z as number,
      } : {}),
    }));

    const nodeIds = new Set(graphNodes.map((n) => n.id));

    // Position new nodes near connected neighbor
    const posMap = new Map<string, { x: number; y: number }>();
    for (const n of graphNodes) {
      if (n.x != null && n.y != null) posMap.set(n.id, { x: n.x, y: n.y });
    }
    for (const n of graphNodes) {
      if (n.x != null) continue;
      for (const e of edges) {
        const sid = typeof e.source === 'string' ? e.source : (e.source as { id: string }).id;
        const tid = typeof e.target === 'string' ? e.target : (e.target as { id: string }).id;
        const neighborId = sid === n.id ? tid : tid === n.id ? sid : null;
        if (!neighborId) continue;
        const pos = posMap.get(neighborId);
        if (pos) { n.x = pos.x + (Math.random() - 0.5) * 30; n.y = pos.y + (Math.random() - 0.5) * 30; break; }
      }
    }

    const graphLinks: GLink[] = edges.filter((e) => {
      const sid = typeof e.source === 'string' ? e.source : (e.source as { id: string }).id;
      const tid = typeof e.target === 'string' ? e.target : (e.target as { id: string }).id;
      return nodeIds.has(sid) && nodeIds.has(tid);
    }).map((e) => {
      const sid = typeof e.source === 'string' ? e.source : (e.source as { id: string }).id;
      const tid = typeof e.target === 'string' ? e.target : (e.target as { id: string }).id;
      const isAgentSub = (sid.startsWith('agent:') || sid.startsWith('subagent:'))
        && (tid.startsWith('agent:') || tid.startsWith('subagent:'));
      const isDirTree = sid.startsWith('dir:') || tid.startsWith('dir:');
      const agentColor = agentColorMap.get(sid) ?? agentColorMap.get(tid) ?? '#60a5fa';
      return {
        source: e.source, target: e.target, opacity: 1, color: agentColor,
        active: true, direction: e.direction, agentColor, structural: isAgentSub || isDirTree,
        lastActiveAt: e.lastActiveAt, firstAppearAt: e.firstAppearAt,
      };
    });

    // Topology is fixed after initial load — always return stable ref after first build
    if (topoVersion === prevTopoRef.current && stableGraphRef.current.nodes.length > 0) {
      const stable = stableGraphRef.current;
      const nodeMap = new Map(nodes.map((n) => [n.id, n]));
      for (const sn of stable.nodes) {
        const src = nodeMap.get(sn.id);
        if (src) { sn.lastActiveAt = src.lastActiveAt; sn.tokens = src.tokens; sn.accessCount = src.accessCount; sn.depth = src.depth; }
      }
      const edgeMap = new Map(edges.map((e) => [`${e.source}->${e.target}`, e]));
      for (const sl of stable.links) {
        const s = typeof sl.source === 'string' ? sl.source : (sl.source as { id: string }).id;
        const t = typeof sl.target === 'string' ? sl.target : (sl.target as { id: string }).id;
        const src = edgeMap.get(`${s}->${t}`);
        if (src) sl.lastActiveAt = src.lastActiveAt;
      }
      return stable;
    }

    prevTopoRef.current = topoVersion;
    stableGraphRef.current = { nodes: graphNodes, links: graphLinks };
    return stableGraphRef.current;
  }, [nodes, edges, topoVersion, agentColorMap]);

  // Setup: bloom, forces
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.cameraPosition(
      { x: 0, y: ORBIT_TILT + 40, z: 260 },
      { x: 0, y: 0, z: ORBIT_LOOK_Z },
    );
    if (!bloomAdded.current) {
      try {
        const bloom = new UnrealBloomPass(
          new Vector2(window.innerWidth / 2, window.innerHeight / 2), 0.4, 0.4, 0.35,
        );
        fg.postProcessingComposer().addPass(bloom);
        bloomPassRef.current = bloom;
        bloomAdded.current = true;
      } catch { /* fallback */ }
    }
    fg.d3Force('spatialZone', spatialZoneForce(0.08) as never);
    fg.d3Force('directoryCluster', directoryClusterForce(0.06) as never);
    fg.d3Force('center', null);
    fg.d3Force('x', forceX(0).strength(0.01) as never);
    fg.d3Force('y', forceY(0).strength(0.01) as never);
    fg.d3Force('charge')?.strength(-30);
    fg.d3Force('link')?.distance((link: GLink) => {
      const sid = typeof link.source === 'string' ? link.source : (link.source as { id: string }).id;
      return sid.startsWith('dir:') ? 15 : 45;
    });
  }, []);

  const nodeThreeObject = useCallback((node: GNode) => {
    const { kind, color, label, tokens, accessCount } = node;
    const group = new Object3D();
    let sz: number;

    if (!birthTimes.current.has(node.id)) {
      if (getCachedPosition(node.id)) {
        group.scale.setScalar(1);
      } else {
        birthTimes.current.set(node.id, Date.now());
        group.scale.setScalar(0.001);
      }
    }

    const m = (c: string, opScale: number) => {
      const mat = new MeshBasicMaterial({ color: c, transparent: true, opacity: opScale });
      mat.userData = { opScale, origColor: c };
      return mat;
    };

    const fadeMaterials: MeshBasicMaterial[] = [];

    switch (kind) {
      case 'agent': {
        sz = 6 + Math.sqrt(tokens / 900) * 1.5;
        const m1 = m(color, 1.0); fadeMaterials.push(m1);
        group.add(new Mesh(new SphereGeometry(sz, 16, 16), m1));
        const m2 = m('#fff', 0.4); fadeMaterials.push(m2);
        group.add(new Mesh(new SphereGeometry(sz * 0.3, 8, 8), m2));
        const m3 = m(color, 0.6); fadeMaterials.push(m3);
        const r1 = new Mesh(new TorusGeometry(sz * 1.4, 0.3, 6, 32), m3);
        r1.rotation.x = Math.PI / 2; group.add(r1);
        const m4 = m(color, 0.3); fadeMaterials.push(m4);
        const r2 = new Mesh(new TorusGeometry(sz * 1.7, 0.15, 6, 32), m4);
        r2.rotation.x = Math.PI / 2; r2.rotation.y = Math.PI / 4; group.add(r2);
        const m5 = m(color, 0.12); fadeMaterials.push(m5);
        group.add(new Mesh(new SphereGeometry(sz * 1.5, 6, 6), m5));
        const m6 = m(color, 0.04); fadeMaterials.push(m6);
        group.add(new Mesh(new SphereGeometry(sz * 2.4, 6, 6), m6));
        const l = makeLabel(label, color, true);
        fadeMaterials.push(l.material as unknown as MeshBasicMaterial);
        l.position.set(0, -(sz + 5), 0); group.add(l);
        break;
      }
      case 'subagent': {
        sz = 4.5 + Math.sqrt(tokens / 1000) * 1.2;
        const m1 = m(color, 1.0); fadeMaterials.push(m1);
        group.add(new Mesh(new OctahedronGeometry(sz), m1));
        const m2 = m('#fff', 0.3); fadeMaterials.push(m2);
        group.add(new Mesh(new OctahedronGeometry(sz * 0.25), m2));
        const m3 = m(color, 0.45); fadeMaterials.push(m3);
        const sr = new Mesh(new TorusGeometry(sz * 1.3, 0.2, 6, 24), m3);
        sr.rotation.x = Math.PI * 0.35; sr.rotation.z = Math.PI * 0.2; group.add(sr);
        const m4 = m(color, 0.1); fadeMaterials.push(m4);
        group.add(new Mesh(new SphereGeometry(sz * 1.5, 6, 6), m4));
        const sl = makeLabel(label, color, true);
        fadeMaterials.push(sl.material as unknown as MeshBasicMaterial);
        sl.position.set(0, -(sz + 4), 0); group.add(sl);
        break;
      }
      case 'directory': {
        sz = 6;
        const rm = m(color, 0.35); rm.side = DoubleSide; fadeMaterials.push(rm);
        group.add(new Mesh(new RingGeometry(sz - 1.2, sz, 24), rm));
        const dl = makeLabel(label, '#64748b', false);
        fadeMaterials.push(dl.material as unknown as MeshBasicMaterial);
        dl.position.set(0, -(sz + 2), 0); group.add(dl);
        break;
      }
      case 'file': {
        sz = 2.2 + Math.log2(accessCount + 1) * 0.7;
        const m1 = m(color, 1.0); fadeMaterials.push(m1);
        group.add(new Mesh(new SphereGeometry(sz, 10, 10), m1));
        const m2 = m(color, 0.1); fadeMaterials.push(m2);
        group.add(new Mesh(new SphereGeometry(sz * 1.7, 6, 6), m2));
        const fl = makeLabel(label, color, false);
        fadeMaterials.push(fl.material as unknown as MeshBasicMaterial);
        fl.position.set(0, -(sz + 2), 0); group.add(fl);
        break;
      }
      case 'bash': {
        sz = 2.5;
        const m1 = m(color, 0.8); fadeMaterials.push(m1);
        group.add(new Mesh(new OctahedronGeometry(sz, 0), m1));
        const m2 = m(color, 0.15); fadeMaterials.push(m2);
        group.add(new Mesh(new SphereGeometry(sz * 2, 6, 6), m2));
        const bl = makeLabel(label, color, false);
        fadeMaterials.push(bl.material as unknown as MeshBasicMaterial);
        bl.position.set(0, -(sz + 2), 0); group.add(bl);
        break;
      }
      case 'url': {
        sz = 4;
        const m1 = m(color, 1.0); fadeMaterials.push(m1);
        group.add(new Mesh(new OctahedronGeometry(sz), m1));
        const m2 = m(color, 0.08); fadeMaterials.push(m2);
        group.add(new Mesh(new SphereGeometry(sz * 1.5, 6, 6), m2));
        const ul = makeLabel(label, color, false);
        fadeMaterials.push(ul.material as unknown as MeshBasicMaterial);
        ul.position.set(0, -(sz + 3), 0); group.add(ul);
        break;
      }
      default: {
        const dm = m(color, 1.0); fadeMaterials.push(dm);
        group.add(new Mesh(new SphereGeometry(2, 6, 6), dm));
        break;
      }
    }

    group.userData.fadeMaterials = fadeMaterials;
    group.userData.wasDeadBefore = false;

    // Register in our own map — library's __threeObj binding breaks when
    // graphData useMemo creates new GNode objects across digest cycles
    nodeObjMap.current.set(node.id, group);

    return group;
  }, []);

  const handleNodeClick = useCallback((nodeData: GNode) => {
    const n = usePlaybackStore.getState().nodes.find((s) => s.id === nodeData.id);
    if (n) select(n);
  }, [select]);

  // Drag handlers: unpin on drag, re-pin on release
  const handleNodeDrag = useCallback((node: GNode) => {
    // During drag, let the node follow the cursor (library handles this)
    // Just remove the pin so simulation can affect it
    node.fx = node.x;
    node.fy = node.y;
  }, []);

  const handleNodeDragEnd = useCallback((node: GNode) => {
    // Re-pin at new position
    node.fx = node.x;
    node.fy = node.y;
    if (node.x != null && node.y != null) {
      updatePositionCache(node.id, node.x, node.y, node.z ?? 0);
    }
  }, []);

  // Force link visual refresh during playback
  const [linkEpoch, setLinkEpoch] = useState(0);
  useEffect(() => {
    if (!isPlaying) return;
    const iv = setInterval(() => setLinkEpoch((e) => e + 1), 200);
    return () => clearInterval(iv);
  }, [isPlaying]);

  // Also refresh links when scrubbing (not playing but index changes)
  useEffect(() => {
    const unsub = usePlaybackStore.subscribe(
      (state, prev) => {
        if (state.currentEventIndex !== prev.currentEventIndex && !state.isPlaying) {
          setLinkEpoch((e) => e + 1);
        }
      },
    );
    return unsub;
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const linkColorFn = useCallback((link: GLink) => {
    const idx = eventIndexRef.current;
    // Hide edges whose endpoints aren't yet visible
    const sid = typeof link.source === 'string' ? link.source : (link.source as { id: string }).id;
    const tid = typeof link.target === 'string' ? link.target : (link.target as { id: string }).id;
    const srcFirst = nodeFirstAppearMap.get(sid) ?? 0;
    const tgtFirst = nodeFirstAppearMap.get(tid) ?? 0;
    if (srcFirst > idx || tgtFirst > idx || link.firstAppearAt > idx) {
      return 'rgba(0,0,0,0)';
    }

    if (heatmapRef.current) {
      return link.structural ? 'rgba(100,116,139,0.2)' : 'rgba(234,179,8,0.5)';
    }
    const age = idx - link.lastActiveAt;
    const active = age < 6;
    if (link.structural) {
      if (active) {
        return link.direction === 'write'
          ? 'rgba(251,191,36,0.7)' : `rgba(${hexToRgb(link.agentColor)},0.55)`;
      }
      return `rgba(${hexToRgb(link.agentColor)},0.3)`;
    }
    if (!active) {
      const op = Math.max(0.08, 1 - age * 0.04);
      return `rgba(60,80,120,${op * 0.5})`;
    }
    return link.direction === 'write'
      ? 'rgba(251,191,36,0.7)' : `rgba(${hexToRgb(link.agentColor)},0.55)`;
  }, [linkEpoch, nodeFirstAppearMap]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const linkWidthFn = useCallback((link: GLink) => {
    const idx = eventIndexRef.current;
    // Hide edges whose endpoints aren't yet visible
    const sid = typeof link.source === 'string' ? link.source : (link.source as { id: string }).id;
    const tid = typeof link.target === 'string' ? link.target : (link.target as { id: string }).id;
    const srcFirst = nodeFirstAppearMap.get(sid) ?? 0;
    const tgtFirst = nodeFirstAppearMap.get(tid) ?? 0;
    if (srcFirst > idx || tgtFirst > idx || link.firstAppearAt > idx) {
      return 0;
    }

    if (heatmapRef.current) {
      return link.structural ? 0.3 : 1.5;
    }
    if (link.structural) {
      const age = idx - link.lastActiveAt;
      return age < 6 ? 1.5 : 0.3;
    }
    const age = idx - link.lastActiveAt;
    return age < 6 ? 0.6 : 0.35;
  }, [linkEpoch, nodeFirstAppearMap]);

  // Full warmup for initial settle, then no warmup needed (topology never changes)
  const warmupTicks = initialLayoutDone.current ? 0 : 100;

  // Scene-based visibility — direct scene traversal as backup for nodeObjMap approach
  // Fires on every timeline index change, uses library's __data binding (always correct)
  useEffect(() => {
    const unsub = usePlaybackStore.subscribe(
      (state, prev) => {
        if (state.currentEventIndex === prev.currentEventIndex) return;
        const fg = fgRef.current;
        if (!fg) return;
        const scene = (fg.scene as (() => Object3D) | undefined)?.();
        if (!scene) return;
        const idx = state.currentEventIndex;
        scene.traverse((child: Object3D) => {
          const data = (child as any).__data;
          if ((child as any).__graphObjType === 'node' && data) {
            const firstAppear = (data.firstAppearAt as number) ?? 0;
            const shouldShow = firstAppear <= idx;
            child.visible = shouldShow;
            if (!shouldShow && child.scale.x > 0.01) {
              child.scale.setScalar(0.001);
            } else if (shouldShow && child.scale.x < 0.01) {
              child.scale.setScalar(1);
            }
          }
        });
      },
    );
    return unsub;
  }, []);

  return (
    <ForceGraph3D
      ref={fgRef} width={width} height={height}
      graphData={graphData} backgroundColor={isDark ? "#020208" : "#f4f4f8"}
      nodeId="id" nodeLabel=""
      nodeThreeObject={nodeThreeObject as never}
      onNodeClick={handleNodeClick as never}
      onNodeDrag={handleNodeDrag as never}
      onNodeDragEnd={handleNodeDragEnd as never}
      linkColor={linkColorFn as never}
      linkOpacity={1}
      linkWidth={linkWidthFn as never}
      showNavInfo={false} enableNavigationControls={true}
      d3VelocityDecay={0.4} d3AlphaDecay={0.03}
      warmupTicks={warmupTicks} cooldownTime={1500}
    />
  );
}
