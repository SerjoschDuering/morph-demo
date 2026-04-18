import React from 'react';
const { useState, useEffect, useCallback, useMemo } = React;
const { THREAT_SCORES, ENTITIES, CATEGORIES } = (window as any).CIData;

type Dimension = 'compute' | 'talent' | 'product' | 'capital' | 'ecosystem' | 'regulatory';
type Trend = 'up' | 'down' | 'flat';
interface CellRef { entity: string; dimension: Dimension }

const DIMS: { key: Dimension; label: string }[] = [
  { key: 'compute', label: 'Compute' }, { key: 'talent', label: 'Talent' },
  { key: 'product', label: 'Product' }, { key: 'capital', label: 'Capital' },
  { key: 'ecosystem', label: 'Ecosystem' }, { key: 'regulatory', label: 'Regulatory' },
];

const trendArrow = (t: Trend) => t === 'up' ? '\u2191' : t === 'down' ? '\u2193' : '\u2192';
const trendColor = (t: Trend) => t === 'up' ? '#34c759' : t === 'down' ? '#ef4444' : 'var(--text-3)';

const cellBg = (score: number): string => {
  if (score <= 3) return 'rgba(52, 199, 89, 0.2)';
  if (score <= 6) return 'rgba(255, 159, 10, 0.2)';
  if (score <= 8) return 'rgba(255, 100, 50, 0.25)';
  return 'rgba(239, 68, 68, 0.3)';
};

const explanationText = (entity: string, dim: Dimension, score: number, trend: Trend): string => {
  const label = DIMS.find(d => d.key === dim)!.label;
  const strength = score <= 3 ? 'weak' : score <= 6 ? 'moderate' : score <= 8 ? 'strong' : 'dominant';
  const dir = trend === 'up' ? 'improving' : trend === 'down' ? 'declining' : 'stable';
  return `${entity} has ${strength} ${label.toLowerCase()} capability (${score}/10), currently ${dir}. ` +
    (score >= 9 ? `This is a market-leading position that competitors must contend with.` :
     score <= 3 ? `This represents a significant gap that could be exploited or may improve rapidly.` :
     `This positions them in the competitive middle tier for this dimension.`);
};

const S = {
  root: { height: '100%', background: 'var(--bg-panel)', color: 'var(--text-1)', padding: '16px 20px', overflowY: 'auto' as const, fontFamily: 'system-ui', boxSizing: 'border-box' as const },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontSize: 13, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '0.02em' },
  subtitle: { fontSize: 10, color: 'var(--text-3)', marginTop: 2 },
  gridWrap: { overflowX: 'auto' as const, marginBottom: 16 },
  grid: { display: 'grid', gridTemplateColumns: '120px repeat(6, 1fr)', gap: 2, minWidth: 440 },
  colHeader: (active: boolean) => ({
    padding: '8px 6px', fontSize: 10, fontWeight: 600, textAlign: 'center' as const,
    cursor: 'pointer', borderRadius: 6, letterSpacing: '0.03em', textTransform: 'uppercase' as const,
    background: active ? 'var(--accent)' : 'var(--bg-card)', color: active ? '#fff' : 'var(--text-2)',
    transition: 'all 0.15s', userSelect: 'none' as const,
  }),
  cornerCell: { padding: '8px 6px' },
  entityCell: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6, background: 'var(--bg-card)', minHeight: 40 },
  entityName: { fontSize: 12, fontWeight: 600, color: 'var(--text-1)', whiteSpace: 'nowrap' as const, overflow: 'hidden' as const, textOverflow: 'ellipsis' as const },
  badge: (bg: string) => ({ fontSize: 8, fontWeight: 600, padding: '1px 5px', borderRadius: 10, background: bg + '22', color: bg, letterSpacing: '0.03em', textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const }),
  cell: (bg: string, selected: boolean) => ({
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center',
    padding: '8px 4px', borderRadius: 6, background: bg, cursor: 'pointer',
    border: selected ? '1.5px solid var(--accent)' : '1px solid transparent',
    transition: 'all 0.15s', minHeight: 40, gap: 2,
  }),
  scoreNum: { fontSize: 13, fontWeight: 700, lineHeight: 1 },
  trend: (color: string) => ({ fontSize: 11, fontWeight: 600, color, lineHeight: 1 }),
  panel: { marginTop: 8, padding: '14px 16px', borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border)' },
  panelTitle: { fontSize: 13, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 },
  panelMeta: { display: 'flex', gap: 12, marginBottom: 8 },
  panelTag: (bg: string) => ({ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: bg, fontWeight: 600 }),
  panelText: { fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 },
};

export default function App() {
  const [sortDim, setSortDim] = useState<Dimension | null>(null);
  const [selectedCell, setSelectedCell] = useState<CellRef | null>(null);

  const sorted = useMemo(() => {
    const items = THREAT_SCORES.map(ts => {
      const entity = ENTITIES.find(e => e.id === ts.entity)!;
      return { entity, scores: ts };
    });
    if (sortDim) {
      items.sort((a, b) => b.scores[sortDim] - a.scores[sortDim]);
    }
    return items;
  }, [sortDim]);

  const criticalCount = useMemo(() =>
    THREAT_SCORES.reduce((n, ts) => n + DIMS.filter(d => ts[d.key] >= 9).length, 0), []);

  const handleCellClick = useCallback((entity: string, dimension: Dimension) => {
    setSelectedCell(prev =>
      prev?.entity === entity && prev?.dimension === dimension ? null : { entity, dimension });
  }, []);

  const handleSort = useCallback((dim: Dimension) => {
    setSortDim(prev => prev === dim ? null : dim);
  }, []);

  // Context
  useEffect(() => {
    const sel = selectedCell
      ? (() => {
          const ts = THREAT_SCORES.find(t => t.entity === selectedCell.entity);
          return ts ? { entity: selectedCell.entity, dimension: selectedCell.dimension,
            score: ts[selectedCell.dimension], trend: ts.trends[selectedCell.dimension] } : null;
        })()
      : null;
    (window as any).Morph?.updateContext({
      _summary: `Threat matrix: ${ENTITIES.length} entities x ${DIMS.length} dimensions`,
      selectedCell: sel, criticalCount, sortedBy: sortDim || 'default',
    });
  }, [selectedCell, sortDim, criticalCount]);

  // Commands
  useEffect(() => {
    (window as any).Morph?.onCommand((cmd: any) => {
      const c = typeof cmd === 'string' ? cmd : cmd.command;
      const d = cmd.data || {};
      if (c === 'selectCell') setSelectedCell({ entity: d.entity, dimension: d.dimension });
      if (c === 'sortBy') setSortDim(d.dimension || d);
    });
  }, []);

  // Register
  useEffect(() => {
    (window as any).Morph?.register({
      description: 'Threat assessment matrix. 10 entities x 6 dimensions heatmap with trend indicators.',
      contextHint: '_summary, selectedCell, criticalCount',
      commands: ['selectCell', 'sortBy'],
      icon: '\uD83D\uDDC4\uFE0F',
    });
  }, []);

  // Selected cell details
  const detail = useMemo(() => {
    if (!selectedCell) return null;
    const ts = THREAT_SCORES.find(t => t.entity === selectedCell.entity);
    const ent = ENTITIES.find(e => e.id === selectedCell.entity);
    if (!ts || !ent) return null;
    const score = ts[selectedCell.dimension];
    const trend = ts.trends[selectedCell.dimension];
    return { name: ent.name, category: ent.category, dim: selectedCell.dimension, score, trend,
      text: explanationText(ent.name, selectedCell.dimension, score, trend) };
  }, [selectedCell]);

  return (
    <div style={S.root}>
      <div style={S.header}>
        <div>
          <div style={S.title}>Threat Assessment Matrix</div>
          <div style={S.subtitle}>{ENTITIES.length} entities &middot; {DIMS.length} dimensions &middot; {criticalCount} critical scores</div>
        </div>
      </div>

      <div style={S.gridWrap}>
        <div style={S.grid}>
          {/* Corner */}
          <div style={S.cornerCell} />
          {/* Column headers */}
          {DIMS.map(d => (
            <div key={d.key} style={S.colHeader(sortDim === d.key)} onClick={() => handleSort(d.key)}>
              {d.label} {sortDim === d.key ? '\u25BC' : ''}
            </div>
          ))}

          {/* Rows */}
          {sorted.map(({ entity, scores }) => {
            const cat = CATEGORIES[entity.category];
            return (
              <React.Fragment key={entity.id}>
                <div style={S.entityCell}>
                  <div>
                    <div style={S.entityName}>{entity.name}</div>
                    <span style={S.badge(cat.color)}>{cat.label}</span>
                  </div>
                </div>
                {DIMS.map(d => {
                  const score = scores[d.key];
                  const trend = scores.trends[d.key];
                  const isSel = selectedCell?.entity === entity.id && selectedCell?.dimension === d.key;
                  return (
                    <div key={d.key} style={S.cell(cellBg(score), isSel)}
                      onClick={() => handleCellClick(entity.id, d.key)}>
                      <span style={S.scoreNum}>{score}</span>
                      <span style={S.trend(trendColor(trend))}>{trendArrow(trend)}</span>
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Detail panel */}
      {detail && (
        <div style={S.panel}>
          <div style={S.panelTitle}>{detail.name} &mdash; {DIMS.find(d => d.key === detail.dim)!.label}</div>
          <div style={S.panelMeta}>
            <span style={S.panelTag(cellBg(detail.score))}>Score: {detail.score}/10</span>
            <span style={S.panelTag('var(--bg-input)')}>
              Trend: <span style={{ color: trendColor(detail.trend) }}>{trendArrow(detail.trend)} {detail.trend}</span>
            </span>
            <span style={S.badge(CATEGORIES[detail.category].color)}>{CATEGORIES[detail.category].label}</span>
          </div>
          <div style={S.panelText}>{detail.text}</div>
        </div>
      )}
    </div>
  );
}
