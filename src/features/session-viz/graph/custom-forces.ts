/**
 * Custom d3-force functions for spatial layout of session graph nodes.
 */

interface ForceNode {
  id?: string | number;
  x?: number; y?: number; z?: number;
  vx?: number; vy?: number; vz?: number;
  kind?: string;
  directory?: string;
  opacity?: number;
  depth?: number;
  [key: string]: unknown;
}

// Z-layer base targets (exported for RAF loop enforcement in ForceGraph)
export const Z_MAIN_AGENT = 75;
export const Z_SUBAGENT = 40;
export const Z_FILE = -4;            // base for files (slightly below 0; depth step does the heavy lifting)
export const Z_DIR = -2;             // base for dirs (above files at same depth)
export const Z_BASH = 15;            // bash commands near agents (ephemeral)
export const Z_URL = -80;            // URLs well below all files (remote = far away)
export const Z_GRAVEYARD = 95;       // dead subagents float UP above everything
export const Z_DIR_DEPTH_STEP = -12; // each directory level drops 12 units
export const Z_FILE_DEPTH_STEP = -12; // (unused — files use Z_DIR formula minus offset)
export const Z_FILE_DIR_FLOOR = -999; // no floor — let deep files go wherever

/**
 * Push nodes into spatial zones by kind.
 * Files/dirs/urls are hard-pinned to their Z plane (no oscillation).
 * Deeper paths sit slightly lower, giving a subtle layered feel.
 * Agents float above.
 */
export function spatialZoneForce(strength = 0.08) {
  let nodes: ForceNode[] = [];
  let zTargets: Float64Array = new Float64Array(0);

  function force(alpha: number) {
    const s = strength * alpha;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]!;
      const kind = node.kind as string | undefined;
      if (!kind) continue;

      // Dead subagents: skip Z/velocity — RAF loop handles graveyard positioning
      if (kind === 'subagent' && (node.opacity ?? 1) < 0.15) continue;

      const targetZ = zTargets[i]!;
      node.z = targetZ;
      node.vz = 0;

      switch (kind) {
        case 'agent':
          node.vx = (node.vx ?? 0) * (1 - s * 4);
          node.vy = (node.vy ?? 0) * (1 - s * 4);
          break;
        case 'subagent':
          node.vx = (node.vx ?? 0) * (1 - s * 2.5);
          node.vy = (node.vy ?? 0) * (1 - s * 2.5);
          break;
        case 'url':
          node.vy = (node.vy ?? 0) - s * 25;
          break;
      }
    }
  }

  force.initialize = (n: ForceNode[]) => {
    nodes = n;
    zTargets = new Float64Array(n.length);
    for (let i = 0; i < n.length; i++) {
      const node = n[i]!;
      const kind = node.kind as string | undefined;
      const depth = (node.depth as number) ?? 0;
      switch (kind) {
        case 'agent':     zTargets[i] = Z_MAIN_AGENT; break;
        case 'subagent':  zTargets[i] = Z_SUBAGENT; break;
        case 'file':      zTargets[i] = Z_DIR + (depth - 1) * Z_DIR_DEPTH_STEP - 6; break;
        case 'directory':  zTargets[i] = Z_DIR + depth * Z_DIR_DEPTH_STEP; break;
        case 'bash':      zTargets[i] = Z_BASH; break;
        case 'url':       zTargets[i] = Z_URL; break;
        default:          zTargets[i] = 0;
      }
    }
  };

  return force;
}

/**
 * Files/directories attract toward their parent directory node.
 * Only affects XY — Z is handled by spatialZoneForce.
 */
export function directoryClusterForce(strength = 0.06) {
  let nodes: ForceNode[] = [];
  let dirNodes = new Map<string, ForceNode>();

  function force(alpha: number) {
    const s = strength * alpha;

    for (const node of nodes) {
      if (!node.directory) continue;
      const parent = dirNodes.get(node.directory);
      if (!parent || parent.x == null || parent.y == null) continue;

      const dx = parent.x - (node.x ?? 0);
      const dy = parent.y - (node.y ?? 0);
      const pull = node.kind === 'file' ? s * 1.5 : s;
      node.vx = (node.vx ?? 0) + dx * pull;
      node.vy = (node.vy ?? 0) + dy * pull;
    }
  }

  force.initialize = (n: ForceNode[]) => {
    nodes = n;
    dirNodes = new Map();
    for (const node of n) {
      if (node.kind === 'directory') {
        const dirPath = String(node.id ?? '').replace(/^dir:/, '');
        dirNodes.set(dirPath, node);
      }
    }
  };

  return force;
}
