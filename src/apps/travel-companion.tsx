import React from 'react';

const DESTINATIONS = [
  { name: 'Tokyo', lat: 35.68, lng: 139.69, country: 'Japan', emoji: '🗼', tagline: 'Neon lights & ancient temples', days: 7, budget: '$2,400', highlights: ['Shibuya Crossing', 'Mount Fuji', 'Tsukiji Market', 'Akihabara'] },
  { name: 'Lisbon', lat: 38.72, lng: -9.14, country: 'Portugal', emoji: '🛺', tagline: 'Fado & pastel de nata', days: 5, budget: '$1,200', highlights: ['Alfama District', 'Belém Tower', 'LX Factory', 'Sintra'] },
  { name: 'Kyoto', lat: 35.01, lng: 135.77, country: 'Japan', emoji: '⛩️', tagline: 'Geisha & bamboo forests', days: 4, budget: '$1,800', highlights: ['Fushimi Inari', 'Arashiyama', 'Gion District', 'Kinkaku-ji'] },
  { name: 'Cape Town', lat: -33.93, lng: 18.42, country: 'South Africa', emoji: '🦁', tagline: 'Where mountains meet ocean', days: 8, budget: '$2,100', highlights: ['Table Mountain', 'Cape of Good Hope', 'Robben Island', 'Winelands'] },
  { name: 'Reykjavik', lat: 64.15, lng: -21.94, country: 'Iceland', emoji: '🌌', tagline: 'Aurora borealis & geysers', days: 6, budget: '$2,800', highlights: ['Northern Lights', 'Blue Lagoon', 'Golden Circle', 'Black Sand Beach'] },
];

type Dest = (typeof DESTINATIONS)[0];

const TILES = {
  dark:  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
};

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

export default function App() {
  const [selected, setSelected] = React.useState<Dest>(DESTINATIONS[0]);
  const mapRef = React.useRef<HTMLDivElement>(null);
  const mapInstance = React.useRef<any>(null);
  const tileLayerRef = React.useRef<any>(null);
  const markersRef = React.useRef<any[]>([]);

  const makeIcon = (emoji: string, active: boolean) => {
    const L = (window as any).L;
    return L.divIcon({
      html: `<div style="font-size:20px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.6));transform:${active ? 'scale(1.4)' : 'scale(1)'};transition:transform 0.2s">${emoji}</div>`,
      className: '',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  };

  const selectDest = React.useCallback((d: Dest) => {
    setSelected(d);
    window.Morph?.updateContext({ destination: d.name, country: d.country, coordinates: [d.lat, d.lng] });
    if (mapInstance.current) mapInstance.current.flyTo([d.lat, d.lng], 5, { duration: 1.2 });
  }, []);

  React.useEffect(() => {
    window.Morph?.register({
      description: 'Interactive travel map. Shows destinations on a world map; click to explore.',
      contextHint: 'selected destination name, country, coordinates',
      capabilities: [],
    });
    window.Morph?.updateContext({ destinations: DESTINATIONS.map(d => ({ name: d.name, country: d.country })), selected: selected.name });
  }, []);

  React.useEffect(() => {
    loadLeaflet(() => {
      if (!mapRef.current || mapInstance.current) return;
      const L = (window as any).L;

      const map = L.map(mapRef.current, { center: [25, 15], zoom: 2, zoomControl: true, minZoom: 1 });

      const tileLayer = L.tileLayer(isDarkTheme() ? TILES.dark : TILES.light, {
        attribution: '© OpenStreetMap © CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      tileLayerRef.current = tileLayer;

      DESTINATIONS.forEach(dest => {
        const marker = L.marker([dest.lat, dest.lng], { icon: makeIcon(dest.emoji, dest.name === selected.name) })
          .addTo(map)
          .bindTooltip(`<b>${dest.name}</b><br><span style="color:#888;font-size:11px">${dest.country}</span>`, { direction: 'top', offset: [0, -10] });
        marker.on('click', () => selectDest(dest));
        markersRef.current.push({ marker, dest });
      });

      mapInstance.current = map;
    });

    return () => {
      if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; }
      markersRef.current = [];
    };
  }, []);

  // Update tile layer when theme changes
  React.useEffect(() => {
    if (!tileLayerRef.current) return;
    tileLayerRef.current.setUrl(isDarkTheme() ? TILES.dark : TILES.light);
  });

  // Update marker icons when selection changes
  React.useEffect(() => {
    if (!(window as any).L) return;
    markersRef.current.forEach(({ marker, dest }) => {
      marker.setIcon(makeIcon(dest.emoji, dest.name === selected.name));
    });
  }, [selected]);

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg-panel)', color: 'var(--text-1)', overflow: 'hidden', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Map */}
      <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      </div>

      {/* Side panel */}
      <div style={{ width: 200, flexShrink: 0, background: 'var(--bg-card)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Selected destination */}
        <div style={{ padding: '14px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 22, marginBottom: 6 }}>{selected.emoji}</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: 2 }}>{selected.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 10 }}>{selected.country} · {selected.tagline}</div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {[{ l: 'Days', v: String(selected.days) }, { l: 'Budget', v: selected.budget }].map(({ l, v }) => (
              <div key={l} style={{ flex: 1, background: 'var(--bg-active)', borderRadius: 6, padding: '6px 8px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 2 }}>{l}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Highlights</div>
          {selected.highlights.map(h => (
            <div key={h} style={{ fontSize: 11, color: 'var(--text-1)', padding: '3px 0', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ color: 'var(--accent)', fontSize: 8 }}>▸</span>{h}
            </div>
          ))}
        </div>

        {/* Destination list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {DESTINATIONS.map(d => (
            <button
              key={d.name}
              onClick={() => selectDest(d)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 12px', background: d.name === selected.name ? 'var(--bg-active)' : 'transparent',
                border: 'none', borderLeft: `2px solid ${d.name === selected.name ? 'var(--accent)' : 'transparent'}`,
                color: d.name === selected.name ? 'var(--text-1)' : 'var(--text-2)',
                cursor: 'pointer', fontSize: 12, textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 15 }}>{d.emoji}</span>
              <div>
                <div style={{ fontWeight: d.name === selected.name ? 600 : 400 }}>{d.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{d.country}</div>
              </div>
            </button>
          ))}
        </div>

        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', fontSize: 10, color: 'var(--text-3)', lineHeight: 1.5 }}>
          Ask: "Plan a {selected.days}-day {selected.name} itinerary"
        </div>
      </div>
    </div>
  );
}
