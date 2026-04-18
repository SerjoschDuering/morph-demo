import React from 'react';

const EVENTS = [
  { date: '2026-04-08', title: 'Team standup', time: '09:00' },
  { date: '2026-04-10', title: 'Tokyo flight', time: '14:30' },
  { date: '2026-04-12', title: 'Tax deadline', time: 'All day' },
  { date: '2026-04-15', title: 'Design review', time: '15:00' },
  { date: '2026-04-18', title: 'Morph demo', time: '11:00' },
  { date: '2026-04-22', title: 'Sprint planning', time: '10:00' },
  { date: '2026-04-28', title: 'Investor call', time: '16:00' },
];

type CalEvent = (typeof EVENTS)[0];

export default function App() {
  const [year, setYear] = React.useState(2026);
  const [month, setMonth] = React.useState(3);
  const [selectedEvent, setSelectedEvent] = React.useState<CalEvent | null>(null);

  React.useEffect(() => {
    window.Morph?.register({
      description: 'Monthly calendar grid. Shows events as coloured pills. User can click events to select them.',
      contextHint: 'selectedEvent (title, date, time)',
      inputFile: '~/morph-output/calendar.json',
      commands: ['reload'],
    });
  }, []);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = new Date(year, month, 1).toLocaleString('default', { month: 'long' });
  const eventsByDate = EVENTS.reduce<Record<string, CalEvent[]>>((acc, e) => {
    (acc[e.date] ??= []).push(e);
    return acc;
  }, {});
  const today = new Date();
  const isToday = (d: number) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;

  const leadingBlanks = firstDay === 0 ? 6 : firstDay - 1;
  const cells: (number | null)[] = [...Array(leadingBlanks).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const nav = (dir: number) => {
    const d = new Date(year, month + dir, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  return (
    <div style={{ height: '100%', background: 'var(--bg-panel)', color: 'var(--text-1)', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{monthName} {year}</span>
        {['‹', '›'].map((ch, i) => (
          <button key={ch} onClick={() => nav(i === 0 ? -1 : 1)} style={{ background: 'var(--bg-active)', border: '1px solid var(--border)', color: 'var(--text-1)', padding: '3px 10px', cursor: 'pointer', borderRadius: 6, fontSize: 14 }}>{ch}</button>
        ))}
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '6px 8px 0', flexShrink: 0 }}>
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-3)', padding: '3px 0', fontWeight: 600 }}>{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, padding: '4px 8px', flex: 1, overflow: 'hidden' }}>
        {cells.map((day, i) => {
          const fullDate = day ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
          const dayEvents = day ? (eventsByDate[fullDate] ?? []) : [];
          const today_ = day && isToday(day);
          return (
            <div key={i} style={{
              minHeight: 52, background: day ? (today_ ? 'var(--bg-active)' : 'var(--bg-hover)') : 'transparent',
              borderRadius: 6, padding: 4, overflow: 'hidden',
              border: today_ ? '1px solid var(--accent)' : '1px solid var(--border-subtle, var(--border))',
            }}>
              {day && (
                <>
                  <div style={{ fontSize: 11, color: today_ ? 'var(--accent)' : 'var(--text-2)', marginBottom: 2, fontWeight: today_ ? 700 : 400 }}>{day}</div>
                  {dayEvents.map((e, j) => (
                    <div key={j} onClick={() => { setSelectedEvent(e); window.Morph?.updateContext({ selectedEvent: e }); }}
                      style={{ fontSize: 9, background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent-border)', borderRadius: 3, padding: '1px 4px', marginBottom: 1, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {e.title}
                    </div>
                  ))}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected event */}
      {selectedEvent && (
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{selectedEvent.title}</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{selectedEvent.date} · {selectedEvent.time}</div>
          </div>
          <button onClick={() => setSelectedEvent(null)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 16, cursor: 'pointer' }}>✕</button>
        </div>
      )}
    </div>
  );
}
