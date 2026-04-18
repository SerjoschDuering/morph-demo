import React from 'react';
const { useState, useEffect, useRef, useCallback, useMemo } = React;
const { EVENTS, ENTITIES, CATEGORIES } = (window as any).CIData;
type TimelineEvent = { id: string; date: string; entity: string; title: string; desc: string; type: 'funding' | 'launch' | 'partnership' | 'regulatory' | 'acquisition' | 'talent' | 'hardware' };

const TYPE_EMOJI: Record<TimelineEvent['type'], string> = {
  funding: '\u{1F4B0}', launch: '\u{1F680}', partnership: '\u{1F91D}',
  regulatory: '\u2696\uFE0F', acquisition: '\u{1F3E2}', talent: '\u{1F464}', hardware: '\u{1F527}',
};
const ALL_TYPES = Object.keys(TYPE_EMOJI) as TimelineEvent['type'][];

const entityById = (id: string) => ENTITIES.find(e => e.id === id);
const entityColor = (id: string) => {
  const ent = entityById(id);
  return ent ? CATEGORIES[ent.category].color : 'var(--text-3)';
};

const TIMELINE_START = new Date('2023-01-01');
const TIMELINE_END = new Date('2026-07-01');
const NOW = new Date('2026-04-12');
const MONTH_WIDTH = 100;

function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}
const TOTAL_MONTHS = monthsBetween(TIMELINE_START, TIMELINE_END);
const TIMELINE_WIDTH = TOTAL_MONTHS * MONTH_WIDTH + 120; // padding

function dateToX(iso: string): number {
  const d = new Date(iso);
  const months = monthsBetween(TIMELINE_START, d);
  const dayFrac = d.getDate() / 30;
  return 60 + (months + dayFrac) * MONTH_WIDTH;
}

function generateMonthMarkers(): { x: number; label: string; isYear: boolean }[] {
  const markers: { x: number; label: string; isYear: boolean }[] = [];
  const d = new Date(TIMELINE_START);
  const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  for (let i = 0; i <= TOTAL_MONTHS; i++) {
    const isYear = d.getMonth() === 0;
    markers.push({ x: 60 + i * MONTH_WIDTH, label: isYear ? `${d.getFullYear()}` : SHORT_MONTHS[d.getMonth()], isYear });
    d.setMonth(d.getMonth() + 1);
  }
  return markers;
}

export default function App() {
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const markers = useMemo(generateMonthMarkers, []);
  const nowX = useMemo(() => dateToX(NOW.toISOString()), []);

  const filtered = useMemo(() => {
    let evts = [...EVENTS];
    if (entityFilter !== 'all') evts = evts.filter(e => e.entity === entityFilter);
    if (typeFilter !== 'all') evts = evts.filter(e => e.type === typeFilter);
    return evts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [entityFilter, typeFilter]);

  const scrollToDate = useCallback((date: string) => {
    if (!scrollRef.current) return;
    const x = dateToX(date);
    scrollRef.current.scrollTo({ left: x - scrollRef.current.clientWidth / 2, behavior: 'smooth' });
  }, []);

  // Auto-scroll to NOW on mount
  useEffect(() => {
    const t = setTimeout(() => scrollToDate(NOW.toISOString()), 100);
    return () => clearTimeout(t);
  }, [scrollToDate]);

  // Commands
  useEffect(() => {
    (window as any).Morph?.onCommand?.((cmd: any) => {
      const c = typeof cmd === 'string' ? cmd : cmd.command;
      const d = cmd.data || {};
      if (c === 'scrollTo') scrollToDate(d.date || d);
      if (c === 'filterEntity') setEntityFilter(d.entityId || d);
      if (c === 'filterType') setTypeFilter(d.type || d);
    });
  }, [scrollToDate]);

  // Register + context
  useEffect(() => {
    (window as any).Morph?.register?.({
      description: 'Horizontal timeline of the AI arms race 2023-2026. Key events, launches, funding rounds.',
      contextHint: '_summary, eventCount, selectedEvent',
      commands: ['scrollTo', 'filterEntity', 'filterType'],
      icon: '\u{1F4C5}',
    });
  }, []);

  useEffect(() => {
    const sel = filtered.find(e => e.id === selectedId);
    (window as any).Morph?.updateContext?.({
      _summary: `Timeline: ${filtered.length} events shown`,
      eventCount: filtered.length,
      entityFilter,
      typeFilter,
      selectedEvent: sel ? { id: sel.id, title: sel.title, entity: sel.entity, date: sel.date } : null,
    });
  }, [filtered, entityFilter, typeFilter, selectedId]);

  const AXIS_Y = 200;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-panel)', color: 'var(--text-1)', fontFamily: 'system-ui, sans-serif', fontSize: 12, boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Arms Race Timeline</div>
        {/* Entity filter */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
          <Pill label="All" active={entityFilter === 'all'} onClick={() => setEntityFilter('all')} />
          {ENTITIES.map(e => (
            <Pill key={e.id} label={e.name} active={entityFilter === e.id} color={CATEGORIES[e.category].color} onClick={() => setEntityFilter(e.id)} />
          ))}
        </div>
        {/* Type filter */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <Pill label="All" active={typeFilter === 'all'} onClick={() => setTypeFilter('all')} />
          {ALL_TYPES.map(t => (
            <Pill key={t} label={`${TYPE_EMOJI[t]} ${t}`} active={typeFilter === t} onClick={() => setTypeFilter(t)} />
          ))}
        </div>
      </div>

      {/* Scrollable timeline */}
      <div ref={scrollRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', position: 'relative' }}>
        <div style={{ width: TIMELINE_WIDTH, height: '100%', position: 'relative', minHeight: 400 }}>
          {/* Axis line */}
          <div style={{ position: 'absolute', top: AXIS_Y, left: 40, right: 40, height: 1, background: 'var(--border)' }} />

          {/* Month markers */}
          {markers.map((m, i) => (
            <div key={i} style={{ position: 'absolute', left: m.x, top: AXIS_Y - (m.isYear ? 14 : 8), display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: 1, height: m.isYear ? 14 : 8, background: 'var(--border)' }} />
              <span style={{ fontSize: m.isYear ? 11 : 9, fontWeight: m.isYear ? 700 : 400, color: m.isYear ? 'var(--text-1)' : 'var(--text-3)', marginTop: 4, whiteSpace: 'nowrap' }}>
                {m.label}
              </span>
            </div>
          ))}

          {/* NOW marker */}
          <div style={{ position: 'absolute', left: nowX, top: 20, bottom: 20, width: 0, borderLeft: '2px dashed var(--accent)', opacity: 0.7, zIndex: 5 }} />
          <div style={{ position: 'absolute', left: nowX - 16, top: 8, fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'var(--bg-panel)', padding: '1px 6px', borderRadius: 4, zIndex: 6 }}>NOW</div>

          {/* Event cards */}
          {filtered.map((evt, idx) => {
            const x = dateToX(evt.date);
            const above = idx % 2 === 0;
            const isSelected = selectedId === evt.id;
            const color = entityColor(evt.entity);
            const cardTop = above ? AXIS_Y - 130 : AXIS_Y + 30;
            const lineTop = above ? AXIS_Y - 130 + 100 : AXIS_Y + 4;
            const lineH = above ? 26 : 26;
            return (
              <div key={evt.id}>
                {/* Connecting line */}
                <div style={{ position: 'absolute', left: x, top: lineTop, width: 1, height: lineH, background: color, opacity: 0.4 }} />
                {/* Dot on axis */}
                <div style={{ position: 'absolute', left: x - 3, top: AXIS_Y - 3, width: 7, height: 7, borderRadius: '50%', background: color, zIndex: 3 }} />
                {/* Card */}
                <div
                  onClick={() => setSelectedId(isSelected ? null : evt.id)}
                  style={{
                    position: 'absolute', left: x - 60, top: cardTop, width: 120,
                    background: 'var(--bg-card)', border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 6, padding: '6px 8px', cursor: 'pointer', zIndex: isSelected ? 10 : 2,
                    boxShadow: isSelected ? '0 0 12px color-mix(in srgb, var(--accent) 30%, transparent)' : '0 1px 4px rgba(0,0,0,0.08)',
                    transition: 'box-shadow 0.15s, border-color 0.15s',
                  }}
                >
                  <div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 2 }}>{fmtDate(evt.date)}</div>
                  <span style={{ display: 'inline-block', fontSize: 9, padding: '1px 5px', borderRadius: 8, background: color, color: '#fff', marginBottom: 3, lineHeight: '14px' }}>
                    {entityById(evt.entity)?.name ?? evt.entity}
                  </span>
                  <div style={{ fontWeight: 600, fontSize: 11, lineHeight: '14px', marginBottom: 2 }}>
                    {TYPE_EMOJI[evt.type]} {evt.title}
                  </div>
                  {isSelected ? (
                    <div style={{ fontSize: 10, color: 'var(--text-2)', lineHeight: '13px' }}>{evt.desc}</div>
                  ) : (
                    <div style={{ fontSize: 10, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{evt.desc}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', day: 'numeric' });
}

function Pill({ label, active, color, onClick }: { label: string; active: boolean; color?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '2px 8px', borderRadius: 10, fontSize: 10, cursor: 'pointer',
        border: `1px solid ${active ? (color || 'var(--accent)') : 'var(--border)'}`,
        background: active ? (color || 'var(--accent)') : 'transparent',
        color: active ? '#fff' : 'var(--text-2)',
        fontWeight: active ? 600 : 400, transition: 'all 0.15s', whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}
