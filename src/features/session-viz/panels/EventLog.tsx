import { useRef, useEffect, useState } from 'react';
import {
  List,
  FileText,
  FilePen,
  FileSearch,
  Globe,
  Search,
  Terminal,
  Cpu,
  CheckCircle,
  Brain,
  MessageSquare,
  Wrench,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { usePlaybackStore } from '../playback/store.ts';
import { getPanelContainer, getPanelHeader, getPanel } from './panel-styles.ts';
import type { EventType } from '../parser/types.ts';

const EVENT_COLORS: Record<EventType, string> = {
  file_read: '#94a3b8',
  file_write: '#34d399',
  file_edit: '#fbbf24',
  file_glob: '#94a3b8',
  file_grep: '#94a3b8',
  web_fetch: '#a78bfa',
  web_search: '#c084fc',
  bash: '#fb923c',
  tool_other: '#64748b',
  agent_spawn: '#3b82f6',
  agent_complete: '#60a5fa',
  thinking: '#475569',
  text_output: '#475569',
};

const EVENT_ICONS: Record<EventType, React.ComponentType<{ size?: number; color?: string }>> = {
  file_read: FileText,
  file_write: FilePen,
  file_edit: FilePen,
  file_glob: FileSearch,
  file_grep: FileSearch,
  web_fetch: Globe,
  web_search: Search,
  bash: Terminal,
  tool_other: Wrench,
  agent_spawn: Cpu,
  agent_complete: CheckCircle,
  thinking: Brain,
  text_output: MessageSquare,
};

function truncateTarget(target: string | undefined, max: number): string {
  if (!target) return '';
  if (target.length <= max) return target;
  return '...' + target.slice(target.length - max + 3);
}

export function EventLog() {
  const session = usePlaybackStore((s) => s.session);
  const currentEventIndex = usePlaybackStore((s) => s.currentEventIndex);
  const seekToEvent = usePlaybackStore((s) => s.seekToEvent);
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(true);
  const P = getPanel();

  // Auto-scroll to active event
  useEffect(() => {
    if (activeRef.current && listRef.current) {
      activeRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [currentEventIndex]);

  if (!session || currentEventIndex < 0) return null;

  const visibleEvents = session.events.slice(0, currentEventIndex + 1);
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";

  return (
    <div
      style={{
        ...getPanelContainer(),
        bottom: 12,
        left: 12,
        width: collapsed ? 'auto' : 260,
        maxHeight: collapsed ? 'auto' : 240,
        display: 'flex',
        flexDirection: 'column',
        background: isDark ? 'rgba(10,10,15,0.45)' : 'rgba(255,255,255,0.65)',
      }}
    >
      <div
        style={{ ...getPanelHeader(), cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setCollapsed((c) => !c)}
      >
        {collapsed ? (
          <ChevronRight size={12} style={{ flexShrink: 0 }} />
        ) : (
          <ChevronDown size={12} style={{ flexShrink: 0 }} />
        )}
        <List size={12} style={{ flexShrink: 0 }} />
        <span>Activity</span>
        <span style={{ fontSize: 10, color: P.textDim, marginLeft: 'auto' }}>
          {visibleEvents.length}
        </span>
      </div>

      {!collapsed && (
        <div ref={listRef} style={listStyle}>
          {visibleEvents.map((ev, i) => {
            const isActive = i === currentEventIndex;
            const color = EVENT_COLORS[ev.type] ?? '#64748b';
            const Icon = EVENT_ICONS[ev.type] ?? Wrench;

            return (
              <div
                key={i}
                ref={isActive ? activeRef : undefined}
                onClick={() => seekToEvent(i)}
                style={{
                  ...rowStyle,
                  borderLeft: isActive
                    ? `3px solid ${P.accent}`
                    : '3px solid transparent',
                  background: isActive
                    ? (isDark ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.08)')
                    : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                  <Icon size={11} color={color} />
                </span>
                <span style={{ color, fontSize: 10 }}>
                  {ev.type}
                </span>
                <span style={{ color: P.textDim, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 10 }}>
                  {truncateTarget(ev.target, 28)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const listStyle: React.CSSProperties = {
  overflowY: 'auto',
  flex: 1,
};

const rowStyle: React.CSSProperties = {
  padding: '3px 8px',
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  fontSize: 11,
};
