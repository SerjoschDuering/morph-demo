import React from 'react';
const { LOCATIONS, ENTITIES } = (window as any).CIData;

const { useState, useEffect, useRef, useCallback } = React;

const TILES = {
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
};

const TYPE_COLORS: Record<string, string> = {
  hq: '#ef4444', datacenter: '#60a5fa', fab: '#fbbf24', lab: '#34c759',
};
const TYPE_LABELS: Record<string, string> = {
  hq: 'HQ', datacenter: 'Datacenter', fab: 'Fab', lab: 'Lab',
};
const FILTER_TYPES = ['All', 'hq', 'datacenter', 'fab', 'lab'] as const;

function isDarkTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

function loadLeaflet(cb: () => void) {
  if ((window as any).L) { cb(); return; }
  if (!document.getElementById('leaflet-css')) {
    const link = document.createElement('link');
    link.id = 'leaflet-css';
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }
  const script = document.createElement('script');
  script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  script.onload = cb;
  document.head.appendChild(script);
}

function entityName(id: string) {
  return ENTITIES.find(e => e.id === id)?.name ?? id;
}

export default function App() {
  const [selected, setSelected] = useState<Location | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [entityFilter, setEntityFilter] = useState<string>('All');
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const filtered = LOCATIONS.filter(loc => {
    if (typeFilter !== 'All' && loc.type !== typeFilter) return false;
    if (entityFilter !== 'All' && loc.entity !== entityFilter) return false;
    return true;
  });

  const uniqueEntities = [...new Set(LOCATIONS.map(l => l.entity))];

  const flyToLocation = useCallback((idOrLoc: string | Location) => {
    const loc = typeof idOrLoc === 'string'
      ? LOCATIONS.find(l => l.id === idOrLoc) : idOrLoc;
    if (!loc) return;
    setSelected(loc);
    (window as any).Morph?.updateContext({
      _summary: `Map: ${loc.name} selected`,
      selectedLocation: { id: loc.id, name: loc.name, entity: entityName(loc.entity), type: loc.type },
      filters: { type: typeFilter, entity: entityFilter },
    });
    if (mapInstance.current) mapInstance.current.flyTo([loc.lat, loc.lng], 6, { duration: 1.2 });
  }, [typeFilter, entityFilter]);

  // Register + commands
  useEffect(() => {
    (window as any).Morph?.register({
      description: 'Intelligence map showing HQs, data centers, fabs, and labs of tracked entities.',
      contextHint: '_summary, selectedLocation, filters',
      commands: ['flyTo', 'filterEntity', 'filterType'],
      icon: '\u{1F5FA}\uFE0F',
    });
    (window as any).Morph?.updateContext({
      _summary: `Intel map: ${LOCATIONS.length} locations, ${ENTITIES.length} entities`,
      filters: { type: 'All', entity: 'All' },
    });
    (window as any).Morph?.onCommand((cmd: any) => {
      const c = typeof cmd === 'string' ? cmd : cmd.command;
      const d = cmd.data || {};
      if (c === 'flyTo') flyToLocation(d.locationId || d);
      if (c === 'filterEntity') setEntityFilter(d.entityId || d);
      if (c === 'filterType') setTypeFilter(d.type || d);
    });
  }, []);

  // Init Leaflet
  useEffect(() => {
    loadLeaflet(() => {
      if (!mapRef.current || mapInstance.current) return;
      const L = (window as any).L;
      const map = L.map(mapRef.current, { center: [30, 0], zoom: 2, zoomControl: true, minZoom: 1 });
      const tileLayer = L.tileLayer(isDarkTheme() ? TILES.dark : TILES.light, {
        attribution: '\u00A9 OpenStreetMap \u00A9 CARTO', subdomains: 'abcd', maxZoom: 19,
      }).addTo(map);
      tileLayerRef.current = tileLayer;
      mapInstance.current = map;
      rebuildMarkers();
    });
    return () => {
      if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; }
      markersRef.current = [];
    };
  }, []);

  // Theme change
  useEffect(() => {
    if (!tileLayerRef.current) return;
    tileLayerRef.current.setUrl(isDarkTheme() ? TILES.dark : TILES.light);
  });

  // Rebuild markers when filters change
  const rebuildMarkers = useCallback(() => {
    const L = (window as any).L;
    if (!L || !mapInstance.current) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    const locs = LOCATIONS.filter(loc => {
      if (typeFilter !== 'All' && loc.type !== typeFilter) return false;
      if (entityFilter !== 'All' && loc.entity !== entityFilter) return false;
      return true;
    });
    locs.forEach(loc => {
      const color = TYPE_COLORS[loc.type] || '#888';
      const marker = L.circleMarker([loc.lat, loc.lng], {
        radius: 7, fillColor: color, color: color, weight: 2, opacity: 0.9, fillOpacity: 0.7,
      }).addTo(mapInstance.current);
      marker.bindTooltip(
        `<b>${loc.name}</b><br><span style="color:#888;font-size:11px">${entityName(loc.entity)}</span>`,
        { direction: 'top', offset: [0, -8] },
      );
      marker.on('click', () => flyToLocation(loc));
      markersRef.current.push(marker);
    });
  }, [typeFilter, entityFilter, flyToLocation]);

  useEffect(() => { rebuildMarkers(); }, [rebuildMarkers]);

  const btnBase: React.CSSProperties = {
    border: '1px solid var(--border)', borderRadius: 4, padding: '3px 8px',
    fontSize: 11, cursor: 'pointer', background: 'var(--bg-panel)', color: 'var(--text-2)',
  };
  const btnActive: React.CSSProperties = {
    ...btnBase, background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)',
  };

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg-panel)', color: 'var(--text-1)', overflow: 'hidden', fontFamily: 'system-ui, -apple-system, sans-serif', boxSizing: 'border-box' }}>
      {/* Map */}
      <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      </div>

      {/* Side panel */}
      <div style={{ width: 220, flexShrink: 0, background: 'var(--bg-card)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Type filters */}
        <div style={{ padding: '10px 10px 6px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {FILTER_TYPES.map(t => (
              <button key={t} onClick={() => setTypeFilter(t)} style={typeFilter === t ? btnActive : btnBase}>
                {t === 'All' ? 'All' : TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {/* Entity filter */}
        <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Entity</div>
          <select
            value={entityFilter}
            onChange={e => setEntityFilter(e.target.value)}
            style={{ width: '100%', fontSize: 11, padding: '4px 6px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-1)' }}
          >
            <option value="All">All entities</option>
            {uniqueEntities.map(id => (
              <option key={id} value={id}>{entityName(id)}</option>
            ))}
          </select>
        </div>

        {/* Selected location */}
        {selected && (
          <div style={{ padding: '10px 10px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 3 }}>{selected.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 6 }}>{entityName(selected.entity)}</div>
            <span style={{
              display: 'inline-block', fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 3,
              background: TYPE_COLORS[selected.type] + '22', color: TYPE_COLORS[selected.type],
            }}>
              {TYPE_LABELS[selected.type]}
            </span>
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 6, lineHeight: 1.4 }}>{selected.details}</div>
          </div>
        )}

        {/* Location list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {filtered.length === 0 && (
            <div style={{ padding: '16px 10px', textAlign: 'center', fontSize: 11, color: 'var(--text-3)' }}>No locations match filters.</div>
          )}
          {filtered.map(loc => (
            <button
              key={loc.id}
              onClick={() => flyToLocation(loc)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                background: selected?.id === loc.id ? 'var(--bg-active)' : 'transparent',
                border: 'none', borderLeft: `2px solid ${selected?.id === loc.id ? 'var(--accent)' : 'transparent'}`,
                color: selected?.id === loc.id ? 'var(--text-1)' : 'var(--text-2)',
                cursor: 'pointer', fontSize: 11, textAlign: 'left',
              }}
            >
              <span style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: TYPE_COLORS[loc.type] || '#888',
              }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: selected?.id === loc.id ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{loc.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{entityName(loc.entity)}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Legend */}
        <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(TYPE_LABELS).map(([key, label]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-3)' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: TYPE_COLORS[key] }} />
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
