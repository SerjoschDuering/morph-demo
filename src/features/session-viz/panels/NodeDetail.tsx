import { useMemo } from 'react';
import {
  X, FileText, FolderOpen, Globe, Terminal, Cpu,
} from 'lucide-react';
import { useSelectionStore } from '../playback/selection-store.ts';
import { usePlaybackStore } from '../playback/store.ts';
import { getPanelContainer, getPanelHeader, panelBody, getPanel } from './panel-styles.ts';
import type { EventType, NodeKind } from '../parser/types.ts';
import {
  KIND_COLORS, EVENT_COLORS, eventPreview,
  detailRowStyle, FileSection, BashSection, UrlSection,
  SubagentSection, AgentSection, DirectorySection,
} from './node-detail-sections.tsx';

/* -- header icon per kind ---------------------------------------- */

const KIND_ICONS: Record<NodeKind, React.ComponentType<{ size?: number }>> = {
  agent: Cpu, subagent: Cpu, file: FileText,
  directory: FolderOpen, url: Globe, bash: Terminal,
};

const EVENT_ICONS: Partial<
  Record<EventType, React.ComponentType<{ size?: number; color?: string }>>
> = {
  file_read: FileText, file_write: FileText, file_edit: FileText,
  bash: Terminal, web_fetch: Globe, web_search: Globe,
  agent_spawn: Cpu, agent_complete: Cpu,
};

/* -- component --------------------------------------------------- */

export function NodeDetail() {
  const selectedNode = useSelectionStore((s) => s.selectedNode);
  const deselect = useSelectionStore((s) => s.deselect);
  const session = usePlaybackStore((s) => s.session);
  const currentEventIndex = usePlaybackStore((s) => s.currentEventIndex);
  const nodes = usePlaybackStore((s) => s.nodes);
  const P = getPanel();

  const displayId = useMemo(() => {
    if (!selectedNode) return '';
    const idx = selectedNode.id.indexOf(':');
    return idx >= 0 ? selectedNode.id.slice(idx + 1) : selectedNode.id;
  }, [selectedNode]);

  const relatedEvents = useMemo(() => {
    if (!selectedNode || !session) return [];
    const target = displayId;
    return session.events
      .slice(0, currentEventIndex + 1)
      .map((ev, i) => ({ ev, i }))
      .filter(({ ev }) => {
        if (selectedNode.kind === 'agent') return ev.agent === selectedNode.label;
        if (selectedNode.kind === 'subagent')
          return ev.agent === (selectedNode.rawAgentId ?? selectedNode.label);
        return ev.target === target;
      });
  }, [selectedNode, session, currentEventIndex, displayId]);

  if (!selectedNode || !session) return null;

  const kindColor = KIND_COLORS[selectedNode.kind] ?? '#94a3b8';
  const HeaderIcon = KIND_ICONS[selectedNode.kind] ?? FileText;

  /* kind-specific body */
  const kindSection = (() => {
    switch (selectedNode.kind) {
      case 'file':
        return <FileSection events={relatedEvents} displayId={displayId} />;
      case 'bash':
        return <BashSection events={relatedEvents} displayId={displayId} />;
      case 'url':
        return <UrlSection events={relatedEvents} displayId={displayId} />;
      case 'subagent':
        return (
          <SubagentSection
            events={relatedEvents}
            node={selectedNode}
            allEvents={session.events.slice(0, currentEventIndex + 1)}
            color={kindColor}
          />
        );
      case 'agent':
        return <AgentSection events={relatedEvents} />;
      case 'directory':
        return (
          <DirectorySection
            node={selectedNode}
            displayId={displayId}
            allNodes={nodes}
          />
        );
      default:
        return null;
    }
  })();

  /* history list */
  const MAX_HISTORY = 15;
  const historySlice = relatedEvents.slice(-MAX_HISTORY);
  const historyTruncated = relatedEvents.length - historySlice.length;

  return (
    <div style={{
      ...getPanelContainer(),
      bottom: 12, right: 12, width: 300, maxHeight: 360,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ ...getPanelHeader(), justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <HeaderIcon size={13} />
          <span style={{ color: kindColor }}>{selectedNode.kind}</span>
        </div>
        <button
          onClick={deselect}
          style={{
            background: 'none', border: 'none', color: P.textDim,
            cursor: 'pointer', padding: '2px 4px', borderRadius: 4,
            lineHeight: 1, display: 'flex', alignItems: 'center',
          }}
          aria-label="Close"
        >
          <X size={13} />
        </button>
      </div>

      {/* Body */}
      <div style={panelBody}>
        {/* Common fields */}
        <div style={{ color: P.text, fontSize: 12, wordBreak: 'break-all', marginBottom: 10 }}>
          {displayId}
        </div>

        <div style={detailRowStyle}>
          <span style={{ color: P.textDim }}>Accesses</span>
          <span>{selectedNode.accessCount}</span>
        </div>
        <div style={detailRowStyle}>
          <span style={{ color: P.textDim }}>First seen</span>
          <span>event #{selectedNode.spawnedAt}</span>
        </div>
        <div style={detailRowStyle}>
          <span style={{ color: P.textDim }}>Last active</span>
          <span>event #{selectedNode.lastActiveAt}</span>
        </div>

        {selectedNode.tokens > 0 && (
          <div style={detailRowStyle}>
            <span style={{ color: P.textDim }}>Tokens</span>
            <span>{selectedNode.tokens.toLocaleString()}</span>
          </div>
        )}

        {/* Kind-specific */}
        {kindSection}

        {/* History */}
        {relatedEvents.length > 0 && (
          <>
            <div style={{ color: P.text, fontSize: 11, fontWeight: 600, marginTop: 12, marginBottom: 6 }}>
              History ({relatedEvents.length})
            </div>
            {historyTruncated > 0 && (
              <div style={{ fontSize: 10, color: P.textDim, marginBottom: 4 }}>
                {historyTruncated} earlier events not shown
              </div>
            )}
            <div style={{ maxHeight: 160, overflowY: 'auto' }}>
              {historySlice.map(({ ev, i }) => {
                const EvIcon = EVENT_ICONS[ev.type];
                return (
                  <div key={i} style={{
                    padding: '2px 0', fontSize: 11, display: 'flex',
                    alignItems: 'center', overflow: 'hidden', whiteSpace: 'nowrap',
                  }}>
                    <span style={{
                      color: P.textDimmer, marginRight: 4,
                      minWidth: 28, display: 'inline-block',
                    }}>
                      #{i}
                    </span>
                    {EvIcon && <EvIcon size={10} color={EVENT_COLORS[ev.type]} />}
                    <span style={{
                      color: EVENT_COLORS[ev.type] ?? '#64748b',
                      marginLeft: 4, marginRight: 6,
                    }}>
                      {ev.type}
                    </span>
                    <span style={{
                      color: P.textDim, fontSize: 10,
                      overflow: 'hidden', textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {eventPreview(ev)}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
