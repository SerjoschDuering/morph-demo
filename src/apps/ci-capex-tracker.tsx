import React from 'react';
const { useState, useEffect, useRef, useCallback } = React;
const { ENTITIES } = (window as any).CIData;

const QUARTERS = ['Q1 24','Q2 24','Q3 24','Q4 24','Q1 25','Q2 25','Q3 25','Q4 25','Q1 26','Q2 26'];
const CAPEX_DATA: Record<string, number[]> = {
  'Microsoft': [12, 14, 16, 18, 18, 20, 20, 22, 22, 24],
  'Google':    [8,  9,  10, 12, 14, 16, 17, 18, 19, 20],
  'Meta':      [7,  8,  9,  10, 12, 14, 15, 16, 17, 18],
  'Nvidia':    [2,  2,  3,  3,  4,  4,  5,  5,  6,  6],
  'OpenAI':    [1,  1,  2,  2,  3,  3,  4,  5,  5,  6],
  'xAI':       [0,  1,  1,  2,  3,  3,  4,  4,  5,  5],
  'Others':    [3,  4,  4,  5,  6,  7,  8,  8,  9,  10],
};

const SERIES_COLORS: Record<string, string> = {
  'Microsoft': '#00a4ef', 'Google': '#4285f4', 'Meta': '#0668e1',
  'Nvidia': '#76b900', 'OpenAI': '#10a37f', 'xAI': '#1da1f2', 'Others': '#9ca3af',
};

const ANNOUNCEMENTS = [
  { date: '2026-04-08', entity: 'Microsoft', desc: 'Azure AI expansion — 3 new mega-DCs announced', amount: '$12B' },
  { date: '2026-03-28', entity: 'Meta', desc: 'Llama 5 training cluster procurement', amount: '$8B' },
  { date: '2026-03-15', entity: 'Google', desc: 'TPU v6 fabrication order with TSMC', amount: '$6B' },
  { date: '2026-03-01', entity: 'xAI', desc: 'Colossus Phase 3 — Memphis expansion', amount: '$5B' },
  { date: '2026-02-20', entity: 'OpenAI', desc: 'Stargate data center groundbreaking', amount: '$4B' },
];

function loadECharts(cb: () => void) {
  if ((window as any).echarts) { cb(); return; }
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js';
  script.onload = cb;
  document.head.appendChild(script);
}

const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';

const S = {
  root: { height: '100%', background: 'var(--bg-panel)', color: 'var(--text-1)', padding: 16, overflowY: 'auto' as const, fontFamily: 'system-ui', boxSizing: 'border-box' as const },
  title: { fontSize: 13, fontWeight: 700, letterSpacing: '0.02em', marginBottom: 14 },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 },
  card: { background: 'var(--bg-card)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)' },
  cardLabel: { fontSize: 10, color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
  cardVal: (c: string) => ({ fontSize: 14, fontWeight: 700, color: c }),
  table: { background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden', marginTop: 16 },
  th: (cols: string) => ({ display: 'grid', gridTemplateColumns: cols, padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', fontWeight: 600 }),
  tr: (cols: string) => ({ display: 'grid', gridTemplateColumns: cols, padding: '8px 14px', borderBottom: '1px solid var(--border)', fontSize: 12, alignItems: 'center' as const }),
};

const tableCols = '80px 1fr 70px';

export default function App() {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<any>(null);
  const [ready, setReady] = useState(!!(window as any).echarts);
  const [highlighted, setHighlighted] = useState<string | null>(null);

  // Total capex = sum of last quarter across all entities
  const totalCapex = Object.values(CAPEX_DATA).reduce((s, arr) => s + arr.reduce((a, b) => a + b, 0), 0);
  // YoY: sum of Q1-Q4 2025 vs Q1-Q4 2024
  const y2024 = Object.values(CAPEX_DATA).reduce((s, arr) => s + arr.slice(0, 4).reduce((a, b) => a + b, 0), 0);
  const y2025 = Object.values(CAPEX_DATA).reduce((s, arr) => s + arr.slice(4, 8).reduce((a, b) => a + b, 0), 0);
  const yoy = y2024 > 0 ? Math.round(((y2025 - y2024) / y2024) * 100) : 0;

  const buildOption = useCallback(() => {
    const dark = isDark();
    const textColor = dark ? '#ccc' : '#444';
    const gridColor = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { top: 4, textStyle: { color: textColor, fontSize: 11 }, itemWidth: 14, itemHeight: 10 },
      grid: { left: 46, right: 16, top: 40, bottom: 28 },
      xAxis: { type: 'category', data: QUARTERS, axisLabel: { color: textColor, fontSize: 10 }, axisLine: { lineStyle: { color: gridColor } } },
      yAxis: { type: 'value', name: '$B', nameTextStyle: { color: textColor, fontSize: 10 }, axisLabel: { color: textColor, fontSize: 10 }, splitLine: { lineStyle: { color: gridColor } } },
      series: Object.entries(CAPEX_DATA).map(([name, data]) => ({
        name, type: 'bar', stack: 'capex', data,
        itemStyle: { color: SERIES_COLORS[name] },
        emphasis: { focus: highlighted === name ? 'self' : 'none' },
      })),
    };
  }, [highlighted]);

  // Load ECharts
  useEffect(() => { loadECharts(() => setReady(true)); }, []);

  // Init + update chart
  useEffect(() => {
    if (!ready || !chartRef.current) return;
    const ec = (window as any).echarts;
    if (!instanceRef.current) {
      instanceRef.current = ec.init(chartRef.current, null, { renderer: 'canvas' });
    }
    instanceRef.current.setOption(buildOption(), true);
  }, [ready, buildOption]);

  // Resize handler
  useEffect(() => {
    const onResize = () => instanceRef.current?.resize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Theme change observer
  useEffect(() => {
    const obs = new MutationObserver(() => {
      if (instanceRef.current) instanceRef.current.setOption(buildOption(), true);
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, [buildOption]);

  // Highlight a series
  const applyHighlight = useCallback((name: string | null) => {
    setHighlighted(name);
    if (!instanceRef.current) return;
    if (name) {
      instanceRef.current.dispatchAction({ type: 'highlight', seriesName: name });
      instanceRef.current.dispatchAction({ type: 'downplay', seriesName: Object.keys(CAPEX_DATA).filter(n => n !== name) });
    } else {
      instanceRef.current.dispatchAction({ type: 'downplay' });
    }
  }, []);

  // Register + commands
  useEffect(() => {
    (window as any).Morph?.register({
      description: 'AI infrastructure capex tracker. Stacked bar chart of quarterly spending 2024-2026.',
      contextHint: '_summary, totalCapex, largestSpender',
      commands: ['highlightEntity', 'timeRange'],
      icon: '\uD83E\uDDFE',
    });
    const unsub = (window as any).Morph?.onCommand((cmd: any) => {
      const c = typeof cmd === 'string' ? cmd : cmd.command;
      const d = cmd.data || {};
      if (c === 'highlightEntity') applyHighlight(d.name || d);
      if (c === 'timeRange') {
        if (!instanceRef.current) return;
        const start = QUARTERS.indexOf(d.start);
        const end = QUARTERS.indexOf(d.end);
        if (start >= 0 && end >= 0) {
          instanceRef.current.dispatchAction({ type: 'dataZoom', startValue: start, endValue: end });
        }
      }
    });
    return () => unsub?.();
  }, [applyHighlight]);

  // Context sync
  useEffect(() => {
    (window as any).Morph?.updateContext({
      _summary: `$${totalCapex}B total capex, ${highlighted || 'all entities'}`,
      totalCapex: `$${totalCapex}B`,
      largestSpender: 'Microsoft ($80B)',
      highlightedEntity: highlighted,
    });
  }, [totalCapex, highlighted]);

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div style={S.root}>
      <div style={S.title}>Capex Tracker</div>

      {/* KPI cards */}
      <div style={S.grid4}>
        <div style={S.card}>
          <div style={S.cardLabel}>Total Industry Capex</div>
          <div style={S.cardVal('var(--text-1)')}>${totalCapex}B</div>
        </div>
        <div style={S.card}>
          <div style={S.cardLabel}>YoY Growth</div>
          <div style={S.cardVal('#34c759')}>+{yoy}%</div>
        </div>
        <div style={S.card}>
          <div style={S.cardLabel}>Largest Spender</div>
          <div style={S.cardVal('var(--accent)')}>Microsoft</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>$80B (2026 plan)</div>
        </div>
        <div style={S.card}>
          <div style={S.cardLabel}>GPU Shortage Index</div>
          <div style={S.cardVal('#f59e0b')}>8.2/10</div>
        </div>
      </div>

      {/* Chart */}
      <div ref={chartRef} style={{ width: '100%', height: 220, background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border)' }} />

      {/* Recent announcements */}
      <div style={S.table}>
        <div style={S.th(tableCols)}><span>Date</span><span>Announcement</span><span>Amount</span></div>
        {ANNOUNCEMENTS.map((a, i) => (
          <div key={i} style={S.tr(tableCols)}>
            <span style={{ color: 'var(--text-3)', fontSize: 12 }}>{fmtDate(a.date)}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
              <span style={{ fontWeight: 600, color: SERIES_COLORS[a.entity] || 'var(--text-1)' }}>{a.entity}</span>
              <span style={{ color: 'var(--text-2)' }}> — {a.desc}</span>
            </span>
            <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{a.amount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
