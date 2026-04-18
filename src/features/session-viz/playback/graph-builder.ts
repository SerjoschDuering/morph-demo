/**
 * Incremental graph state builder.
 * Maintains internal state and only processes new events since last call.
 */
import type { SessionEvent, GraphNode, GraphEdge } from '../parser/types.ts';

const MAIN_AGENT_COLOR = '#06b6d4';   // cyan — main agent
const SUBAGENT_COLOR = '#e879f9';      // fuchsia-400 — all subagents (distinct from file colors)
const URL_COLOR = '#fb923c';           // orange — web URLs
const BASH_COLOR = '#a3e635';          // lime — bash commands
const DIR_COLOR = '#475569';

const EXT_COLORS: Record<string, string> = {
  ts: '#38bdf8', tsx: '#38bdf8', js: '#fbbf24', jsx: '#fbbf24',
  py: '#34d399', rs: '#fb923c', go: '#00add8',
  json: '#fb923c', yaml: '#fb923c', yml: '#fb923c', toml: '#fb923c',
  md: '#a78bfa', mdx: '#a78bfa',         // violet-400 (not fuchsia)
  css: '#2dd4bf', scss: '#2dd4bf', html: '#fb7185',  // teal for stylesheets
  sh: '#a3e635', bash: '#a3e635', zsh: '#a3e635',
  sql: '#60a5fa', graphql: '#e535ab',
  svg: '#fbbf24', png: '#94a3b8', jpg: '#94a3b8',
};
const DEFAULT_FILE_COLOR = '#94a3b8';

function fileColor(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return EXT_COLORS[ext] ?? DEFAULT_FILE_COLOR;
}

// Position cache persists across rebuilds
const positionCache = new Map<string, { x: number; y: number; z: number }>();

export function getCachedPosition(id: string) {
  return positionCache.get(id);
}
export function updatePositionCache(id: string, x: number, y: number, z: number) {
  positionCache.set(id, { x, y, z });
}

function agentNodeId(agent: string): string {
  if (agent === 'main') return 'agent:main';
  // Resolve raw agent ID to display slug (set during agent_spawn)
  const slug = _agentSlugMap.get(agent) ?? agent;
  return `subagent:${slug}`;
}

function urlDomain(target: string): string {
  try { return new URL(target).hostname; } catch { return target.slice(0, 40); }
}

function edgeDir(ev: SessionEvent): 'read' | 'write' {
  return ev.type === 'file_write' || ev.type === 'file_edit' ? 'write' : 'read';
}

/** Shared incremental builder state */
let _nodeMap = new Map<string, GraphNode>();
let _edgeMap = new Map<string, GraphEdge>();
let _lastBuiltIndex = -2; // -2 means uninitialized
let _filePaths = new Map<string, { nodeId: string; events: number; firstAt: number; lastAt: number; agentEdges: Map<string, { direction: 'read'|'write'; firstAt: number; lastAt: number; rawAgent: string }> }>();
let _urlDomains = new Map<string, { count: number; firstAt: number; lastAt: number }>();
let _dirSet = new Set<string>();
// _agents removed — was assigned but never read
let _derivedDirty = false;
let _agentSlugMap = new Map<string, string>(); // raw agent ID → display slug
let _slugMapReady = false;
let _topoVersion = 0;
let _cachedNodes: GraphNode[] | null = null;
let _cachedEdges: GraphEdge[] | null = null;
let _cachedNodeCount = 0;
let _cachedEdgeCount = 0;

export function resetBuilder() {
  _nodeMap = new Map();
  _edgeMap = new Map();
  _lastBuiltIndex = -2;
  _filePaths = new Map();
  _urlDomains = new Map();
  _dirSet = new Set();
  _derivedDirty = false;
  _agentSlugMap = new Map();
  _slugMapReady = false;
  _commonPrefix = '';
  _commonPrefixDirty = true;
  _topoVersion = 0;
  _cachedNodes = null;
  _cachedEdges = null;
  _cachedNodeCount = 0;
  _cachedEdgeCount = 0;
  positionCache.clear();
}

export function getTopoVersion() { return _topoVersion; }

function ensureAgent(agent: string, eventIdx: number) {
  const id = agentNodeId(agent);
  if (_nodeMap.has(id)) return;
  const isMain = agent === 'main';
  const slug = _agentSlugMap.get(agent);
  _nodeMap.set(id, {
    id, kind: isMain ? 'agent' : 'subagent',
    label: slug ?? agent, color: isMain ? MAIN_AGENT_COLOR : SUBAGENT_COLOR,
    tokens: 0, accessCount: 0,
    lastActiveAt: eventIdx, spawnedAt: eventIdx,
    firstAppearAt: eventIdx,
    rawAgentId: isMain ? undefined : agent,
  });
  _topoVersion++;
  // Auto-connect subagents to main agent (structural tether)
  if (!isMain) {
    const mainId = 'agent:main';
    const eId = `${mainId}->${id}`;
    if (!_edgeMap.has(eId)) {
      _edgeMap.set(eId, {
        source: mainId, target: id, agent: 'main',
        direction: 'read', lastActiveAt: eventIdx,
        firstAppearAt: eventIdx,
      });
      _topoVersion++;
    }
  }
}


// No depth cap — let natural directory depth drive Z layering
let _commonPrefix = '';
let _commonPrefixDirty = true;

/** Compute longest common directory prefix of all file paths in _filePaths.
 *  Always leaves at least 2 segments in relative paths (dir + filename). */
function recomputeCommonPrefix() {
  const paths = [..._filePaths.keys()];
  if (paths.length === 0) { _commonPrefix = ''; return; }
  const segments = paths.map(p => p.split('/'));
  const first = segments[0]!;
  // Start with max possible prefix (all but filename)
  let prefixLen = first.length - 1;
  for (const segs of segments) {
    prefixLen = Math.min(prefixLen, segs.length - 1);
    for (let j = 0; j < prefixLen; j++) {
      if (segs[j] !== first[j]) { prefixLen = j; break; }
    }
  }
  // Cap: always leave at least 2 segments (one dir + filename) for relative paths
  const shortest = Math.min(...segments.map(s => s.length));
  prefixLen = Math.min(prefixLen, Math.max(0, shortest - 2));
  _commonPrefix = first.slice(0, prefixLen).join('/');
  if (_commonPrefix) _commonPrefix += '/';
}

/** Get path relative to common prefix */
function relativePath(absPath: string): string {
  let rel = absPath;
  if (_commonPrefix && absPath.startsWith(_commonPrefix)) {
    rel = absPath.slice(_commonPrefix.length);
  }
  return rel.split('/').filter(Boolean).join('/');
}

function processEvent(ev: SessionEvent, i: number) {
  // Agent spawn — register ID→slug mapping, create node
  if (ev.type === 'agent_spawn') {
    const rawId = ev.metadata?.agentId;
    const desc = ev.metadata?.agentDescription;

    // Register mapping: raw agent ID → human-readable slug
    if (rawId && desc) {
      _agentSlugMap.set(rawId, desc);
      // Create the subagent node using the raw ID (agentNodeId resolves via slug map)
      const subId = agentNodeId(rawId);
      const parentId = agentNodeId(ev.agent);
      const existing = _nodeMap.get(subId);
      // Track firstAppearAt from any pre-wired edge that may get replaced
      let edgeFirstAppear = i;
      if (!existing) {
        _nodeMap.set(subId, {
          id: subId, kind: 'subagent', label: desc, color: SUBAGENT_COLOR,
          tokens: 0, accessCount: 0, lastActiveAt: i, spawnedAt: i,
          firstAppearAt: i, agent: ev.agent,
          rawAgentId: rawId,
        });
        _topoVersion++;
        _derivedDirty = true;
      } else {
        // Node was pre-created by ensureAgent — update label/rawAgentId
        existing.label = desc;
        existing.rawAgentId = rawId;
        existing.agent = ev.agent;
        // Fix parent edge if ensureAgent wired to wrong parent (e.g., main instead of actual parent)
        const wrongEdgeId = `agent:main->${subId}`;
        const correctEdgeId = `${parentId}->${subId}`;
        if (wrongEdgeId !== correctEdgeId && _edgeMap.has(wrongEdgeId)) {
          // Preserve the earlier firstAppearAt from the auto-wired edge
          edgeFirstAppear = _edgeMap.get(wrongEdgeId)!.firstAppearAt;
          _edgeMap.delete(wrongEdgeId);
          _topoVersion++;
        }
      }
      if (!_edgeMap.has(`${parentId}->${subId}`)) {
        _edgeMap.set(`${parentId}->${subId}`, {
          source: parentId, target: subId, agent: ev.agent,
          direction: 'read', lastActiveAt: i,
          firstAppearAt: edgeFirstAppear,
        });
        _topoVersion++;
      }
    }
    // Skip agent_spawn events that only have description (from tool_use block, no raw ID)
    return;
  }

  // Update agent/subagent lastActiveAt + tokens on every event from this agent
  const aNode = _nodeMap.get(agentNodeId(ev.agent));
  if (aNode) {
    aNode.lastActiveAt = i;
    if (ev.metadata?.tokenUsage) {
      aNode.tokens += ev.metadata.tokenUsage.input + ev.metadata.tokenUsage.output;
    }
  }

  // agent_complete: also update the completed subagent's lastActiveAt (ev.agent is the parent)
  if (ev.type === 'agent_complete' && ev.metadata?.agentId) {
    const subNode = _nodeMap.get(agentNodeId(ev.metadata.agentId));
    if (subNode) subNode.lastActiveAt = i;
  }

  if (!ev.target) return;
  const sourceId = agentNodeId(ev.agent);
  ensureAgent(ev.agent, i);

  // FILE events — only Read/Write/Edit create file nodes (Glob/Grep targets are patterns, not paths)
  if (['file_read', 'file_write', 'file_edit'].includes(ev.type)) {
    const fId = `file:${ev.target}`;
    const existing = _filePaths.get(ev.target);
    if (existing) {
      existing.events++; existing.lastAt = i;
      const prev = existing.agentEdges.get(sourceId);
      if (prev) { prev.direction = edgeDir(ev); prev.lastAt = i; }
      else existing.agentEdges.set(sourceId, { direction: edgeDir(ev), firstAt: i, lastAt: i, rawAgent: ev.agent });
    } else {
      _filePaths.set(ev.target, {
        nodeId: fId, events: 1, firstAt: i, lastAt: i,
        agentEdges: new Map([[sourceId, { direction: edgeDir(ev), firstAt: i, lastAt: i, rawAgent: ev.agent }]]),
      });
      _commonPrefixDirty = true;
    }
    // Agent→topDir edges are deferred to rebuildDerivedNodes (needs correct common prefix)
    _derivedDirty = true;
  }

  // BASH events — ephemeral node per command, fades fast
  if (ev.type === 'bash' && ev.target) {
    const shortCmd = ev.target.split(/\s+/).slice(0, 3).join(' ');
    const bashId = `bash:${i}`;  // unique per event — ephemeral
    if (!_nodeMap.has(bashId)) {
      _nodeMap.set(bashId, {
        id: bashId, kind: 'bash', label: shortCmd, color: BASH_COLOR,
        tokens: 0, accessCount: 1, lastActiveAt: i, spawnedAt: i,
        firstAppearAt: i,
      });
      _topoVersion++;
    }
    const eId = `${sourceId}->${bashId}`;
    if (!_edgeMap.has(eId)) {
      _edgeMap.set(eId, { source: sourceId, target: bashId, agent: ev.agent, direction: 'write', lastActiveAt: i, firstAppearAt: i });
      _topoVersion++;
    }
  }

  // URL events → group by domain
  if (ev.type === 'web_fetch' || ev.type === 'web_search') {
    const domain = urlDomain(ev.target);
    const domId = `url:${domain}`;
    const existing = _urlDomains.get(domain);
    if (existing) { existing.count++; existing.lastAt = i; }
    else { _urlDomains.set(domain, { count: 1, firstAt: i, lastAt: i }); _derivedDirty = true; }

    const eId = `${sourceId}->${domId}`;
    if (!_edgeMap.has(eId)) { _edgeMap.set(eId, { source: sourceId, target: domId, agent: ev.agent, direction: 'read', lastActiveAt: i, firstAppearAt: i }); _topoVersion++; }
    else _edgeMap.get(eId)!.lastActiveAt = i;
  }
}

/** Rebuild directory + file + URL nodes from accumulated state */
function rebuildDerivedNodes() {
  // Recompute common prefix when new files appeared
  if (_commonPrefixDirty) {
    recomputeCommonPrefix();
    _commonPrefixDirty = false;
    _dirSet = new Set();
    // Clean up stale dir nodes + dir-related edges (prefix may have changed)
    for (const key of [..._nodeMap.keys()]) {
      if (key.startsWith('dir:')) { _nodeMap.delete(key); _topoVersion++; }
    }
    for (const key of [..._edgeMap.keys()]) {
      const e = _edgeMap.get(key)!;
      if (e.target.startsWith('dir:') || e.source.startsWith('dir:')) {
        _edgeMap.delete(key); _topoVersion++;
      }
    }
  }
  // Compute earliest firstAt per directory from files
  const dirFirstAt = new Map<string, number>();
  for (const [fp, info] of _filePaths) {
    const rel = relativePath(fp);
    const parts = rel.split('/');
    for (let d = 1; d < parts.length; d++) {
      const dir = parts.slice(0, d).join('/');
      const prev = dirFirstAt.get(dir);
      if (prev === undefined || info.firstAt < prev) dirFirstAt.set(dir, info.firstAt);
    }
  }

  const newDirs = new Set<string>();
  for (const fp of _filePaths.keys()) {
    const rel = relativePath(fp);
    const parts = rel.split('/');
    for (let d = 1; d < parts.length; d++) {
      const dir = parts.slice(0, d).join('/');
      if (!_dirSet.has(dir)) { _dirSet.add(dir); newDirs.add(dir); }
    }
  }

  for (const dir of newDirs) {
    const dirId = `dir:${dir}`;
    const segs = dir.split('/');
    const firstAt = dirFirstAt.get(dir) ?? 0;
    _nodeMap.set(dirId, {
      id: dirId, kind: 'directory', label: segs[segs.length - 1]!,
      color: DIR_COLOR, tokens: 0, accessCount: 0, lastActiveAt: -1, spawnedAt: firstAt,
      firstAppearAt: firstAt,
      directory: segs.length > 1 ? segs.slice(0, -1).join('/') : undefined,
      depth: segs.length,
    });
    _topoVersion++;
    if (segs.length > 1) {
      const parentId = `dir:${segs.slice(0, -1).join('/')}`;
      const eId = `${parentId}->${dirId}`;
      if (!_edgeMap.has(eId)) { _edgeMap.set(eId, { source: parentId, target: dirId, agent: 'main', direction: 'read', lastActiveAt: -1, firstAppearAt: firstAt }); _topoVersion++; }
    }
  }

  // File nodes
  for (const [fp, info] of _filePaths) {
    const rel = relativePath(fp);
    const parts = rel.split('/');
    const fileName = parts[parts.length - 1]!;
    const parentDir = parts.length > 1 ? parts.slice(0, -1).join('/') : null;
    const fId = info.nodeId;

    let fNode = _nodeMap.get(fId);
    if (!fNode) {
      fNode = {
        id: fId, kind: 'file', label: fileName, color: fileColor(fp),
        tokens: 0, accessCount: info.events, lastActiveAt: info.lastAt,
        spawnedAt: info.firstAt, firstAppearAt: info.firstAt,
        directory: parentDir ?? undefined,
        depth: parts.length,
      };
      _nodeMap.set(fId, fNode);
      _topoVersion++;
    } else {
      fNode.accessCount = info.events;
      fNode.lastActiveAt = info.lastAt;
      fNode.depth = parts.length;
      fNode.directory = parentDir ?? undefined;
      fNode.label = fileName;
    }

    // Determine latest access direction for this file (read or write)
    let latestDir: 'read' | 'write' = 'read';
    let latestAt = -1;
    for (const [, access] of info.agentEdges) {
      if (access.lastAt > latestAt) { latestAt = access.lastAt; latestDir = access.direction; }
    }

    if (parentDir) {
      const dirId = `dir:${parentDir}`;
      const eId = `${dirId}->${fId}`;
      const existingDirFile = _edgeMap.get(eId);
      if (existingDirFile) {
        if (info.lastAt > existingDirFile.lastActiveAt) { existingDirFile.lastActiveAt = info.lastAt; existingDirFile.direction = latestDir; }
      } else {
        _edgeMap.set(eId, { source: dirId, target: fId, agent: 'main', direction: latestDir, lastActiveAt: info.lastAt, firstAppearAt: info.firstAt });
        _topoVersion++;
      }
      // Propagate lastActiveAt + direction up the entire ancestor chain (nodes AND edges)
      const dirParts = parentDir.split('/');
      for (let d = dirParts.length; d >= 1; d--) {
        const ancestorId = `dir:${dirParts.slice(0, d).join('/')}`;
        const ancestorNode = _nodeMap.get(ancestorId);
        if (ancestorNode && info.lastAt > ancestorNode.lastActiveAt) ancestorNode.lastActiveAt = info.lastAt;
        const childId = d === dirParts.length ? fId : `dir:${dirParts.slice(0, d + 1).join('/')}`;
        const chainEdgeId = `${ancestorId}->${childId}`;
        const chainEdge = _edgeMap.get(chainEdgeId);
        if (chainEdge && info.lastAt > chainEdge.lastActiveAt) { chainEdge.lastActiveAt = info.lastAt; chainEdge.direction = latestDir; }
      }
    }
  }

  // Agent→topDir edges (deferred from processEvent to ensure correct common prefix)
  for (const [fp, info] of _filePaths) {
    const rel = relativePath(fp);
    const relParts = rel.split('/');
    for (const [agentSrc, access] of info.agentEdges) {
      if (relParts.length > 1) {
        const topDirId = `dir:${relParts[0]}`;
        const eId = `${agentSrc}->${topDirId}`;
        const ex = _edgeMap.get(eId);
        if (ex) { if (access.lastAt > ex.lastActiveAt) { ex.lastActiveAt = access.lastAt; ex.direction = access.direction; } }
        else { _edgeMap.set(eId, { source: agentSrc, target: topDirId, agent: access.rawAgent, direction: access.direction, lastActiveAt: access.lastAt, firstAppearAt: access.firstAt }); _topoVersion++; }
      } else {
        // Root-level file — agent connects directly
        const eId = `${agentSrc}->${info.nodeId}`;
        const ex = _edgeMap.get(eId);
        if (ex) { if (access.lastAt > ex.lastActiveAt) { ex.lastActiveAt = access.lastAt; ex.direction = access.direction; } }
        else { _edgeMap.set(eId, { source: agentSrc, target: info.nodeId, agent: access.rawAgent, direction: access.direction, lastActiveAt: access.lastAt, firstAppearAt: access.firstAt }); _topoVersion++; }
      }
    }
  }

  // URL domain nodes
  for (const [domain, info] of _urlDomains) {
    const uId = `url:${domain}`;
    let uNode = _nodeMap.get(uId);
    if (!uNode) {
      uNode = {
        id: uId, kind: 'url', label: domain, color: URL_COLOR,
        tokens: 0, accessCount: info.count, lastActiveAt: info.lastAt, spawnedAt: info.firstAt,
        firstAppearAt: info.firstAt,
      };
      _nodeMap.set(uId, uNode);
    } else {
      uNode.accessCount = info.count;
      uNode.lastActiveAt = info.lastAt;
    }
  }
}

export function buildGraphState(
  events: SessionEvent[],
  upToIndex: number,
  _agents: string[],
): { nodes: GraphNode[]; edges: GraphEdge[]; topoVersion: number } {
  const clamped = Math.min(upToIndex, events.length - 1);

  // Pre-populate agent slug map once from ALL events (handles race condition
  // where subagent file events may timestamp before agent_spawn)
  if (!_slugMapReady) {
    for (const ev of events) {
      if (ev.type === 'agent_spawn' && ev.metadata?.agentId && ev.metadata?.agentDescription) {
        _agentSlugMap.set(ev.metadata.agentId, ev.metadata.agentDescription);
      }
    }
    _slugMapReady = true;
  }

  // If rewinding or first call, full rebuild
  if (clamped < _lastBuiltIndex || _lastBuiltIndex === -2) {
    _nodeMap = new Map();
    _edgeMap = new Map();
    _filePaths = new Map();
    _urlDomains = new Map();
    _dirSet = new Set();
    _derivedDirty = true;
    _commonPrefixDirty = true;
    _lastBuiltIndex = -1;
    _topoVersion++;
    _cachedNodes = null;
    _cachedEdges = null;
    _cachedNodeCount = 0;
    _cachedEdgeCount = 0;

    // Always create main agent
    _nodeMap.set('agent:main', {
      id: 'agent:main', kind: 'agent', label: 'main', color: MAIN_AGENT_COLOR,
      tokens: 0, accessCount: 0, lastActiveAt: -1, spawnedAt: 0,
      firstAppearAt: 0,
    });
  }

  // Incremental: only process events from _lastBuiltIndex+1 to clamped
  for (let i = _lastBuiltIndex + 1; i <= clamped; i++) {
    processEvent(events[i]!, i);
  }
  _lastBuiltIndex = clamped;

  // Only rebuild derived nodes when new files/urls/agents appeared
  if (_derivedDirty) {
    rebuildDerivedNodes();
    _derivedDirty = false;
  }

  // Structural sharing: only create new arrays when topology changed
  const nodeCount = _nodeMap.size;
  const edgeCount = _edgeMap.size;
  if (_cachedNodes && nodeCount === _cachedNodeCount && edgeCount === _cachedEdgeCount) {
    // Topology stable — update mutable properties in-place on existing objects
    // (objects in _nodeMap ARE the same objects in _cachedNodes)
    for (const n of _cachedNodes) {
      const cached = positionCache.get(n.id);
      if (cached) {
        (n as Record<string, unknown>).x = cached.x;
        (n as Record<string, unknown>).y = cached.y;
        (n as Record<string, unknown>).z = cached.z;
      }
    }
    return { nodes: _cachedNodes, edges: _cachedEdges!, topoVersion: _topoVersion };
  }

  // Topology changed — build fresh arrays
  const nodes = Array.from(_nodeMap.values());
  for (const n of nodes) {
    const cached = positionCache.get(n.id);
    if (cached) {
      (n as Record<string, unknown>).x = cached.x;
      (n as Record<string, unknown>).y = cached.y;
      (n as Record<string, unknown>).z = cached.z;
    }
  }
  const edges = Array.from(_edgeMap.values());

  _cachedNodes = nodes;
  _cachedEdges = edges;
  _cachedNodeCount = nodeCount;
  _cachedEdgeCount = edgeCount;

  return { nodes, edges, topoVersion: _topoVersion };
}

/**
 * Build the complete graph from ALL events at once.
 * Every node/edge gets firstAppearAt. Positions are NOT set — let the
 * force simulation settle them, then freeze.
 */
export function buildFullGraph(
  events: SessionEvent[],
  agents: string[],
): { nodes: GraphNode[]; edges: GraphEdge[]; topoVersion: number } {
  // Full rebuild from scratch
  resetBuilder();
  const lastIndex = events.length - 1;
  if (lastIndex < 0) {
    // Empty session — just main agent
    _nodeMap.set('agent:main', {
      id: 'agent:main', kind: 'agent', label: 'main', color: MAIN_AGENT_COLOR,
      tokens: 0, accessCount: 0, lastActiveAt: -1, spawnedAt: 0, firstAppearAt: 0,
    });
    return { nodes: [_nodeMap.get('agent:main')!], edges: [], topoVersion: _topoVersion };
  }

  return buildGraphState(events, lastIndex, agents);
}

/** Registry for cleanup callbacks (e.g. label texture cache) */
const _cleanupCallbacks: (() => void)[] = [];
export function registerCleanup(fn: () => void) { _cleanupCallbacks.push(fn); }
export function runCleanups() { for (const fn of _cleanupCallbacks) fn(); }
