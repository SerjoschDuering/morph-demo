import type { CSSProperties } from 'react';

function isDark(): boolean {
  return document.documentElement.getAttribute("data-theme") !== "light";
}

/** Call at render time — returns theme-appropriate panel tokens. */
export function getPanel() {
  const dark = isDark();
  return dark ? PANEL_DARK : PANEL_LIGHT;
}

const PANEL_DARK = {
  bg: 'rgba(10,10,15,0.8)',
  border: '1px solid rgba(255,255,255,0.06)',
  radius: 12,
  blur: 'blur(12px)',
  padding: '12px 16px',
  font: "'JetBrains Mono','SF Mono',monospace",
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  textDim: '#64748b',
  textDimmer: '#475569',
  accent: '#3b82f6',
} as const;

const PANEL_LIGHT = {
  bg: 'rgba(255,255,255,0.85)',
  border: '1px solid rgba(0,0,0,0.08)',
  radius: 12,
  blur: 'blur(12px)',
  padding: '12px 16px',
  font: "'JetBrains Mono','SF Mono',monospace",
  text: '#1e293b',
  textMuted: '#475569',
  textDim: '#64748b',
  textDimmer: '#94a3b8',
  accent: '#3b82f6',
} as const;

/** Static dark default — kept for module-level style constants that can't call getPanel(). */
export const PANEL = PANEL_DARK;

export type PanelTokens = typeof PANEL_DARK;

export function getPanelContainer(): CSSProperties {
  const p = getPanel();
  return {
    position: 'absolute',
    background: p.bg,
    border: p.border,
    borderRadius: p.radius,
    backdropFilter: p.blur,
    fontFamily: p.font,
    fontSize: 12,
    fontVariantNumeric: 'tabular-nums',
    color: p.textMuted,
    zIndex: 10,
  };
}

export function getPanelHeader(): CSSProperties {
  const p = getPanel();
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 14px',
    color: p.text,
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: p.border,
    flexShrink: 0,
  };
}

// Keep static versions for backward compat (components that don't need light mode yet)
export const panelContainer: CSSProperties = {
  position: 'absolute',
  background: PANEL.bg,
  border: PANEL.border,
  borderRadius: PANEL.radius,
  backdropFilter: PANEL.blur,
  fontFamily: PANEL.font,
  fontSize: 12,
  fontVariantNumeric: 'tabular-nums',
  color: PANEL.textMuted,
  zIndex: 10,
};

export const panelHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '10px 14px',
  color: PANEL.text,
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  borderBottom: PANEL.border,
  flexShrink: 0,
};

export const panelBody: CSSProperties = {
  padding: '10px 14px',
  overflowY: 'auto',
  flex: 1,
};
