import React from 'react';
const { useState, useEffect, useRef, useCallback, useMemo } = React;
const { ENTITIES, SCENARIOS, THREAT_SCORES, CATEGORIES } = (window as any).CIData;

function loadECharts(cb: () => void) {
  if ((window as any).echarts) { cb(); return; }
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js';
  script.onload = cb;
  document.head.appendChild(script);
}

const PARAM_KEYS = ['gpuSupply', 'regulatory', 'talent', 'capital', 'openSource'] as const;
const PARAM_META: Record<string, { label: string; affect: string }> = {
  gpuSupply:   { label: 'GPU Supply Shock',    affect: 'compute' },
  regulatory:  { label: 'Regulatory Pressure',  affect: 'regulatory' },
  talent:      { label: 'Talent Migration',      affect: 'talent' },
  capital:     { label: 'Capital Markets',       affect: 'capital' },
  openSource:  { label: 'Open Source Momentum',  affect: 'ecosystem' },
};

const RADAR_AXES = ['compute', 'talent', 'product', 'capital', 'ecosystem'] as const;
const TOP_N = 5;

// Category-based modifiers: how sensitive each category is to parameter shifts
const CAT_MOD: Record<string, Record<string, number>> = {
  'ai-lab': { compute: 0.8, regulatory: 1.2, talent: 1.0, capital: 0.9, ecosystem: 1.0 },
  cloud:    { compute: 0.6, regulatory: 0.8, talent: 0.7, capital: 1.0, ecosystem: 0.8 },
  chips:    { compute: 1.4, regulatory: 0.6, talent: 0.5, capital: 0.7, ecosystem: 0.5 },
  mystery:  { compute: 1.0, regulatory: 1.5, talent: 1.2, capital: 1.1, ecosystem: 0.3 },
};

function adjustScore(base: number, param: number, modifier: number): number {
  return Math.min(10, Math.max(0, base * (1 + (param - 50) / 100 * modifier)));
}

const S = {
  root: { height: '100%', background: 'var(--bg-panel)', color: 'var(--text-1)', padding: '16px 20px', overflowY: 'auto' as const, fontFamily: 'system-ui', boxSizing: 'border-box' as const, display: 'flex', flexDirection: 'column' as const, gap: 16 },
  topRow: { display: 'flex', flexDirection: 'column' as const, gap: 16, minHeight: 0 },
  leftPanel: { display: 'flex', flexDirection: 'column' as const, gap: 10 },
  rightPanel: { minWidth: 0, minHeight: 260 },
  title: { fontSize: 13, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '0.02em', marginBottom: 4 },
  sliderGroup: { display: 'flex', flexDirection: 'column' as const, gap: 8 },
  sliderWrap: { display: 'flex', flexDirection: 'column' as const, gap: 2 },
  sliderLabel: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  sliderName: { fontSize: 12, color: 'var(--text-1)', fontWeight: 500 },
  sliderVal: { fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'var(--bg-active)', padding: '1px 7px', borderRadius: 8 },
  sliderInput: { width: '100%', accentColor: 'var(--accent)', cursor: 'pointer', margin: 0 },
  sliderMinMax: { display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-3)' },
  presetRow: { display: 'flex', gap: 4, flexWrap: 'wrap' as const, marginTop: 4 },
  presetBtn: (a: boolean) => ({ padding: '5px 10px', borderRadius: 7, fontSize: 10, fontWeight: a ? 600 : 400, cursor: 'pointer', border: 'none', background: a ? 'var(--accent)' : 'var(--bg-card)', color: a ? '#fff' : 'var(--text-3)', transition: 'all 0.15s', whiteSpace: 'nowrap' as const }),
  chartBox: { width: '100%', height: '100%', minHeight: 240 },
  bottomRow: { display: 'flex', gap: 10 },
  outcomeCard: (accent: string) => ({ flex: 1, minWidth: 0, borderRadius: 10, padding: '12px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderTop: `3px solid ${accent}` }),
  outcomeTitle: (accent: string) => ({ fontSize: 11, fontWeight: 700, color: accent, textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginBottom: 6 }),
  outcomeList: { listStyle: 'none' as const, margin: 0, padding: 0, display: 'flex', flexDirection: 'column' as const, gap: 3 },
  outcomeName: { fontSize: 12, color: 'var(--text-1)', fontWeight: 500, overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const },
};

function entityName(id: string) { return ENTITIES.find(e => e.id === id)?.name ?? id; }

export default function App() {
  const [params, setParams] = useState<Record<string, number>>({ gpuSupply: 50, regulatory: 30, talent: 50, capital: 60, openSource: 40 });
  const [activePreset, setActivePreset] = useState<string>('status-quo');
  const [echartsReady, setEchartsReady] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInst = useRef<any>(null);

  useEffect(() => { loadECharts(() => setEchartsReady(true)); }, []);

  const setParam = useCallback((key: string, value: number) => {
    setParams(prev => ({ ...prev, [key]: value }));
    setActivePreset('');
  }, []);

  const loadScenario = useCallback((scenarioId: string) => {
    const s = SCENARIOS.find(sc => sc.id === scenarioId);
    if (!s) return;
    setParams({ ...s.params });
    setActivePreset(s.id);
  }, []);

  // Compute adjusted scores for all entities
  const adjusted = useMemo(() => {
    return THREAT_SCORES.map(ts => {
      const ent = ENTITIES.find(e => e.id === ts.entity)!;
      const mods = CAT_MOD[ent.category] || CAT_MOD['ai-lab'];
      const scores: Record<string, number> = {};
      for (const axis of RADAR_AXES) {
        const paramKey = Object.entries(PARAM_META).find(([, v]) => v.affect === axis)?.[0];
        const paramVal = paramKey ? (params[paramKey] ?? 50) : 50;
        const mod = axis === 'compute' ? mods.compute : axis === 'talent' ? mods.talent : axis === 'capital' ? mods.capital : axis === 'ecosystem' ? mods.ecosystem : 0.5;
        scores[axis] = adjustScore(ts[axis as keyof typeof ts] as number, paramVal, mod);
      }
      const total = RADAR_AXES.reduce((sum, a) => sum + scores[a], 0);
      return { entity: ent, scores, total };
    }).sort((a, b) => b.total - a.total);
  }, [params]);

  const top5 = useMemo(() => adjusted.slice(0, TOP_N), [adjusted]);

  // Determine winners/losers/wildcards
  const scenario = SCENARIOS.find(s => s.id === activePreset);
  const outcomes = useMemo(() => {
    if (scenario) return { winners: scenario.winners, losers: scenario.losers, wildcards: scenario.wildcards };
    const avg = adjusted.reduce((s, a) => s + a.total, 0) / adjusted.length;
    const winners = adjusted.filter(a => a.total > avg + 3).map(a => a.entity.id);
    const losers = adjusted.filter(a => a.total < avg - 3).map(a => a.entity.id);
    const wildcards = adjusted.filter(a => a.entity.category === 'mystery').map(a => a.entity.id);
    return { winners, losers, wildcards };
  }, [adjusted, scenario, activePreset]);

  // ECharts radar
  useEffect(() => {
    if (!echartsReady || !chartRef.current) return;
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (!chartInst.current) {
      chartInst.current = (window as any).echarts.init(chartRef.current, dark ? 'dark' : undefined);
    }
    const opt = {
      backgroundColor: 'transparent',
      legend: { data: top5.map(t => t.entity.name), bottom: 0, textStyle: { fontSize: 10, color: dark ? '#ccc' : '#555' }, itemWidth: 12, itemHeight: 8 },
      radar: {
        indicator: RADAR_AXES.map(a => ({ name: a.charAt(0).toUpperCase() + a.slice(1), max: 10 })),
        shape: 'polygon' as const,
        splitArea: { areaStyle: { color: dark ? ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.04)'] : ['rgba(0,0,0,0.01)', 'rgba(0,0,0,0.03)'] } },
        axisName: { color: dark ? '#aaa' : '#666', fontSize: 11 },
        splitLine: { lineStyle: { color: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' } },
        axisLine: { lineStyle: { color: dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' } },
      },
      series: [{
        type: 'radar',
        data: top5.map(t => ({
          value: RADAR_AXES.map(a => Math.round(t.scores[a] * 10) / 10),
          name: t.entity.name,
          lineStyle: { width: 2 },
          areaStyle: { opacity: 0.08 },
          itemStyle: { color: CATEGORIES[t.entity.category].color },
        })),
      }],
    };
    chartInst.current.setOption(opt, true);
  }, [echartsReady, top5]);

  // Resize observer
  useEffect(() => {
    if (!chartRef.current || !chartInst.current) return;
    const ro = new ResizeObserver(() => chartInst.current?.resize());
    ro.observe(chartRef.current);
    return () => ro.disconnect();
  }, [echartsReady]);

  // Context
  useEffect(() => {
    (window as any).Morph?.updateContext({
      _summary: `Scenario modeler — ${activePreset || 'custom'} params`,
      activeScenario: activePreset || 'custom',
      params,
      winners: outcomes.winners.map(entityName),
      losers: outcomes.losers.map(entityName),
      wildcards: outcomes.wildcards.map(entityName),
    });
  }, [params, activePreset, outcomes]);

  // Commands
  useEffect(() => {
    (window as any).Morph?.onCommand((cmd: any) => {
      const c = typeof cmd === 'string' ? cmd : cmd.command;
      const d = cmd.data || {};
      if (c === 'loadScenario') loadScenario(d.scenarioId || d);
      if (c === 'setParam') setParam(d.key, d.value);
    });
  }, [loadScenario, setParam]);

  // Register
  useEffect(() => {
    (window as any).Morph?.register({
      description: 'Scenario modeler with sliders and radar chart. Explore what-if scenarios for the AI arms race.',
      contextHint: '_summary, activeScenario, winners, losers, wildcards',
      commands: ['loadScenario', 'setParam'],
      icon: '\u2699\uFE0F',
    });
  }, []);

  return (
    <div style={S.root}>
      <div style={S.topRow}>
        {/* Left — sliders */}
        <div style={S.leftPanel}>
          <div style={S.title}>Scenario Parameters</div>
          <div style={S.sliderGroup}>
            {PARAM_KEYS.map(k => (
              <div key={k} style={S.sliderWrap}>
                <div style={S.sliderLabel}>
                  <span style={S.sliderName}>{PARAM_META[k].label}</span>
                  <span style={S.sliderVal}>{params[k]}</span>
                </div>
                <input type="range" min={0} max={100} value={params[k]} onChange={e => setParam(k, +e.target.value)} style={S.sliderInput} />
                <div style={S.sliderMinMax}><span>0</span><span>100</span></div>
              </div>
            ))}
          </div>
          <div style={S.presetRow}>
            {SCENARIOS.map(sc => (
              <button key={sc.id} style={S.presetBtn(activePreset === sc.id)} onClick={() => loadScenario(sc.id)}>
                {sc.name}
              </button>
            ))}
          </div>
        </div>

        {/* Right — radar chart */}
        <div style={S.rightPanel}>
          <div ref={chartRef} style={S.chartBox} />
        </div>
      </div>

      {/* Bottom — outcome cards */}
      <div style={S.bottomRow}>
        {([
          { title: 'Winners', accent: '#34c759', ids: outcomes.winners },
          { title: 'Losers', accent: '#ef4444', ids: outcomes.losers },
          { title: 'Wildcards', accent: '#f59e0b', ids: outcomes.wildcards },
        ] as const).map(card => (
          <div key={card.title} style={S.outcomeCard(card.accent)}>
            <div style={S.outcomeTitle(card.accent)}>{card.title}</div>
            <ul style={S.outcomeList}>
              {card.ids.length === 0
                ? <li style={{ fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic' }}>None</li>
                : card.ids.map(id => <li key={id} style={S.outcomeName}>{entityName(id)}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
