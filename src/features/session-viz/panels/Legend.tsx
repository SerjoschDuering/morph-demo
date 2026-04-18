import { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Circle,
  Diamond,
  FolderOpen,
  Globe,
  Terminal,
  Keyboard,
  Minus,
} from 'lucide-react';
import { getPanelContainer, getPanelHeader, getPanel } from './panel-styles.ts';

interface LegendItem {
  icon: React.ReactNode;
  label: string;
  desc: string;
  color: string;
}

const ITEMS: LegendItem[] = [
  {
    icon: <Circle size={12} fill="#06b6d4" stroke="none" />,
    label: 'Main Agent',
    desc: 'Claude orchestrator',
    color: '#06b6d4',
  },
  {
    icon: <Diamond size={12} fill="#e879f9" stroke="none" />,
    label: 'Subagent',
    desc: 'Spawned specialist',
    color: '#e879f9',
  },
  {
    icon: <Diamond size={12} fill="#4a5568" stroke="none" style={{ opacity: 0.5 }} />,
    label: 'Dead Agent',
    desc: 'Retired, floats above',
    color: '#4a5568',
  },
  {
    icon: <Circle size={12} fill="#38bdf8" stroke="none" />,
    label: 'File',
    desc: 'Color = language',
    color: '#38bdf8',
  },
  {
    icon: <FolderOpen size={12} color="#475569" />,
    label: 'Directory',
    desc: 'Groups child files',
    color: '#475569',
  },
  {
    icon: <Globe size={12} color="#fb923c" />,
    label: 'URL',
    desc: 'Web fetch / search',
    color: '#fb923c',
  },
  {
    icon: <Terminal size={12} color="#a3e635" />,
    label: 'Bash',
    desc: 'Shell command (fades fast)',
    color: '#a3e635',
  },
];

const VISUAL_CUES = [
  {
    icon: <Circle size={10} fill="#e2e8f0" stroke="none" />,
    text: 'Bright = recently active',
  },
  {
    icon: <Circle size={10} fill="#475569" stroke="none" />,
    text: 'Dim = idle for a while',
  },
  {
    icon: <Minus size={12} color="#eab308" />,
    text: 'Gold link = write',
  },
  {
    icon: <Minus size={12} color="#3b82f6" />,
    text: 'Blue link = read',
  },
];

export function Legend() {
  const [collapsed, setCollapsed] = useState(true);
  const P = getPanel();

  return (
    <div
      style={{
        ...getPanelContainer(),
        top: 12,
        right: 12,
        minWidth: 140,
        maxWidth: 200,
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
        <span>Legend</span>
      </div>

      {!collapsed && (
        <div style={{ padding: '10px 14px' }}>
          {ITEMS.map((item) => (
            <div key={item.label} style={rowStyle}>
              <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                {item.icon}
              </span>
              <span style={{ color: item.color }}>{item.label}</span>
              <span style={{ color: P.textDimmer, fontSize: 10, marginLeft: 'auto' }}>{item.desc}</span>
            </div>
          ))}

          <div style={{ borderTop: P.border, margin: '6px 0' }} />

          {VISUAL_CUES.map((cue, i) => (
            <div key={i} style={{ ...cueRowStyle, color: P.textDim }}>
              <span style={cueIconWrap}>{cue.icon}</span>
              <span>{cue.text}</span>
            </div>
          ))}

          <div style={{ borderTop: P.border, margin: '6px 0' }} />

          <div style={{ ...cueRowStyle, color: P.textDim }}>
            <span style={cueIconWrap}>
              <Keyboard size={12} />
            </span>
            <span>Space Play &middot; arrows Step &middot; 1-5 Speed</span>
          </div>
        </div>
      )}
    </div>
  );
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 3,
  lineHeight: 1.3,
};

const cueRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  marginBottom: 2,
  fontSize: 10,
};

const cueIconWrap: React.CSSProperties = {
  width: 14,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};
