import React from 'react';
const { useState, useEffect, useRef, useCallback } = React;
const { ENTITIES, PEOPLE, RELATIONSHIPS, CATEGORIES } = (window as any).CIData;

type NodeDatum = { id: string; label: string; short: string; type: 'entity' | 'person'; category?: string; color: string; r: number; x: number; y: number; vx: number; vy: number; fx?: number | null; fy?: number | null; mystery?: boolean };
type LinkDatum = { source: string; target: string; strength: number; rumored?: boolean; label?: string; type: string };

const ENTITY_RADIUS: Record<string, number> = {
  nvidia: 36, microsoft: 34, google: 34, meta: 30, openai: 28, anthropic: 24,
  tsmc: 28, xai: 22, amd: 22, 'inference-systems': 20,
};

const EDGE_COLORS: Record<string, string> = {
  invest: '#34c759', supply: '#60a5fa', compete: '#ef4444',
  partner: '#a78bfa', hire: '#fbbf24', acquire: '#f472b6',
};

function buildGraph() {
  const nodes: NodeDatum[] = ENTITIES.map(e => ({
    id: e.id, label: e.name, short: e.name.slice(0, 3).toUpperCase(),
    type: 'entity' as const, category: e.category,
    color: CATEGORIES[e.category]?.color || '#888',
    r: ENTITY_RADIUS[e.id] || 24, x: 0, y: 0, vx: 0, vy: 0, mystery: e.category === 'mystery',
  }));
  PEOPLE.forEach(p => nodes.push({
    id: p.id, label: p.name, short: p.name.split(' ').map(w => w[0]).join(''),
    type: 'person', category: undefined,
    color: CATEGORIES[ENTITIES.find(e => e.id === p.entity)?.category || 'ai-lab']?.color || '#888',
    r: 12, x: 0, y: 0, vx: 0, vy: 0,
  }));
  const links: LinkDatum[] = RELATIONSHIPS.map(r => ({
    source: r.source, target: r.target, strength: r.strength,
    rumored: r.rumored, label: r.label || r.type, type: r.type,
  }));
  PEOPLE.forEach(p => links.push({ source: p.id, target: p.entity, strength: 6, type: 'member', label: p.role }));
  return { nodes, links };
}

function loadD3(cb: () => void) {
  if ((window as any).d3) { cb(); return; }
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js';
  script.onload = cb;
  document.head.appendChild(script);
}

const PULSE_CSS = `
@keyframes ci-pulse { 0%,100%{filter:drop-shadow(0 0 6px #f59e0b80)} 50%{filter:drop-shadow(0 0 18px #f59e0bcc)} }
@keyframes ci-dash { to { stroke-dashoffset: -12; } }
`;

export default function App() {
  const svgRef = useRef<SVGSVGElement>(null);
  const simRef = useRef<any>(null);
  const graphRef = useRef(buildGraph());
  const [selected, setSelected] = useState<string | null>(null);
  const [hoverLink, setHoverLink] = useState<number | null>(null);
  const [overlay, setOverlay] = useState<{ entityId: string; locked: boolean } | null>(null);
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const zoomRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const zoomToEntity = useCallback((id: string) => {
    const d3 = (window as any).d3; if (!d3 || !svgRef.current || !zoomRef.current) return;
    const node = graphRef.current.nodes.find(n => n.id === id); if (!node) return;
    const svg = d3.select(svgRef.current);
    const w = svgRef.current.clientWidth, h = svgRef.current.clientHeight;
    svg.transition().duration(600).call(zoomRef.current.transform,
      d3.zoomIdentity.translate(w / 2, h / 2).scale(1.8).translate(-node.x, -node.y));
    setSelected(id);
  }, []);

  const highlightEntities = useCallback((ids: string[]) => setHighlighted(new Set(ids)), []);
  const filterByCategory = useCallback((cat: string) => setFilterCat(cat || null), []);
  const focusCluster = useCallback((id: string) => { setOverlay({ entityId: id, locked: false }); zoomToEntity(id); }, [zoomToEntity]);
  const resetView = useCallback(() => {
    const d3 = (window as any).d3; if (!d3 || !svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(500).call(zoomRef.current.transform, d3.zoomIdentity);
    setSelected(null); setHighlighted(new Set()); setFilterCat(null); setOverlay(null);
  }, []);

  useEffect(() => {
    (window as any).Morph?.register({
      description: 'Force-directed entity relationship graph. Shows AI companies, people, and connections.',
      contextHint: '_summary, selectedEntities, focusedEntity, visibleClusters',
      commands: ['zoom', 'highlight', 'filter', 'focus-cluster', 'reset'], icon: '\u26A1',
    });
    (window as any).Morph?.onCommand((cmd: any) => {
      const c = typeof cmd === 'string' ? cmd : cmd.command;
      const d = cmd.data || {};
      if (c === 'zoom') zoomToEntity(d.entityId);
      if (c === 'highlight') highlightEntities(d.ids || []);
      if (c === 'filter') filterByCategory(d.category);
      if (c === 'focus-cluster') focusCluster(d.entityId);
      if (c === 'reset') resetView();
    });
    const handler = (e: any) => {
      if (e.detail?.appName === 'Entity Network') {
        const { command, data } = e.detail;
        if (command === 'zoom') zoomToEntity(data?.entityId);
        if (command === 'focus-cluster') focusCluster(data?.entityId);
      }
    };
    window.addEventListener('morph:app-command', handler);
    return () => window.removeEventListener('morph:app-command', handler);
  }, [zoomToEntity, highlightEntities, filterByCategory, focusCluster, resetView]);

  useEffect(() => {
    (window as any).Morph?.updateContext({
      _summary: `${ENTITIES.length} entities · ${RELATIONSHIPS.length} links`,
      selectedEntity: selected, focusedEntity: overlay?.entityId || null,
      nodeCount: graphRef.current.nodes.length, linkCount: graphRef.current.links.length,
    });
  }, [selected, overlay]);

  useEffect(() => {
    loadD3(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready || !svgRef.current) return;
    const d3 = (window as any).d3;
    const svg = d3.select(svgRef.current);
    const w = svgRef.current.clientWidth, h = svgRef.current.clientHeight;
    const { nodes, links } = graphRef.current;

    nodes.forEach((n, i) => { n.x = w / 2 + Math.cos(i * 0.8) * 150; n.y = h / 2 + Math.sin(i * 0.8) * 150; });

    const g = svg.append('g').attr('class', 'ci-graph');

    const zoom = d3.zoom().scaleExtent([0.3, 4]).on('zoom', (e: any) => g.attr('transform', e.transform));
    zoomRef.current = zoom;
    svg.call(zoom);

    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance((l: any) => 100 - l.strength * 4).strength((l: any) => l.strength * 0.06))
      .force('charge', d3.forceManyBody().strength((d: any) => d.type === 'entity' ? -400 : -150))
      .force('center', d3.forceCenter(w / 2, h / 2).strength(0.05))
      .force('collide', d3.forceCollide().radius((d: any) => d.r + 6))
      .force('x', d3.forceX(w / 2).strength(0.02))
      .force('y', d3.forceY(h / 2).strength(0.02));
    simRef.current = sim;

    const linkG = g.append('g').attr('class', 'links');
    const linkSel = linkG.selectAll('line').data(links).join('line')
      .attr('stroke', (d: any) => EDGE_COLORS[d.type] || 'var(--text-3)')
      .attr('stroke-opacity', (d: any) => d.rumored ? 0.25 : 0.4)
      .attr('stroke-width', (d: any) => Math.max(1, d.strength * 0.5))
      .attr('stroke-dasharray', (d: any) => d.rumored ? '6 4' : d.type === 'member' ? '2 2' : 'none')
      .style('animation', (d: any) => d.rumored ? 'ci-dash 1s linear infinite' : 'none');

    const nodeG = g.append('g').attr('class', 'nodes');
    const nodeSel = nodeG.selectAll('g').data(nodes).join('g')
      .style('cursor', 'pointer')
      .style('animation', (d: any) => d.mystery ? 'ci-pulse 2s ease-in-out infinite' : 'none');

    nodeSel.append('circle')
      .attr('r', (d: any) => d.r)
      .attr('fill', (d: any) => d.color)
      .attr('fill-opacity', (d: any) => d.type === 'person' ? 0.7 : 0.85)
      .attr('stroke', (d: any) => d.mystery ? '#f59e0b' : 'var(--border)')
      .attr('stroke-width', (d: any) => d.mystery ? 2.5 : 1.5);

    nodeSel.filter((d: any) => d.type === 'entity').append('text')
      .text((d: any) => d.short).attr('text-anchor', 'middle').attr('dy', '0.35em')
      .attr('fill', '#fff').attr('font-size', 10).attr('font-weight', 700)
      .attr('pointer-events', 'none');

    nodeSel.append('title').text((d: any) => d.label);

    const labelSel = nodeG.selectAll('text.label').data(nodes.filter(n => n.type === 'entity')).join('text')
      .attr('class', 'label').text((d: any) => d.label)
      .attr('text-anchor', 'middle').attr('dy', (d: any) => d.r + 14)
      .attr('fill', 'var(--text-2)').attr('font-size', 10).attr('font-weight', 500)
      .attr('pointer-events', 'none');

    const drag = d3.drag()
      .on('start', (e: any, d: any) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag', (e: any, d: any) => { d.fx = e.x; d.fy = e.y; })
      .on('end', (e: any, d: any) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; });
    nodeSel.call(drag);

    nodeSel.on('click', (_: any, d: any) => { setSelected(d.id); });
    nodeSel.on('dblclick', (_: any, d: any) => { setOverlay({ entityId: d.id, locked: false }); });

    linkSel.on('mouseenter', (_: any, d: any) => { const idx = links.indexOf(d); setHoverLink(idx); });
    linkSel.on('mouseleave', () => setHoverLink(null));

    sim.on('tick', () => {
      linkSel.attr('x1', (d: any) => d.source.x).attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x).attr('y2', (d: any) => d.target.y);
      nodeSel.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
      labelSel.attr('x', (d: any) => d.x).attr('y', (d: any) => d.y);
    });

    return () => { sim.stop(); svg.selectAll('.ci-graph').remove(); svg.on('.zoom', null); };
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    const d3 = (window as any).d3;
    const svg = d3.select(svgRef.current);
    const { nodes, links } = graphRef.current;
    const hasFilter = filterCat !== null;
    const hasHL = highlighted.size > 0;

    svg.selectAll('.nodes g').each(function (this: any, d: any) {
      const el = d3.select(this);
      let op = 1;
      if (hasFilter && d.category !== filterCat && d.type === 'entity') op = 0.15;
      if (hasFilter && d.type === 'person') {
        const ent = PEOPLE.find(p => p.id === d.id)?.entity;
        if (ent && ENTITIES.find(e => e.id === ent)?.category !== filterCat) op = 0.15;
      }
      if (hasHL && !highlighted.has(d.id)) op = 0.2;
      if (d.id === selected) el.select('circle').attr('stroke', 'var(--accent)').attr('stroke-width', 3);
      else el.select('circle').attr('stroke', d.mystery ? '#f59e0b' : 'var(--border)').attr('stroke-width', d.mystery ? 2.5 : 1.5);
      el.attr('opacity', op);
    });

    svg.selectAll('.links line').attr('stroke-opacity', (_: any, i: number) => {
      const l = links[i]; if (!l) return 0.35;
      const sId = typeof l.source === 'string' ? l.source : (l.source as any).id;
      const tId = typeof l.target === 'string' ? l.target : (l.target as any).id;
      if (hasHL && !highlighted.has(sId) && !highlighted.has(tId)) return 0.05;
      if (selected && sId !== selected && tId !== selected) return 0.12;
      return 0.5;
    });
  }, [ready, selected, highlighted, filterCat]);

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const dotColor = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';

  const overlayData = overlay ? (() => {
    const { nodes, links } = graphRef.current;
    const center = nodes.find(n => n.id === overlay.entityId);
    if (!center) return null;
    const connected = links
      .filter(l => { const s = typeof l.source === 'string' ? l.source : (l.source as any).id; const t = typeof l.target === 'string' ? l.target : (l.target as any).id; return s === overlay.entityId || t === overlay.entityId; })
      .map(l => { const s = typeof l.source === 'string' ? l.source : (l.source as any).id; const t = typeof l.target === 'string' ? l.target : (l.target as any).id; return s === overlay.entityId ? t : s; });
    const neighborNodes = nodes.filter(n => n.id === overlay.entityId || connected.includes(n.id));
    const neighborLinks = links.filter(l => { const s = typeof l.source === 'string' ? l.source : (l.source as any).id; const t = typeof l.target === 'string' ? l.target : (l.target as any).id; return (s === overlay.entityId || t === overlay.entityId) && connected.includes(s === overlay.entityId ? t : s); });
    return { center, neighborNodes, neighborLinks };
  })() : null;

  const hoveredLinkData = hoverLink !== null ? graphRef.current.links[hoverLink] : null;

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', background: 'var(--bg-panel)', overflow: 'hidden', boxSizing: 'border-box' }}>
      <style>{PULSE_CSS}</style>
      <svg ref={svgRef} style={{ width: '100%', height: '100%', backgroundImage: `radial-gradient(circle, ${dotColor} 1px, transparent 1px)`, backgroundSize: '24px 24px' }} />

      {/* Legend — top-left */}
      <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {Object.entries(CATEGORIES).map(([key, val]) => (
            <button key={key} onClick={() => setFilterCat(filterCat === key ? null : key)} style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8,
              border: filterCat === key ? `2px solid ${val.color}` : '1px solid var(--border)',
              background: 'var(--bg-card)', color: 'var(--text-2)', fontSize: 11, fontWeight: 500,
              cursor: 'pointer', backdropFilter: 'blur(12px)', opacity: 0.95,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: val.color, display: 'inline-block' }} />
              {val.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '4px 6px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)', backdropFilter: 'blur(12px)', opacity: 0.9 }}>
          {Object.entries(EDGE_COLORS).map(([type, color]) => (
            <span key={type} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: 'var(--text-3)', textTransform: 'capitalize' }}>
              <span style={{ width: 14, height: 2, background: color, borderRadius: 1, display: 'inline-block' }} />
              {type}
            </span>
          ))}
        </div>
      </div>

      {/* Hover tooltip for links */}
      {hoveredLinkData && (() => {
        const s = typeof hoveredLinkData.source === 'string' ? hoveredLinkData.source : (hoveredLinkData.source as any).id;
        const t = typeof hoveredLinkData.target === 'string' ? hoveredLinkData.target : (hoveredLinkData.target as any).id;
        const sNode = graphRef.current.nodes.find(n => n.id === s);
        const tNode = graphRef.current.nodes.find(n => n.id === t);
        if (!sNode || !tNode) return null;
        return (
          <div style={{ position: 'absolute', top: 12, right: 12, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', fontSize: 11, color: 'var(--text-1)', backdropFilter: 'blur(16px)', maxWidth: 200 }}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>{sNode.label} &harr; {tNode.label}</div>
            <div style={{ color: 'var(--text-3)' }}>{hoveredLinkData.label} {hoveredLinkData.rumored ? '(rumored)' : ''}</div>
            <div style={{ color: 'var(--text-3)', marginTop: 2 }}>Strength: {hoveredLinkData.strength}/10</div>
          </div>
        );
      })()}

      {/* Selected node info — bottom-left */}
      {selected && (() => {
        const node = graphRef.current.nodes.find(n => n.id === selected);
        const entity = ENTITIES.find(e => e.id === selected);
        if (!node) return null;
        return (
          <div style={{ position: 'absolute', bottom: 12, left: 12, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 11, color: 'var(--text-1)', backdropFilter: 'blur(16px)', maxWidth: 260 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: node.color }} />
              <span style={{ fontWeight: 700, fontSize: 13 }}>{node.label}</span>
            </div>
            {entity && <div style={{ color: 'var(--text-3)', lineHeight: 1.4 }}>{entity.description.slice(0, 120)}{entity.description.length > 120 ? '...' : ''}</div>}
            {entity && <div style={{ marginTop: 4, color: 'var(--text-3)' }}>HQ: {entity.hq} &middot; {entity.marketCap}</div>}
            <button onClick={() => setSelected(null)} style={{ position: 'absolute', top: 6, right: 8, background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 14 }}>&times;</button>
          </div>
        );
      })()}

      {/* Zoom overlay — bottom-right picture-in-picture */}
      {overlay && overlayData && (
        <div style={{ position: 'absolute', bottom: 12, right: 12, width: 260, height: 240, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, backdropFilter: 'blur(20px)', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>{overlayData.center.label}</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button onClick={() => setOverlay(prev => prev ? { ...prev, locked: !prev.locked } : null)} style={{ background: 'none', border: 'none', fontSize: 11, color: overlay.locked ? 'var(--accent)' : 'var(--text-3)', cursor: 'pointer', fontWeight: overlay.locked ? 700 : 400 }}>
                {overlay.locked ? 'Locked' : 'Lock'}
              </button>
              <button onClick={() => setOverlay(null)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 16 }}>&times;</button>
            </div>
          </div>
          <MiniGraph center={overlayData.center} nodes={overlayData.neighborNodes} links={overlayData.neighborLinks} />
        </div>
      )}
    </div>
  );
}

function MiniGraph({ center, nodes, links }: { center: NodeDatum; nodes: NodeDatum[]; links: LinkDatum[]; }) {
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const d3 = (window as any).d3; if (!d3 || !svgRef.current) return;
    const W = 260, H = 196;
    const miniNodes = nodes.map(n => ({ ...n, x: W / 2 + (Math.random() - 0.5) * 80, y: H / 2 + (Math.random() - 0.5) * 60, vx: 0, vy: 0, fx: n.id === center.id ? W / 2 : null, fy: n.id === center.id ? H / 2 : null }));
    const miniLinks = links.map(l => ({ source: typeof l.source === 'string' ? l.source : (l.source as any).id, target: typeof l.target === 'string' ? l.target : (l.target as any).id, strength: l.strength, rumored: l.rumored }));
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    const g = svg.append('g');
    const linkSel = g.selectAll('line').data(miniLinks).join('line')
      .attr('stroke', 'var(--text-3)').attr('stroke-opacity', 0.3)
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', (d: any) => d.rumored ? '4 3' : 'none');
    const nodeSel = g.selectAll('circle').data(miniNodes).join('circle')
      .attr('r', (d: any) => d.id === center.id ? 18 : (d.type === 'person' ? 8 : 14))
      .attr('fill', (d: any) => d.color).attr('fill-opacity', 0.8)
      .attr('stroke', (d: any) => d.id === center.id ? 'var(--accent)' : 'var(--border)')
      .attr('stroke-width', (d: any) => d.id === center.id ? 2 : 1);
    const labelSel = g.selectAll('text').data(miniNodes).join('text')
      .text((d: any) => d.type === 'entity' ? d.short : d.short)
      .attr('text-anchor', 'middle').attr('dy', (d: any) => (d.id === center.id ? 18 : (d.type === 'person' ? 8 : 14)) + 12)
      .attr('fill', 'var(--text-2)').attr('font-size', 9).attr('font-weight', 500);
    const sim = d3.forceSimulation(miniNodes)
      .force('link', d3.forceLink(miniLinks).id((d: any) => d.id).distance(60).strength(0.15))
      .force('charge', d3.forceManyBody().strength(-120))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collide', d3.forceCollide().radius(20));
    sim.on('tick', () => {
      linkSel.attr('x1', (d: any) => d.source.x).attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x).attr('y2', (d: any) => d.target.y);
      nodeSel.attr('cx', (d: any) => d.x).attr('cy', (d: any) => d.y);
      labelSel.attr('x', (d: any) => d.x).attr('y', (d: any) => d.y);
    });
    return () => sim.stop();
  }, [center.id, nodes.length, links.length]);
  return <svg ref={svgRef} width={260} height={196} />;
}
