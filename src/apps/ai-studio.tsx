import React from 'react';

type Tab = 'image' | 'video' | 'music' | 'workflow';
type Gen = { id: string; type: 'image' | 'video' | 'music'; prompt: string; url: string; status: 'pending' | 'done' | 'error'; error?: string; ts: number; model: string };

const IMG_MODELS = [
  { id: 'fal-ai/flux-2-pro', label: 'Flux 2 Pro', needsRefs: false },
  { id: 'fal-ai/flux-2', label: 'Flux 2', needsRefs: false },
  { id: 'fal-ai/nano-banana-2/edit', label: 'Nano Banana 2', needsRefs: true },
];
const VID_MODELS = [
  { id: 'fal-ai/kling-video/v3/standard/text-to-video', label: 'Kling v3' },
  { id: 'fal-ai/veo3.1/fast', label: 'Veo 3.1 Fast' },
];
const RATIOS = [
  { id: 'square', label: '1:1' }, { id: 'landscape_16_9', label: '16:9' },
  { id: 'portrait_16_9', label: '9:16' }, { id: 'landscape_4_3', label: '4:3' }, { id: 'portrait_4_3', label: '3:4' },
];
const LS_KEY = 'ai-studio-gens';
const TABS: { id: Tab; label: string }[] = [
  { id: 'image', label: '🖼 Image' }, { id: 'video', label: '🎬 Video' },
  { id: 'music', label: '🎵 Music' }, { id: 'workflow', label: '⚡ Workflow' },
];

const S = {
  root: { height: '100%', background: 'var(--bg-panel)', color: 'var(--text-1)', padding: '16px 20px', overflowY: 'auto' as const, fontFamily: 'system-ui', boxSizing: 'border-box' as const, position: 'relative' as const },
  topBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontSize: 13, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '0.02em' },
  tabBar: { display: 'flex', gap: 2 },
  tab: (a: boolean) => ({ padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: a ? 600 : 400, cursor: 'pointer', border: 'none', background: a ? 'var(--accent)' : 'transparent', color: a ? '#fff' : 'var(--text-3)', transition: 'all 0.12s' }),
  section: { background: 'var(--bg-card)', borderRadius: 10, padding: 14, border: '1px solid var(--border)', marginBottom: 12 },
  row: { display: 'flex', gap: 12, marginBottom: 10 },
  col: { flex: 1 },
  label: { fontSize: 9, color: 'var(--text-3)', marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontWeight: 600 },
  input: { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-1)', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit' },
  seg: (a: boolean) => ({ padding: '4px 9px', borderRadius: 6, fontSize: 11, fontWeight: a ? 600 : 400, cursor: 'pointer', border: 'none', background: a ? 'var(--accent)' : 'var(--bg-input)', color: a ? '#fff' : 'var(--text-2)', transition: 'all 0.12s' }),
  btn: (disabled: boolean) => ({ width: '100%', padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', border: 'none', background: disabled ? 'var(--bg-active)' : 'var(--accent)', color: disabled ? 'var(--text-3)' : '#fff', opacity: disabled ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 6 }),
  refStrip: { display: 'flex', gap: 6, alignItems: 'center', marginTop: 8 },
  refAdd: { width: 40, height: 40, borderRadius: 6, border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: 'var(--text-3)', cursor: 'pointer', background: 'transparent', flexShrink: 0 },
  gallery: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 6, marginTop: 8 },
  galleryItem: { borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', position: 'relative' as const, cursor: 'pointer', background: 'var(--bg-card)', aspectRatio: '1' },
  thumb: { width: '100%', height: '100%', objectFit: 'cover' as const, display: 'block' },
  banner: { background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', borderRadius: 8, padding: '8px 12px', marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'var(--text-2)' },
  overlay: { position: 'absolute' as const, bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.6))', padding: '12px 6px 3px', fontSize: 9, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  modal: { position: 'absolute' as const, inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', cursor: 'zoom-out', borderRadius: 10 },
};

const Spinner = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" style={{ animation: 'ai-studio-spin 1s linear infinite' }}>
    <style>{`@keyframes ai-studio-spin { to { transform: rotate(360deg) } }`}</style>
    <circle cx="12" cy="12" r="10" fill="none" stroke="var(--accent)" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" />
  </svg>
);

function MorphApp() {
  const [activeTab, setActiveTab] = React.useState<Tab>('image');
  const [apiKey, setApiKey] = React.useState('');
  const [showApiInput, setShowApiInput] = React.useState(false);
  const [gens, setGens] = React.useState<Gen[]>([]);
  const [generating, setGenerating] = React.useState(false);
  const [imgPrompt, setImgPrompt] = React.useState('');
  const [imgModel, setImgModel] = React.useState(IMG_MODELS[0].id);
  const [imgRatio, setImgRatio] = React.useState('square');
  const [refImages, setRefImages] = React.useState<string[]>([]);
  const [vidPrompt, setVidPrompt] = React.useState('');
  const [vidModel, setVidModel] = React.useState(VID_MODELS[0].id);
  const [musicPrompt, setMusicPrompt] = React.useState('');
  const [musicLyrics, setMusicLyrics] = React.useState('');
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  // Workflow state
  const nodePos = React.useRef([
    { x: 30, y: 20, w: 155, h: 92, label: 'Flux 2 Pro', color: '#8b5cf6', outs: ['IMAGE'], ins: [] as string[], fields: ['prompt', 'ratio'] },
    { x: 230, y: 10, w: 140, h: 72, label: 'Upscale 2x', color: '#f59e0b', outs: ['IMAGE'], ins: ['IMAGE'], fields: ['scale'] },
    { x: 30, y: 165, w: 155, h: 82, label: 'MiniMax Music', color: '#34c759', outs: ['AUDIO'], ins: [] as string[], fields: ['style', 'lyrics'] },
    { x: 230, y: 145, w: 140, h: 72, label: 'Compose', color: '#3b82f6', outs: ['MEDIA'], ins: ['IMAGE', 'AUDIO'], fields: [] as string[] },
    { x: 420, y: 75, w: 125, h: 68, label: 'Export', color: '#ef4444', outs: [] as string[], ins: ['MEDIA'], fields: ['format'] },
  ]);
  const [dragNode, setDragNode] = React.useState<number | null>(null);
  const dragOff = React.useRef({ x: 0, y: 0 });
  const [, bump] = React.useState(0);

  const cmdRef = React.useRef<(cmd: string) => void>(() => {});
  cmdRef.current = (raw: string) => {
    try {
      const cmd = JSON.parse(raw);
      if (cmd.tab) setActiveTab(cmd.tab);
      if (cmd.type === 'image') { if (cmd.prompt) setImgPrompt(cmd.prompt); if (cmd.model) setImgModel(cmd.model); if (cmd.ratio) setImgRatio(cmd.ratio); }
      else if (cmd.type === 'video') { if (cmd.prompt) setVidPrompt(cmd.prompt); if (cmd.model) setVidModel(cmd.model); }
      else if (cmd.type === 'music') { if (cmd.prompt) setMusicPrompt(cmd.prompt); if (cmd.lyrics) setMusicLyrics(cmd.lyrics); }
      if (cmd.generate) setTimeout(() => generateRef.current?.(cmd.generate), 50);
    } catch {}
  };
  const generateRef = React.useRef<((type: 'image' | 'video' | 'music') => void) | null>(null);

  React.useEffect(() => {
    (window as any).Morph?.register({
      description: 'AI media studio — generate images, videos, and music via fal.ai. Send JSON commands: { tab?, type, prompt?, model?, ratio?, lyrics?, generate? }',
      icon: '🎨', contextHint: 'activeTab, generationCount, apiKeyLoaded',
      commands: ['json'], capabilities: ['readFile'],
    });
    (window as any).Morph?.onCommand((raw: string) => cmdRef.current(raw));
    try { const s = localStorage.getItem(LS_KEY); if (s) setGens(JSON.parse(s)); } catch {}
    (async () => {
      let key = localStorage.getItem('ai-studio-key') || '';
      if (!key) {
        try {
          // Optional: auto-load FAL_AI_KEY from a local env file if present.
          const env = await (window as any).Morph?.readFile('~/.morph.env');
          const m = env?.match(/FAL_AI_KEY=['"]?([^\s'"]+)/);
          if (m) { key = m[1]; localStorage.setItem('ai-studio-key', key); }
        } catch {}
      }
      if (key) setApiKey(key);
    })();
  }, []);

  React.useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(gens.slice(-50)));
    (window as any).Morph?.updateContext({ _summary: `${gens.length} items · ${activeTab}`, activeTab, generationCount: gens.length, apiKeyLoaded: !!apiKey });
  }, [gens, activeTab, apiKey]);

  const generate = React.useCallback(async (type: 'image' | 'video' | 'music') => {
    if (!apiKey || generating) return;
    setGenerating(true);
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    let prompt = '', model = '', endpoint = '';
    let body: Record<string, unknown> = {};
    if (type === 'image') {
      prompt = imgPrompt; model = imgModel;
      if (model === 'fal-ai/nano-banana-2/edit') {
        if (!refImages.length) { setGenerating(false); return; }
        const ar = imgRatio === 'square' ? '1:1' : imgRatio.includes('16_9') ? (imgRatio.startsWith('l') ? '16:9' : '9:16') : (imgRatio.startsWith('l') ? '4:3' : '3:4');
        body = { prompt, image_urls: refImages, resolution: '1K', aspect_ratio: ar };
      } else {
        body = { prompt, image_size: imgRatio, num_images: 1 };
      }
      endpoint = `https://fal.run/${model}`;
    } else if (type === 'video') {
      prompt = vidPrompt; model = vidModel;
      body = { prompt };
      endpoint = `https://fal.run/${model}`;
    } else {
      prompt = musicPrompt; model = 'fal-ai/minimax-music/v2';
      body = { prompt, lyrics_prompt: musicLyrics || prompt, audio_setting: { sample_rate: 44100, bitrate: 128000, format: 'mp3' } };
      endpoint = `https://fal.run/${model}`;
    }
    const gen: Gen = { id, type, prompt, url: '', status: 'pending', ts: Date.now(), model };
    setGens(prev => [gen, ...prev]);
    try {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Authorization': `Key ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 120)}`);
      const data = await res.json();
      const resultUrl = type === 'image' ? data.images?.[0]?.url : type === 'video' ? data.video?.url : data.audio?.url;
      setGens(prev => prev.map(g => g.id === id ? { ...g, url: resultUrl || '', status: resultUrl ? 'done' : 'error', error: resultUrl ? undefined : 'No URL' } : g));
    } catch (e: any) {
      setGens(prev => prev.map(g => g.id === id ? { ...g, status: 'error', error: e.message?.slice(0, 100) } : g));
    }
    setGenerating(false);
  }, [apiKey, generating, imgPrompt, imgModel, imgRatio, refImages, vidPrompt, vidModel, musicPrompt, musicLyrics]);
  generateRef.current = generate;

  const addFiles = React.useCallback((files: File[]) => {
    files.filter(f => f.type.startsWith('image/')).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => { setRefImages(prev => prev.length >= 4 ? prev : [...prev, reader.result as string]); setImgModel('fal-ai/nano-banana-2/edit'); };
      reader.readAsDataURL(file);
    });
  }, []);
  const handleFileInput = React.useCallback((e: any) => { addFiles(Array.from(e.target.files as FileList)); e.target.value = ''; }, [addFiles]);

  const onNodeDown = (i: number, e: any) => { const r = e.currentTarget.getBoundingClientRect(); dragOff.current = { x: e.clientX - r.left, y: e.clientY - r.top }; setDragNode(i); };
  const onCanvasMove = (e: any) => { if (dragNode === null) return; const r = e.currentTarget.getBoundingClientRect(); nodePos.current[dragNode].x = Math.max(0, e.clientX - r.left - dragOff.current.x); nodePos.current[dragNode].y = Math.max(0, e.clientY - r.top - dragOff.current.y); bump(n => n + 1); };
  const onCanvasUp = () => setDragNode(null);

  const curModel = IMG_MODELS.find(m => m.id === imgModel);
  const needsRefs = curModel?.needsRefs && !refImages.length;
  const tabGens = gens.filter(g => activeTab === 'workflow' || g.type === activeTab);
  const nodes = nodePos.current;
  const wfEdges = [{ from: 0, fromPort: 0, to: 1, toPort: 0 }, { from: 1, fromPort: 0, to: 3, toPort: 0 }, { from: 2, fromPort: 0, to: 3, toPort: 1 }, { from: 3, fromPort: 0, to: 4, toPort: 0 }];
  const HDR = 24; const PORT_R = 5; const PORT_SP = 20;
  const portY = (n: typeof nodes[0], idx: number) => n.y + HDR + 14 + idx * PORT_SP;
  const isDark = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';
  const dotColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  return (
    <div style={S.root}>
      <div style={S.topBar}>
        <span style={S.title}>AI Studio</span>
        <div style={S.tabBar}>{TABS.map(t => <button key={t.id} style={S.tab(activeTab === t.id)} onClick={() => setActiveTab(t.id)}>{t.label}</button>)}</div>
      </div>
      {!apiKey && <div style={S.banner}><span>No fal.ai API key.</span>{showApiInput ? <input style={{ ...S.input, width: 200 }} placeholder="Paste key..." onBlur={(e: any) => { if (e.target.value) { setApiKey(e.target.value); localStorage.setItem('ai-studio-key', e.target.value); } }} /> : <button style={S.seg(true)} onClick={() => setShowApiInput(true)}>Enter Key</button>}</div>}

      {activeTab === 'image' && (
        <div style={S.section}>
          <div style={S.row}>
            <div style={S.col}><div style={S.label}>Model</div><div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' as const }}>{IMG_MODELS.map(m => <button key={m.id} style={S.seg(imgModel === m.id)} onClick={() => setImgModel(m.id)}>{m.label}</button>)}</div></div>
            <div style={S.col}><div style={S.label}>Ratio</div><div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' as const }}>{RATIOS.map(r => <button key={r.id} style={S.seg(imgRatio === r.id)} onClick={() => setImgRatio(r.id)}>{r.label}</button>)}</div></div>
          </div>
          <div style={S.label}>Prompt</div>
          <textarea style={{ ...S.input, minHeight: 56, resize: 'vertical' as const }} value={imgPrompt} onChange={(e: any) => setImgPrompt(e.target.value)} placeholder="Describe the image you want to generate..." />
          <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFileInput} />
          <div style={S.refStrip}>
            <button style={S.refAdd} onClick={() => fileInputRef.current?.click()} title="Add reference image">+</button>
            {refImages.map((img, i) => (
              <div key={i} style={{ position: 'relative', width: 40, height: 40, flexShrink: 0 }}>
                <img src={img} style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }} />
                <button onClick={() => setRefImages(prev => prev.filter((_, j) => j !== i))} style={{ position: 'absolute', top: -5, right: -5, width: 16, height: 16, borderRadius: 8, background: 'var(--accent)', color: '#fff', border: 'none', fontSize: 9, cursor: 'pointer', lineHeight: '16px', padding: 0 }}>×</button>
              </div>
            ))}
            {refImages.length > 0 && <span style={{ fontSize: 10, color: 'var(--text-3)' }}>Ref images for Nano Banana 2</span>}
          </div>
          <button style={S.btn(!imgPrompt || generating || needsRefs)} onClick={() => generate('image')} disabled={!imgPrompt || generating || needsRefs}>
            {generating && <Spinner />}{needsRefs ? 'Add ref images for Nano Banana' : generating ? 'Generating...' : 'Generate Image'}
          </button>
        </div>
      )}

      {activeTab === 'video' && (
        <div style={S.section}>
          <div style={S.label}>Model</div>
          <div style={{ display: 'flex', gap: 3, marginBottom: 10 }}>{VID_MODELS.map(m => <button key={m.id} style={S.seg(vidModel === m.id)} onClick={() => setVidModel(m.id)}>{m.label}</button>)}</div>
          <div style={S.label}>Prompt</div>
          <textarea style={{ ...S.input, minHeight: 56, resize: 'vertical' as const }} value={vidPrompt} onChange={(e: any) => setVidPrompt(e.target.value)} placeholder="Describe the video scene..." />
          <button style={S.btn(!vidPrompt || generating)} onClick={() => generate('video')} disabled={!vidPrompt || generating}>
            {generating && <Spinner />}{generating ? 'Generating...' : 'Generate Video'}
          </button>
        </div>
      )}

      {activeTab === 'music' && (
        <div style={S.section}>
          <div style={S.label}>Style</div>
          <textarea style={{ ...S.input, minHeight: 44, resize: 'vertical' as const, marginBottom: 8 }} value={musicPrompt} onChange={(e: any) => setMusicPrompt(e.target.value)} placeholder="Genre, mood, instruments..." />
          <div style={S.label}>Lyrics <span style={{ fontWeight: 400, textTransform: 'none' as const }}>(use [Verse], [Chorus]...)</span></div>
          <textarea style={{ ...S.input, minHeight: 70, resize: 'vertical' as const }} value={musicLyrics} onChange={(e: any) => setMusicLyrics(e.target.value)} placeholder={"[Verse]\nLyrics here...\n\n[Chorus]\nHook..."} />
          <button style={S.btn(!musicPrompt || generating)} onClick={() => generate('music')} disabled={!musicPrompt || generating}>
            {generating && <Spinner />}{generating ? 'Generating...' : 'Generate Music'}
          </button>
        </div>
      )}

      {activeTab === 'workflow' && (
        <div>
          <div style={{ ...S.section, position: 'relative', height: 320, overflow: 'hidden', cursor: dragNode !== null ? 'grabbing' : 'default', padding: 0, backgroundImage: `radial-gradient(circle, ${dotColor} 1px, transparent 1px)`, backgroundSize: '20px 20px' }} onMouseMove={onCanvasMove} onMouseUp={onCanvasUp} onMouseLeave={onCanvasUp}>
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
              {wfEdges.map((edge, i) => { const src = nodes[edge.from]; const dst = nodes[edge.to]; const x1 = src.x + src.w; const y1 = portY(src, edge.fromPort); const x2 = dst.x; const y2 = portY(dst, edge.toPort); const cx = Math.abs(x2-x1)*0.5; return <path key={i} d={`M${x1},${y1} C${x1+cx},${y1} ${x2-cx},${y2} ${x2},${y2}`} fill="none" stroke={src.color} strokeWidth="2" opacity="0.6" />; })}
            </svg>
            {nodes.map((n, i) => (
              <div key={i} onMouseDown={(e: any) => onNodeDown(i, e)} style={{ position: 'absolute', left: n.x, top: n.y, width: n.w, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', cursor: 'grab', userSelect: 'none' as const, boxShadow: '0 2px 12px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <div style={{ height: HDR, background: n.color, display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: 11, fontWeight: 600, color: '#fff' }}>{n.label}</div>
                <div style={{ padding: '6px 8px', fontSize: 10, position: 'relative' }}>
                  {n.ins.map((p, pi) => <div key={`i${pi}`} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}><svg width={PORT_R*2+2} height={PORT_R*2+2} style={{ position: 'absolute', left: -(PORT_R+1) }}><circle cx={PORT_R+1} cy={PORT_R+1} r={PORT_R} fill={n.color} stroke="var(--bg-card)" strokeWidth="1.5" /></svg><span style={{ color: 'var(--text-3)', marginLeft: 6 }}>{p}</span></div>)}
                  {n.fields.map((f, fi) => <div key={`f${fi}`} style={{ background: 'var(--bg-input)', borderRadius: 4, padding: '2px 6px', marginBottom: 3, color: 'var(--text-2)', fontSize: 9 }}>{f}</div>)}
                  {n.outs.map((p, pi) => <div key={`o${pi}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginBottom: 4 }}><span style={{ color: 'var(--text-3)' }}>{p}</span><svg width={PORT_R*2+2} height={PORT_R*2+2} style={{ position: 'absolute', right: -(PORT_R+1) }}><circle cx={PORT_R+1} cy={PORT_R+1} r={PORT_R} fill={n.color} stroke="var(--bg-card)" strokeWidth="1.5" /></svg></div>)}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, color: 'var(--text-3)', fontSize: 10 }}><span>Drag to rearrange — execution coming soon</span><span>{nodes.length} nodes · {wfEdges.length} edges</span></div>
        </div>
      )}

      {tabGens.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={S.label}>Gallery ({tabGens.length})</div>
          <div style={S.gallery}>
            {tabGens.map(g => (
              <div key={g.id} style={S.galleryItem} onClick={() => { if (g.status === 'done' && g.type === 'image') setPreviewUrl(g.url); else if (g.url) window.open(g.url, '_blank'); }}>
                {g.status === 'pending' && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Spinner /></div>}
                {g.status === 'error' && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#ef4444', fontSize: 10, padding: 6, textAlign: 'center' }}>{g.error || 'Error'}</div>}
                {g.status === 'done' && g.type === 'image' && <img src={g.url} style={S.thumb} />}
                {g.status === 'done' && g.type === 'video' && <video src={g.url} style={S.thumb} muted autoPlay loop />}
                {g.status === 'done' && g.type === 'music' && <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 6, gap: 4 }}><span style={{ fontSize: 22 }}>🎵</span><audio src={g.url} controls style={{ width: '100%' }} /></div>}
                {g.status === 'done' && <div style={S.overlay}>{g.model?.split('/').pop() || ''}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {previewUrl && (
        <div style={S.modal} onClick={() => setPreviewUrl(null)}>
          <img src={previewUrl} style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: 12, boxShadow: '0 8px 40px rgba(0,0,0,0.4)' }} onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

export default MorphApp;
