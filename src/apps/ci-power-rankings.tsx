import React from 'react';
const { useState, useMemo, useEffect, useCallback } = React;
const { ENTITIES, THREAT_SCORES, CATEGORIES } = (window as any).CIData;

type SortKey = 'power' | 'compute' | 'talent' | 'capital' | 'product';

const powerScore = (s: typeof THREAT_SCORES[0]) =>
  Math.round((s.compute * 2 + s.talent * 1.5 + s.capital * 1.5 + s.product * 2 + s.ecosystem + s.regulatory * 0.5) / 8.5 * 10);

const BARS: { key: string; label: string; color: string }[] = [
  { key: 'compute', label: 'Compute', color: '#a78bfa' },
  { key: 'talent', label: 'Talent', color: '#34c759' },
  { key: 'capital', label: 'Capital', color: '#fbbf24' },
  { key: 'ecosystem', label: 'Momentum', color: '#60a5fa' },
];

const SORT_OPTS: { key: SortKey; label: string }[] = [
  { key: 'power', label: 'Power Score' },
  { key: 'compute', label: 'Compute' },
  { key: 'talent', label: 'Talent' },
  { key: 'capital', label: 'Capital' },
  { key: 'product', label: 'Product' },
];

const S = {
  root: { height: '100%', background: 'var(--bg-panel)', color: 'var(--text-1)', padding: '16px 20px', overflowY: 'auto' as const, fontFamily: 'system-ui', boxSizing: 'border-box' as const },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' as const, marginBottom: 14 },
  title: { fontSize: 13, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '0.02em' },
  sortRow: { display: 'flex', gap: 4, flexWrap: 'wrap' as const },
  sortBtn: (a: boolean) => ({ padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: a ? 600 : 400, cursor: 'pointer', border: 'none', background: a ? 'var(--accent)' : 'var(--bg-card)', color: a ? '#fff' : 'var(--text-3)', transition: 'all 0.15s' }),
  card: (sel: boolean) => ({ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 10, background: sel ? 'var(--bg-active)' : 'var(--bg-card)', border: sel ? '1.5px solid var(--accent)' : '1px solid var(--border)', marginBottom: 8, cursor: 'pointer', transition: 'all 0.15s' }),
  rank: { fontSize: 16, fontWeight: 800, color: 'var(--accent)', minWidth: 32, textAlign: 'center' as const, lineHeight: 1 },
  mid: { flex: 1, minWidth: 0 },
  nameRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  name: { fontSize: 13, fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const },
  badge: (bg: string) => ({ fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: bg + '22', color: bg, letterSpacing: '0.03em', textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const }),
  barGroup: { display: 'flex', flexDirection: 'column' as const, gap: 4 },
  barRow: { display: 'flex', alignItems: 'center', gap: 6 },
  barLabel: { fontSize: 9, color: 'var(--text-3)', width: 58, textAlign: 'right' as const, flexShrink: 0 },
  barTrack: { flex: 1, height: 6, borderRadius: 3, background: 'var(--bg-input)', overflow: 'hidden' },
  barFill: (w: number, c: string) => ({ width: `${w}%`, height: '100%', borderRadius: 3, background: c, transition: 'width 0.3s ease' }),
  scoreWrap: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', minWidth: 52 },
  scoreBadge: (v: number) => ({ width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: 'var(--text-1)', background: `conic-gradient(var(--accent) ${v * 3.6}deg, var(--bg-input) 0deg)`, position: 'relative' as const }),
  scoreInner: { width: 34, height: 34, borderRadius: '50%', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 },
  scoreLabel: { fontSize: 8, color: 'var(--text-3)', marginTop: 3, textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
};

export default function App() {
  const [sortKey, setSortKey] = useState<SortKey>('power');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const ranked = useMemo(() => {
    const items = THREAT_SCORES.map(s => {
      const entity = ENTITIES.find(e => e.id === s.entity)!;
      return { entity, scores: s, power: powerScore(s) };
    });
    items.sort((a, b) => {
      if (sortKey === 'power') return b.power - a.power;
      return (b.scores as any)[sortKey] - (a.scores as any)[sortKey];
    });
    return items;
  }, [sortKey]);

  const selectEntity = useCallback((id: string) => {
    setSelectedId(prev => prev === id ? null : id);
  }, []);

  // Update context when selection or sort changes
  useEffect(() => {
    const top = ranked[0];
    const sel = selectedId ? ENTITIES.find(e => e.id === selectedId) : null;
    (window as any).Morph?.updateContext({
      _summary: `Power rankings sorted by ${sortKey}`,
      topEntity: top.entity.name,
      topScore: top.power,
      sortedBy: sortKey,
      entityCount: ranked.length,
      selectedEntity: sel ? { id: sel.id, name: sel.name, category: sel.category } : null,
    });
  }, [ranked, sortKey, selectedId]);

  // Command handler
  useEffect(() => {
    (window as any).Morph?.onCommand((cmd: any) => {
      const c = typeof cmd === 'string' ? cmd : cmd.command;
      const d = cmd.data || {};
      if (c === 'sortBy') setSortKey(d.key || d);
      if (c === 'select') selectEntity(d.entityId || d);
    });
  }, [selectEntity]);

  // Register
  useEffect(() => {
    (window as any).Morph?.register({
      description: 'Power rankings of AI entities. Sortable by compute, talent, capital, product strength.',
      contextHint: '_summary, topEntity, sortedBy, selectedEntity',
      commands: ['sortBy', 'select'],
      icon: '⭐',
    });
  }, []);

  return (
    <div style={S.root}>
      <div style={S.header}>
        <div style={S.title}>Power Rankings</div>
        <div style={S.sortRow}>
          {SORT_OPTS.map(o => (
            <button key={o.key} style={S.sortBtn(sortKey === o.key)} onClick={() => setSortKey(o.key)}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {ranked.map((item, i) => {
        const cat = CATEGORIES[item.entity.category];
        const sel = selectedId === item.entity.id;
        return (
          <div key={item.entity.id} style={S.card(sel)} onClick={() => selectEntity(item.entity.id)}>
            <div style={S.rank}>#{i + 1}</div>
            <div style={S.mid}>
              <div style={S.nameRow}>
                <span style={S.name}>{item.entity.name}</span>
                <span style={S.badge(cat.color)}>{cat.label}</span>
              </div>
              <div style={S.barGroup}>
                {BARS.map(b => (
                  <div key={b.key} style={S.barRow}>
                    <span style={S.barLabel}>{b.label}</span>
                    <div style={S.barTrack}>
                      <div style={S.barFill((item.scores as any)[b.key] * 10, b.color)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={S.scoreWrap}>
              <div style={S.scoreBadge(item.power)}>
                <div style={S.scoreInner}>{item.power}</div>
              </div>
              <div style={S.scoreLabel}>Power</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
