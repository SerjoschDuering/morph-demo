/**
 * Keyframe layout engine — pre-computes settled force layouts at intervals.
 * During playback, positions are interpolated between keyframes.
 * The library's internal d3 simulation is completely disabled.
 */
import {
  forceSimulation, forceLink, forceManyBody, forceX, forceY,
} from 'd3-force-3d';
import { buildGraphState, resetBuilder } from './graph-builder.ts';
import { spatialZoneForce, directoryClusterForce } from '../graph/custom-forces.ts';
import type { SessionEvent } from '../parser/types.ts';

export interface Keyframe {
  eventIndex: number;
  positions: Map<string, { x: number; y: number; z: number }>;
}

const KEYFRAME_INTERVAL = 50;
const TICKS_FIRST = 250;   // full convergence for first keyframe
const TICKS_SEEDED = 60;   // incremental for subsequent (positions seeded from previous)

interface SimNode {
  id: string; kind: string; directory?: string; depth?: number; opacity?: number;
  x?: number; y?: number; z?: number;
  vx?: number; vy?: number; vz?: number;
}

function runSimulation(
  nodes: SimNode[],
  links: { source: string; target: string }[],
  ticks: number,
): void {
  const sim = forceSimulation(nodes, 3)
    .force('charge', forceManyBody().strength(-20))
    .force('link', forceLink(links)
      .id((d: SimNode) => d.id)
      .distance((link: { source: SimNode | string; target: SimNode | string }) => {
        const sid = typeof link.source === 'string' ? link.source : link.source.id;
        return sid.startsWith('dir:') ? 15 : 45;
      }))
    .force('x', forceX(0).strength(0.01))
    .force('y', forceY(0).strength(0.01))
    .force('spatialZone', spatialZoneForce(0.08) as never)
    .force('directoryCluster', directoryClusterForce(0.06) as never)
    .stop();

  sim.tick(ticks);
}

function extractPositions(nodes: SimNode[]): Map<string, { x: number; y: number; z: number }> {
  const positions = new Map<string, { x: number; y: number; z: number }>();
  for (const n of nodes) {
    positions.set(n.id, { x: n.x ?? 0, y: n.y ?? 0, z: n.z ?? 0 });
  }
  return positions;
}

export function computeKeyframes(
  events: SessionEvent[],
  agents: string[],
): Keyframe[] {
  if (events.length === 0) return [];

  const t0 = performance.now();
  const keyframes: Keyframe[] = [];
  let prevPositions = new Map<string, { x: number; y: number; z: number }>();

  resetBuilder();

  // Compute keyframe at each interval
  const lastIdx = events.length - 1;
  for (let idx = 0; idx <= lastIdx; idx += KEYFRAME_INTERVAL) {
    const targetIdx = Math.min(idx, lastIdx);
    const { nodes, edges } = buildGraphState(events, targetIdx, agents);

    // Clone nodes for simulation — seed from previous keyframe positions
    const simNodes: SimNode[] = nodes.map(n => {
      const prev = prevPositions.get(n.id);
      return {
        id: n.id, kind: n.kind, directory: n.directory, depth: n.depth, opacity: 1,
        ...(prev ? { x: prev.x, y: prev.y, z: prev.z } : {}),
      };
    });
    const simLinks = edges.map(e => ({ source: e.source, target: e.target }));

    const ticks = keyframes.length === 0 ? TICKS_FIRST : TICKS_SEEDED;
    runSimulation(simNodes, simLinks, ticks);

    const positions = extractPositions(simNodes);
    keyframes.push({ eventIndex: targetIdx, positions });
    prevPositions = positions;
  }

  // Ensure final keyframe covers the very last event
  const lastKf = keyframes[keyframes.length - 1];
  if (lastKf && lastKf.eventIndex < lastIdx) {
    const { nodes, edges } = buildGraphState(events, lastIdx, agents);
    const simNodes: SimNode[] = nodes.map(n => {
      const prev = prevPositions.get(n.id);
      return {
        id: n.id, kind: n.kind, directory: n.directory, depth: n.depth, opacity: 1,
        ...(prev ? { x: prev.x, y: prev.y, z: prev.z } : {}),
      };
    });
    const simLinks = edges.map(e => ({ source: e.source, target: e.target }));
    runSimulation(simNodes, simLinks, TICKS_SEEDED);
    keyframes.push({ eventIndex: lastIdx, positions: extractPositions(simNodes) });
  }

  // Clean up builder state for live playback use
  resetBuilder();

  console.log(`[layout-engine] ${keyframes.length} keyframes computed in ${(performance.now() - t0).toFixed(0)}ms`);
  return keyframes;
}

/** Interpolate positions between the two nearest keyframes */
export function interpolatePositions(
  keyframes: Keyframe[],
  eventIndex: number,
): Map<string, { x: number; y: number; z: number }> | null {
  if (keyframes.length === 0) return null;

  // Binary search for bracketing keyframes
  let lo = 0, hi = keyframes.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (keyframes[mid]!.eventIndex <= eventIndex) lo = mid;
    else hi = mid;
  }

  const kf0 = keyframes[lo]!;
  const kf1 = keyframes[hi]!;

  // At or before first keyframe
  if (eventIndex <= kf0.eventIndex) return kf0.positions;
  // At or after last keyframe, or single keyframe
  if (lo === hi || eventIndex >= kf1.eventIndex) return kf1.positions;

  // Lerp between keyframes
  const t = (eventIndex - kf0.eventIndex) / (kf1.eventIndex - kf0.eventIndex);
  const result = new Map<string, { x: number; y: number; z: number }>();

  const allIds = new Set([...kf0.positions.keys(), ...kf1.positions.keys()]);
  for (const id of allIds) {
    const p0 = kf0.positions.get(id);
    const p1 = kf1.positions.get(id);
    if (p0 && p1) {
      // Smooth interpolation between settled layouts
      result.set(id, {
        x: p0.x + (p1.x - p0.x) * t,
        y: p0.y + (p1.y - p0.y) * t,
        z: p0.z + (p1.z - p0.z) * t,
      });
    } else if (p1) {
      // New node — appear at target position (scale-in animation handles the visual)
      result.set(id, p1);
    } else if (p0) {
      // Node removed in next keyframe — hold last known position
      result.set(id, p0);
    }
  }
  return result;
}
