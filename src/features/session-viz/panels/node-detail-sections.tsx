import { ExternalLink } from 'lucide-react';
import { getPanel } from './panel-styles.ts';
import type { EventType, SessionEvent } from '../parser/types.ts';

/* ── colour maps (re-exported for NodeDetail) ────────────────── */

export const KIND_COLORS: Record<string, string> = {
  agent: '#3b82f6', subagent: '#60a5fa', file: '#94a3b8',
  url: '#a78bfa', bash: '#fb923c', directory: '#64748b',
};

export const EVENT_COLORS: Record<EventType, string> = {
  file_read: '#94a3b8', file_write: '#34d399', file_edit: '#fbbf24',
  file_glob: '#94a3b8', file_grep: '#94a3b8', web_fetch: '#a78bfa',
  web_search: '#c084fc', bash: '#fb923c', tool_other: '#64748b',
  agent_spawn: '#3b82f6', agent_complete: '#60a5fa',
  thinking: '#475569', text_output: '#475569',
};

/* ── helpers ─────────────────────────────────────────────────── */

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m ${rem}s`;
}

export function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '...' : text;
}

export function eventPreview(ev: SessionEvent): string {
  switch (ev.type) {
    case 'file_read':
      return 'Read' + (ev.metadata?.content ? ` (${truncate(ev.metadata.content, 40)})` : '');
    case 'file_write':
      return 'Write (created)';
    case 'file_edit':
      return 'Edit' + (ev.metadata?.content ? ` — ${truncate(ev.metadata.content, 80)}` : '');
    case 'bash':
      return truncate(ev.metadata?.command ?? ev.target ?? 'bash', 60);
    case 'web_fetch':
      return ev.target ?? 'fetch';
    case 'web_search':
      return ev.metadata?.searchQuery ?? 'search';
    case 'file_glob':
      return ev.metadata?.globPattern ?? 'glob';
    case 'file_grep':
      return ev.metadata?.grepPattern ?? 'grep';
    case 'agent_spawn':
      return ev.metadata?.agentDescription
        ? truncate(ev.metadata.agentDescription, 60)
        : 'spawn';
    case 'agent_complete':
      return ev.metadata?.durationMs
        ? `done (${formatDuration(ev.metadata.durationMs)})`
        : 'done';
    default:
      return ev.type;
  }
}

/* ── shared inline styles ────────────────────────────────────── */

export const detailRowStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', marginBottom: 4,
};
export function labelStyle(): React.CSSProperties { return { color: getPanel().textDim }; }
export function sectionTitle(): React.CSSProperties {
  return { color: getPanel().text, fontSize: 11, fontWeight: 600, marginTop: 12, marginBottom: 6 };
}
export function getCodeBox(): React.CSSProperties {
  const P = getPanel();
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";
  return {
    background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)', padding: 8, borderRadius: 6,
    fontSize: 11, wordBreak: 'break-all', fontFamily: P.font,
    color: P.textMuted,
  };
}
function quoteBox(): React.CSSProperties {
  return {
    borderLeft: '3px solid #60a5fa', paddingLeft: 10,
    color: getPanel().textMuted, fontSize: 11, lineHeight: 1.5, marginBottom: 8,
  };
}
export function getBadge(): React.CSSProperties {
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";
  return {
    display: 'inline-block', padding: '1px 7px', borderRadius: 8,
    fontSize: 10, fontWeight: 500, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
  };
}
// badge is a function — call getBadge() at render time
const badgeRow: React.CSSProperties = {
  display: 'flex', flexWrap: 'wrap', gap: 4,
};
const linkBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  color: '#a78bfa', fontSize: 11, textDecoration: 'none',
  background: 'rgba(167,139,250,0.1)', padding: '3px 10px',
  borderRadius: 6, marginTop: 6, cursor: 'pointer',
};

/* ── File section ────────────────────────────────────────────── */

export function FileSection({ events, displayId }: {
  events: { ev: SessionEvent; i: number }[];
  displayId: string;
}) {
  const MAX_FILE_EVENTS = 10;
  const recent = events.slice(-MAX_FILE_EVENTS);
  const truncatedCount = events.length - recent.length;

  return (
    <>
      <div style={sectionTitle()}>File path</div>
      <div style={{ ...getCodeBox(), marginBottom: 8 }}>{displayId}</div>
      {recent.length > 0 && (
        <>
          <div style={sectionTitle()}>Operations ({events.length})</div>
          {truncatedCount > 0 && (
            <div style={{ fontSize: 10, color: getPanel().textDim, marginBottom: 4 }}>
              {truncatedCount} more...
            </div>
          )}
          {recent.map(({ ev, i }) => (
            <div key={i} style={{ fontSize: 11, marginBottom: 3 }}>
              <span style={{ color: EVENT_COLORS[ev.type], marginRight: 6 }}>
                {ev.type === 'file_read' ? 'Read' : ev.type === 'file_write' ? 'Write' : 'Edit'}
              </span>
              {ev.type === 'file_edit' && ev.metadata?.content && (
                <span style={{ color: getPanel().textDim, fontSize: 10 }}>
                  {truncate(ev.metadata.content, 80)}
                </span>
              )}
            </div>
          ))}
        </>
      )}
    </>
  );
}

/* ── Bash section ────────────────────────────────────────────── */

export function BashSection({ events, displayId }: {
  events: { ev: SessionEvent; i: number }[];
  displayId: string;
}) {
  const fullCommand = events.length > 0
    ? (events[0]!.ev.metadata?.command ?? events[0]!.ev.target ?? displayId)
    : displayId;

  return (
    <>
      <div style={sectionTitle()}>Command</div>
      <div style={getCodeBox()}>{fullCommand}</div>
    </>
  );
}

/* ── URL section ─────────────────────────────────────────────── */

export function UrlSection({ events, displayId }: {
  events: { ev: SessionEvent; i: number }[];
  displayId: string;
}) {
  const fullUrl = events.find((e) => e.ev.target)?.ev.target ?? displayId;
  let domain: string;
  try {
    domain = new URL(fullUrl.startsWith('http') ? fullUrl : `https://${fullUrl}`).hostname;
  } catch {
    domain = displayId;
  }

  return (
    <>
      <div style={detailRowStyle}>
        <span style={labelStyle()}>Domain</span>
        <span style={{ color: '#a78bfa' }}>{domain}</span>
      </div>
      <div style={detailRowStyle}>
        <span style={labelStyle()}>Fetches</span>
        <span style={getBadge()}>{events.length}</span>
      </div>
      <a
        href={fullUrl.startsWith('http') ? fullUrl : `https://${fullUrl}`}
        rel="noopener noreferrer"
        style={linkBtn}
        onClick={(e) => {
          e.preventDefault();
          const url = fullUrl.startsWith('http') ? fullUrl : `https://${fullUrl}`;
          import("@tauri-apps/plugin-shell")
            .then(({ open }) => open(url))
            .catch((err) => console.error("[openExternal] failed:", err));
        }}
      >
        <ExternalLink size={11} /> Open
      </a>
    </>
  );
}

/* ── Subagent section ────────────────────────────────────────── */

export function SubagentSection({ events, node, allEvents, color }: {
  events: { ev: SessionEvent; i: number }[];
  node: { rawAgentId?: string; label: string };
  allEvents: SessionEvent[];
  color: string;
}) {
  const agentKey = node.rawAgentId ?? node.label;
  const spawnEvent = allEvents.find(
    (ev) => ev.type === 'agent_spawn' && ev.metadata?.agentId === agentKey,
  );
  const completeEvent = allEvents.find(
    (ev) => ev.type === 'agent_complete' && ev.metadata?.agentId === agentKey,
  );

  const description = spawnEvent?.metadata?.agentDescription;
  const duration = completeEvent?.metadata?.durationMs;
  const tokenUsage = completeEvent?.metadata?.tokenUsage ?? spawnEvent?.metadata?.tokenUsage;

  const toolCounts: Partial<Record<EventType, number>> = {};
  for (const { ev } of events) {
    if (ev.type !== 'thinking' && ev.type !== 'text_output') {
      toolCounts[ev.type] = (toolCounts[ev.type] ?? 0) + 1;
    }
  }

  return (
    <>
      {description && (
        <>
          <div style={sectionTitle()}>Prompt</div>
          <div style={{ ...quoteBox(), borderLeftColor: color }}>
            {truncate(description, 300)}
          </div>
        </>
      )}
      {duration != null && (
        <div style={detailRowStyle}>
          <span style={labelStyle()}>Duration</span>
          <span>{formatDuration(duration)}</span>
        </div>
      )}
      {tokenUsage && (
        <div style={detailRowStyle}>
          <span style={labelStyle()}>Tokens</span>
          <span>{tokenUsage.input.toLocaleString()} in / {tokenUsage.output.toLocaleString()} out</span>
        </div>
      )}
      {Object.keys(toolCounts).length > 0 && (
        <>
          <div style={sectionTitle()}>Tools called</div>
          <div style={badgeRow}>
            {Object.entries(toolCounts).map(([type, count]) => (
              <span key={type} style={{ ...getBadge(), background: EVENT_COLORS[type as EventType] + '22', color: EVENT_COLORS[type as EventType] }}>
                {type} ({count})
              </span>
            ))}
          </div>
        </>
      )}
    </>
  );
}

/* ── Agent (main) section ────────────────────────────────────── */

export function AgentSection({ events }: {
  events: { ev: SessionEvent; i: number }[];
}) {
  let totalIn = 0;
  let totalOut = 0;
  for (const { ev } of events) {
    if (ev.metadata?.tokenUsage) {
      totalIn += ev.metadata.tokenUsage.input;
      totalOut += ev.metadata.tokenUsage.output;
    }
  }

  const toolCounts: Partial<Record<EventType, number>> = {};
  for (const { ev } of events) {
    if (ev.type !== 'thinking' && ev.type !== 'text_output') {
      toolCounts[ev.type] = (toolCounts[ev.type] ?? 0) + 1;
    }
  }

  return (
    <>
      {(totalIn > 0 || totalOut > 0) && (
        <div style={detailRowStyle}>
          <span style={labelStyle()}>Tokens (total)</span>
          <span>{totalIn.toLocaleString()} in / {totalOut.toLocaleString()} out</span>
        </div>
      )}
      {Object.keys(toolCounts).length > 0 && (
        <>
          <div style={sectionTitle()}>Tool breakdown</div>
          <div style={badgeRow}>
            {Object.entries(toolCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([type, count]) => (
                <span key={type} style={{ ...getBadge(), background: EVENT_COLORS[type as EventType] + '22', color: EVENT_COLORS[type as EventType] }}>
                  {type} ({count})
                </span>
              ))}
          </div>
        </>
      )}
    </>
  );
}

/* ── Directory section ───────────────────────────────────────── */

export function DirectorySection({ node, displayId, allNodes }: {
  node: { id: string };
  displayId: string;
  allNodes: { id: string; kind: string; directory?: string; accessCount: number; label: string }[];
}) {
  const dirPath = displayId.endsWith('/') ? displayId : displayId + '/';
  const childFiles = allNodes.filter(
    (n) => n.kind === 'file' && n.id !== node.id
      && (n.directory === displayId || n.directory === dirPath),
  );
  const top3 = [...childFiles]
    .sort((a, b) => b.accessCount - a.accessCount)
    .slice(0, 3);

  return (
    <>
      <div style={detailRowStyle}>
        <span style={labelStyle()}>Child files</span>
        <span>{childFiles.length}</span>
      </div>
      {top3.length > 0 && (
        <>
          <div style={sectionTitle()}>Most accessed</div>
          {top3.map((f) => (
            <div key={f.id} style={{ fontSize: 11, marginBottom: 3, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: getPanel().text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>
                {f.label}
              </span>
              <span style={{ color: getPanel().textDim, flexShrink: 0 }}>{f.accessCount}x</span>
            </div>
          ))}
        </>
      )}
    </>
  );
}
