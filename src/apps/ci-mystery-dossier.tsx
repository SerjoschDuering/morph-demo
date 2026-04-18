import React from 'react';
const { useState, useEffect, useCallback } = React;
const { ENTITIES, SIGNALS, RELATIONSHIPS } = (window as any).CIData;

const AMB = '#f59e0b';
const AMB1 = 'rgba(245, 158, 11, 0.1)';
const AMB2 = 'rgba(245, 158, 11, 0.2)';
const AMB06 = 'rgba(245, 158, 11, 0.06)';

const entity = ENTITIES.find(e => e.id === 'inference-systems')!;
const entitySignals = SIGNALS.filter(s => s.entity === 'inference-systems')
  .sort((a, b) => b.date.localeCompare(a.date));
const entityRels = RELATIONSHIPS.filter(
  r => r.source === 'inference-systems' || r.target === 'inference-systems'
);

const KNOWN_FACTS = [
  { label: 'Incorporation', value: 'Delaware, 2024', known: true },
  { label: 'Headcount', value: '~120 (est.)', known: true },
  { label: 'Funding', value: '? (rumored $500M)', known: false },
  { label: 'HQ', value: '? (Nevada facility detected)', known: false },
  { label: 'Leadership', value: '? (ex-DeepMind PhDs linked)', known: false },
];

const PATTERNS = [
  { icon: '🧠', title: '12 PhD hires from DeepMind in 6 months', desc: 'Coordinated talent acquisition from a single top lab suggests a focused research agenda and deep pockets for compensation.', tag: 'Talent Acquisition', confidence: 72 },
  { icon: '📜', title: '3 MoE inference patents filed simultaneously', desc: 'Filing three related patents at once indicates a mature R&D pipeline — these weren\'t exploratory. IP strategy is deliberate.', tag: 'IP Strategy', confidence: 85 },
  { icon: '🏗️', title: '$180M Supermicro order to unmarked Nevada facility', desc: 'Confirmed hardware order to a facility with no public tenant. Scale implies 10K+ GPU cluster buildout.', tag: 'Infrastructure', confidence: 68 },
];

const CONF_DOTS: Record<string, string> = { high: '#34c759', medium: '#fbbf24', low: '#ef4444' };

const S = {
  root: { height: '100%', background: 'var(--bg-panel)', color: 'var(--text-1)', padding: 20, overflowY: 'auto' as const, fontFamily: 'system-ui', boxSizing: 'border-box' as const },
  label: { fontSize: 10, fontWeight: 700, color: AMB, textTransform: 'uppercase' as const, letterSpacing: '0.12em', marginBottom: 4 },
  name: { fontSize: 14, fontWeight: 800, color: 'var(--text-1)', margin: 0 },
  badge: { display: 'inline-block', padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: AMB1, color: AMB, marginLeft: 10, verticalAlign: 'middle' },
  statusBar: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, marginBottom: 20 },
  statusText: { fontSize: 12, color: 'var(--text-2)' },
  barOuter: { flex: 1, height: 6, borderRadius: 3, background: AMB06 },
  barInner: (pct: number) => ({ width: `${pct}%`, height: '100%', borderRadius: 3, background: AMB, transition: 'width 0.4s ease' }),
  section: { fontSize: 13, fontWeight: 700, color: 'var(--text-2)', marginBottom: 10, marginTop: 22 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  factCard: { background: AMB06, border: `1px solid ${AMB2}`, borderRadius: 10, padding: '12px 14px' },
  factLabel: { fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 6 },
  factVal: (known: boolean) => ({ fontSize: 13, fontWeight: 700, color: known ? 'var(--text-1)' : AMB, ...(known ? {} : { animation: 'amber-pulse 2s ease-in-out infinite' }) }),
  sigCard: { background: AMB06, border: `1px solid ${AMB2}`, borderRadius: 10, padding: '12px 14px', marginBottom: 8 },
  sigTop: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' as const },
  sigBadge: (bg: string) => ({ padding: '1px 7px', borderRadius: 8, fontSize: 10, fontWeight: 600, background: `${bg}22`, color: bg, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }),
  sigDate: { fontSize: 10, color: 'var(--text-3)', marginLeft: 'auto' },
  sigTitle: { fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4, overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const },
  sigExcerpt: { fontSize: 12, color: 'var(--text-2)', lineHeight: 1.45 },
  patCard: { background: AMB06, border: `1px solid ${AMB2}`, borderRadius: 10, padding: '14px 16px', marginBottom: 8, display: 'flex', gap: 12, alignItems: 'flex-start' },
  patIcon: { fontSize: 22, flexShrink: 0, marginTop: 2 },
  patTitle: { fontSize: 13, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 },
  patDesc: { fontSize: 12, color: 'var(--text-2)', lineHeight: 1.45 },
  patTag: { display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, background: AMB1, color: AMB, marginTop: 6, marginRight: 6 },
  confBadge: (pct: number) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, background: 'var(--bg-active)', color: 'var(--text-2)', marginTop: 6 }),
  meterWrap: { marginTop: 22, background: AMB06, border: `1px solid ${AMB2}`, borderRadius: 10, padding: '16px 18px' },
  meterLabels: { display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-3)', marginTop: 6 },
  meterBar: { height: 8, borderRadius: 4, background: 'var(--bg-card)', marginTop: 10, position: 'relative' as const },
  meterFill: (pct: number) => ({ width: `${pct}%`, height: '100%', borderRadius: 4, background: `linear-gradient(90deg, ${AMB2}, ${AMB})`, transition: 'width 0.5s ease' }),
  meterText: { fontSize: 12, color: 'var(--text-2)', marginTop: 10, lineHeight: 1.5 },
};

const SOURCE_COLORS: Record<string, string> = {
  sec: '#60a5fa', patent: '#a78bfa', job: '#34c759',
  news: 'var(--text-3)', satellite: '#fbbf24', insider: '#ef4444',
};

export default function App() {
  const [confidence, setConfidence] = useState(60);
  const [signals, setSignals] = useState<Signal[]>(entitySignals);

  const addSignal = useCallback((d: any) => {
    const sig: Signal = { id: `s-custom-${Date.now()}`, source: d.source || 'news', entity: 'inference-systems', date: d.date || new Date().toISOString().slice(0, 10), title: d.title || 'New signal', excerpt: d.excerpt || '', confidence: d.confidence || 'medium' };
    setSignals(prev => [sig, ...prev]);
  }, []);

  // Inject pulse keyframes
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `@keyframes amber-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  // Register + commands
  useEffect(() => {
    (window as any).Morph?.register({
      description: 'Investigation dossier for Inference Systems LLC. Mystery entity analysis with sparse intel.',
      contextHint: '_summary, confidence, signalCount',
      commands: ['addSignal', 'updateConfidence'],
      icon: '🔍',
    });
    (window as any).Morph?.onCommand((cmd: any) => {
      const c = typeof cmd === 'string' ? cmd : cmd.command;
      const d = cmd.data || {};
      if (c === 'addSignal') addSignal(d);
      if (c === 'updateConfidence') setConfidence(d.value ?? d);
    });
  }, []);

  useEffect(() => {
    (window as any).Morph?.updateContext({
      _summary: `Inference Systems dossier · ${confidence}% confidence · ${signals.length} signals`,
      confidence,
      signalCount: signals.length,
      relCount: entityRels.length,
    });
  }, [confidence, signals]);

  return (
    <div style={S.root}>
      {/* Header */}
      <div style={S.label}>Entity Under Investigation</div>
      <h1 style={S.name}>{entity.name}<span style={S.badge}>Mystery</span></h1>
      <div style={S.statusBar}>
        <span style={S.statusText}>Investigation Active — Confidence: {confidence}%</span>
        <div style={S.barOuter}><div style={S.barInner(confidence)} /></div>
      </div>

      {/* Known Facts */}
      <div style={S.section}>Known Facts</div>
      <div style={S.grid2}>
        {KNOWN_FACTS.map(f => (
          <div key={f.label} style={S.factCard}>
            <div style={S.factLabel}>{f.label}</div>
            <div style={S.factVal(f.known)}>{f.value}</div>
          </div>
        ))}
      </div>

      {/* Connected Signals */}
      <div style={S.section}>Connected Signals ({signals.length})</div>
      {signals.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic', padding: '8px 0' }}>No signals collected yet.</div>
      )}
      {signals.map(sig => (
        <div key={sig.id} style={S.sigCard}>
          <div style={S.sigTop}>
            <span style={S.sigBadge(SOURCE_COLORS[sig.source] || 'var(--text-3)')}>{sig.source}</span>
            <span style={{ ...S.sigBadge(CONF_DOTS[sig.confidence] || '#999'), textTransform: 'capitalize' as const }}>{sig.confidence}</span>
            <span style={S.sigDate}>{sig.date}</span>
          </div>
          <div style={S.sigTitle}>{sig.title}</div>
          <div style={S.sigExcerpt}>{sig.excerpt}</div>
        </div>
      ))}

      {/* Pattern Analysis */}
      <div style={S.section}>Pattern Analysis</div>
      {PATTERNS.map((p, i) => (
        <div key={i} style={S.patCard}>
          <div style={S.patIcon}>{p.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.patTitle}>{p.title}</div>
            <div style={S.patDesc}>{p.desc}</div>
            <span style={S.patTag}>{p.tag}</span>
            <span style={S.confBadge(p.confidence)}>{p.confidence}%</span>
          </div>
        </div>
      ))}

      {/* Confidence Assessment */}
      <div style={S.meterWrap}>
        <div style={S.section as any}>Confidence Assessment</div>
        <div style={S.meterBar}><div style={S.meterFill(confidence)} /></div>
        <div style={S.meterLabels}>
          <span>Low</span><span>Medium</span><span>High</span>
        </div>
        <div style={S.meterText}>
          Likely a well-funded stealth AI inference startup with sovereign backing.
        </div>
      </div>
    </div>
  );
}
