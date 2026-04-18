import React from 'react';
const { useState, useEffect, useCallback, useRef } = React;
const { ENTITIES, CATEGORIES } = (window as any).CIData;

type Tab = 'overview' | 'products' | 'leadership' | 'financials';
const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'products', label: 'Products' },
  { key: 'leadership', label: 'Leadership' },
  { key: 'financials', label: 'Financials' },
];

// --- Shared styles ---
const S = {
  root: { height: '100%', background: 'var(--bg-panel)', color: 'var(--text-1)', padding: 20, overflowY: 'auto' as const, fontFamily: 'system-ui', boxSizing: 'border-box' as const },
  headerRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18 },
  entityName: { fontSize: 14, fontWeight: 700, color: 'var(--text-1)', margin: 0, overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const },
  badge: (bg: string) => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: bg + '22', color: bg, marginLeft: 10, verticalAlign: 'middle' }),
  desc: { fontSize: 12, color: 'var(--text-2)', marginTop: 6, lineHeight: 1.5 },
  select: { padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-1)', fontSize: 11, cursor: 'pointer', outline: 'none', minWidth: 120, maxWidth: 160 },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 18 },
  card: { background: 'var(--bg-card)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)' },
  cardLabel: { fontSize: 10, color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
  cardVal: { fontSize: 14, fontWeight: 700, color: 'var(--accent)' },
  tabBar: { display: 'flex', gap: 4, marginBottom: 18, borderBottom: '1px solid var(--border)', paddingBottom: 0 },
  tab: (a: boolean) => ({ padding: '6px 12px', fontSize: 11, fontWeight: a ? 700 : 500, cursor: 'pointer', border: 'none', background: a ? 'var(--bg-card)' : 'transparent', color: a ? 'var(--text-1)' : 'var(--text-3)', borderBottom: a ? '2px solid var(--accent)' : '2px solid transparent', borderRadius: '6px 6px 0 0' }),
  sectionTitle: { fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 10 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  productCard: { background: 'var(--bg-card)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border)' },
  productName: { fontSize: 13, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4, overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const },
  productDesc: { fontSize: 12, color: 'var(--text-2)', lineHeight: 1.4 },
  profileCard: { display: 'flex', flexDirection: 'column' as const, background: 'var(--bg-card)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border)', gap: 2 },
  profileName: { fontSize: 14, fontWeight: 700, color: 'var(--text-1)' },
  profileRole: { fontSize: 12, color: 'var(--text-2)' },
  profileFrom: { fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic' as const },
  table: { background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' },
  tr: { display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid var(--border)', fontSize: 13 },
  trMetric: { color: 'var(--text-2)', fontWeight: 500 },
  trValue: { color: 'var(--text-1)', fontWeight: 700 },
  infoRow: { display: 'flex', gap: 16, flexWrap: 'wrap' as const, marginBottom: 16, fontSize: 12 },
  infoLabel: { color: 'var(--text-3)', fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
  infoValue: { color: 'var(--text-1)', fontWeight: 500, marginTop: 2 },
};

export default function App() {
  const [entityId, setEntityId] = useState(ENTITIES[0].id);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const entityIdRef = useRef(entityId);
  const activeTabRef = useRef(activeTab);
  entityIdRef.current = entityId;
  activeTabRef.current = activeTab;

  const entity = ENTITIES.find(e => e.id === entityId) || ENTITIES[0];
  const cat = CATEGORIES[entity.category];

  const loadEntity = useCallback((id: string) => {
    const found = ENTITIES.find(e => e.id === id);
    if (found) setEntityId(found.id);
  }, []);

  const syncContext = useCallback(() => {
    const e = ENTITIES.find(x => x.id === entityIdRef.current) || ENTITIES[0];
    (window as any).Morph?.updateContext({
      _summary: `${e.name} profile · ${e.marketCap}`,
      entity: e.id,
      tab: activeTabRef.current,
    });
  }, []);

  useEffect(() => {
    (window as any).Morph?.register({
      description: 'Entity profile dashboard. Shows detailed info, products, leadership, financials for any tracked entity.',
      contextHint: '_summary, entity, tab',
      commands: ['loadEntity', 'tab'],
      icon: '\uD83D\uDCBC',
    });
    (window as any).Morph?.onCommand((cmd: any) => {
      const c = typeof cmd === 'string' ? cmd : cmd.command;
      const d = cmd.data || {};
      if (c === 'loadEntity') loadEntity(d.entityId || d);
      if (c === 'tab') setActiveTab(d.tab || d);
    });
    syncContext();
  }, []);

  useEffect(() => { syncContext(); }, [entityId, activeTab]);

  // --- KPI data ---
  const kpis = [
    { label: 'Market Cap', value: entity.marketCap },
    { label: 'Headcount', value: entity.headcount },
    { label: 'GPU Fleet', value: entity.gpuFleet },
    { label: 'Revenue', value: entity.revenue },
  ];

  return (
    <div style={S.root}>
      {/* Header */}
      <div style={S.headerRow}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={S.entityName}>
            {entity.name}
            <span style={S.badge(cat.color)}>{cat.label}</span>
          </h1>
          <div style={S.desc}>{entity.description}</div>
        </div>
        <select
          style={S.select}
          value={entityId}
          onChange={e => { setEntityId(e.target.value); setActiveTab('overview'); }}
        >
          {ENTITIES.map(e => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      </div>

      {/* KPI row */}
      <div style={S.grid4}>
        {kpis.map(k => (
          <div key={k.label} style={S.card}>
            <div style={S.cardLabel}>{k.label}</div>
            <div style={S.cardVal}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div style={S.tabBar}>
        {TABS.map(t => (
          <button key={t.key} style={S.tab(t.key === activeTab)} onClick={() => setActiveTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content — rendered as inline JSX to avoid remount on every render */}
      {activeTab === 'overview' && (
        <>
          <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 18 }}>
            {entity.description}
          </div>
          <div style={S.infoRow}>
            <div>
              <div style={S.infoLabel}>Founded</div>
              <div style={S.infoValue}>{entity.founded}</div>
            </div>
            <div>
              <div style={S.infoLabel}>Headquarters</div>
              <div style={S.infoValue}>{entity.hq}</div>
            </div>
            <div>
              <div style={S.infoLabel}>Category</div>
              <div style={S.infoValue}>{cat.label}</div>
            </div>
          </div>
        </>
      )}
      {activeTab === 'products' && (
        <div style={S.grid2}>
          {entity.products.map((p, i) => (
            <div key={i} style={S.productCard}>
              <div style={S.productName}>{p.name}</div>
              <div style={S.productDesc}>{p.desc}</div>
            </div>
          ))}
        </div>
      )}
      {activeTab === 'leadership' && (
        <div style={S.grid2}>
          {entity.leadership.map((l, i) => (
            <div key={i} style={S.profileCard}>
              <div style={S.profileName}>{l.name}</div>
              <div style={S.profileRole}>{l.role}</div>
              {l.from && <div style={S.profileFrom}>from {l.from}</div>}
            </div>
          ))}
        </div>
      )}
      {activeTab === 'financials' && (
        entity.financials.length === 0
          ? <div style={{ fontSize: 13, color: 'var(--text-3)' }}>No financial data available.</div>
          : (
            <div style={S.table}>
              {entity.financials.map((f, i) => (
                <div key={i} style={{ ...S.tr, ...(i === entity.financials.length - 1 ? { borderBottom: 'none' } : {}) }}>
                  <span style={S.trMetric}>{f.metric}</span>
                  <span style={S.trValue}>{f.value}</span>
                </div>
              ))}
            </div>
          )
      )}
    </div>
  );
}
