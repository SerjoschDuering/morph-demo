import React from 'react';
const { SIGNALS, ENTITIES } = (window as any).CIData;

const { useState, useEffect, useCallback, useMemo } = React;

const SOURCES = [
  { key: 'all', label: 'All', color: 'var(--text-3)' },
  { key: 'sec', label: 'SEC', color: '#60a5fa' },
  { key: 'patent', label: 'Patent', color: '#a78bfa' },
  { key: 'job', label: 'Job', color: '#34c759' },
  { key: 'news', label: 'News', color: 'var(--text-3)' },
  { key: 'satellite', label: 'Satellite', color: '#fbbf24' },
  { key: 'insider', label: 'Insider', color: '#ef4444' },
] as const;

const CONF_LEVELS = ['all', 'high', 'medium', 'low'] as const;
const CONF_DOTS: Record<string, string> = { high: '#34c759', medium: '#fbbf24', low: '#ef4444' };

const sourceColor = (s: Signal['source']): string =>
  SOURCES.find(x => x.key === s)?.color ?? 'var(--text-3)';

const entityName = (id: string): string =>
  ENTITIES.find(e => e.id === id)?.name ?? id;

const fmtDate = (iso: string): string => {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 30) return `${diff}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const S = {
  root: { height: '100%', background: 'var(--bg-panel)', color: 'var(--text-1)', display: 'flex', flexDirection: 'column' as const, fontFamily: 'system-ui', boxSizing: 'border-box' as const },
  header: { padding: '14px 16px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 },
  title: { fontSize: 13, fontWeight: 700, letterSpacing: '0.02em', marginBottom: 10 },
  filterRow: { display: 'flex', gap: 5, flexWrap: 'wrap' as const, marginBottom: 8 },
  pill: (active: boolean, color: string) => ({
    padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: active ? 600 : 400,
    cursor: 'pointer', border: active ? `1.5px solid ${color}` : '1px solid var(--border)',
    background: active ? `${color}18` : 'transparent',
    color: active ? color : 'var(--text-3)', transition: 'all 0.12s', userSelect: 'none' as const,
  }),
  entitySelect: { padding: '3px 8px', borderRadius: 8, fontSize: 11, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-2)', cursor: 'pointer', outline: 'none' },
  feed: { flex: 1, overflowY: 'auto' as const, padding: '10px 16px 16px' },
  card: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 8, cursor: 'pointer', transition: 'border-color 0.12s' },
  cardTop: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' as const },
  badge: (bg: string) => ({
    padding: '1px 7px', borderRadius: 8, fontSize: 10, fontWeight: 600,
    background: `${bg}22`, color: bg, textTransform: 'uppercase' as const, letterSpacing: '0.04em',
  }),
  entityBadge: { padding: '1px 7px', borderRadius: 8, fontSize: 10, fontWeight: 500, background: 'var(--bg-active)', color: 'var(--text-2)' },
  date: { fontSize: 10, color: 'var(--text-3)', marginLeft: 'auto' },
  cardTitle: { fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4, overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const },
  excerpt: (expanded: boolean) => ({
    fontSize: 12, color: 'var(--text-2)', lineHeight: 1.45,
    ...(expanded ? {} : { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }),
  }),
  confRow: { display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 },
  confDot: (color: string) => ({ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }),
  confLabel: { fontSize: 10, color: 'var(--text-3)', textTransform: 'capitalize' as const },
  empty: { textAlign: 'center' as const, color: 'var(--text-3)', fontSize: 12, marginTop: 40 },
};

export default function App() {
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [confFilter, setConfFilter] = useState<string>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = [...SIGNALS].sort((a, b) => b.date.localeCompare(a.date));
    if (sourceFilter !== 'all') list = list.filter(s => s.source === sourceFilter);
    if (entityFilter !== 'all') list = list.filter(s => s.entity === entityFilter);
    if (confFilter !== 'all') list = list.filter(s => s.confidence === confFilter);
    return list;
  }, [sourceFilter, entityFilter, confFilter]);

  const highCount = useMemo(() => SIGNALS.filter(s => s.confidence === 'high').length, []);

  // Command handler
  useEffect(() => {
    const unsub = (window as any).Morph?.onCommand((cmd: any) => {
      const c = typeof cmd === 'string' ? cmd : cmd.command;
      const d = cmd.data || {};
      if (c === 'filterSource') setSourceFilter(d.source || d);
      if (c === 'filterEntity') setEntityFilter(d.entityId || d);
    });
    return () => unsub?.();
  }, []);

  // Register + context
  useEffect(() => {
    (window as any).Morph?.register({
      description: 'Intelligence signal feed. SEC filings, patents, job postings, news, satellite imagery, insider tips.',
      contextHint: '_summary, signalCount, highConfidenceCount',
      commands: ['filterSource', 'filterEntity'],
      icon: '\uD83D\uDCD3',
    });
  }, []);

  useEffect(() => {
    (window as any).Morph?.updateContext({
      _summary: `${filtered.length} signals shown, ${highCount} high-confidence`,
      signalCount: filtered.length,
      highConfidenceCount: highCount,
      sourceFilter,
      entityFilter,
      confFilter,
    });
  }, [filtered, highCount, sourceFilter, entityFilter, confFilter]);

  const toggle = useCallback((id: string) => {
    setExpanded(prev => prev === id ? null : id);
  }, []);

  return (
    <div style={S.root}>
      <div style={S.header}>
        <div style={S.title}>Signal Feed</div>

        {/* Source pills */}
        <div style={S.filterRow}>
          {SOURCES.map(s => (
            <span key={s.key} style={S.pill(sourceFilter === s.key, s.color)}
              onClick={() => setSourceFilter(s.key)}>{s.label}</span>
          ))}
        </div>

        {/* Entity + confidence row */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select style={S.entitySelect} value={entityFilter}
            onChange={e => setEntityFilter(e.target.value)}>
            <option value="all">All entities</option>
            {ENTITIES.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>

          <div style={{ display: 'flex', gap: 4 }}>
            {CONF_LEVELS.map(c => (
              <span key={c} style={S.pill(confFilter === c, c === 'all' ? 'var(--text-3)' : CONF_DOTS[c])}
                onClick={() => setConfFilter(c)}>
                {c === 'all' ? 'All' : c.charAt(0).toUpperCase() + c.slice(1)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Feed */}
      <div style={S.feed}>
        {filtered.length === 0 && <div style={S.empty}>No signals match current filters.</div>}
        {filtered.map(sig => {
          const isOpen = expanded === sig.id;
          const color = sourceColor(sig.source);
          return (
            <div key={sig.id} style={S.card} onClick={() => toggle(sig.id)}>
              <div style={S.cardTop}>
                <span style={S.badge(color)}>{sig.source}</span>
                <span style={S.entityBadge}>{entityName(sig.entity)}</span>
                <span style={S.date}>{fmtDate(sig.date)}</span>
              </div>
              <div style={S.cardTitle}>{sig.title}</div>
              <div style={S.excerpt(isOpen)}>{sig.excerpt}</div>
              <div style={S.confRow}>
                <span style={S.confDot(CONF_DOTS[sig.confidence])} />
                <span style={S.confLabel}>{sig.confidence}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
