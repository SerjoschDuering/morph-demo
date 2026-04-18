import React from 'react';

type Entry = { name: string; path: string; isDir: boolean };

function loadDeps(cb: () => void) {
  let pending = 2;
  const done = () => { if (--pending === 0) cb(); };
  if ((window as any).marked) { done(); } else {
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/marked@9/marked.min.js';
    s.onload = done;
    document.head.appendChild(s);
  }
  if ((window as any).DOMPurify) { done(); } else {
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/dompurify@3/dist/purify.min.js';
    s.onload = done;
    document.head.appendChild(s);
  }
}

function renderMd(md: string): string {
  const raw = (window as any).marked?.parse(md) ?? md.replace(/</g, '&lt;');
  return (window as any).DOMPurify?.sanitize(raw) ?? raw;
}

export default function App() {
  const [entries, setEntries] = React.useState<Entry[]>([]);
  const [cwd, setCwd] = React.useState('~/Desktop');
  const [cwdInput, setCwdInput] = React.useState('~/Desktop');
  const [selectedPath, setSelectedPath] = React.useState('');
  const [selectedName, setSelectedName] = React.useState('');
  const [content, setContent] = React.useState('');
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [markedReady, setMarkedReady] = React.useState(!!(window as any).marked);
  const [error, setError] = React.useState('');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    loadDeps(() => setMarkedReady(true));
    window.Morph?.register({
      description: 'Markdown notes viewer & editor. Browse folders, read and edit .md files.',
      contextHint: 'currentFile (path), preview (first 200 chars), cwd',
      capabilities: ['readFile', 'listDir'],
    });
  }, []);

  const loadDir = React.useCallback((path: string) => {
    setError('');
    window.Morph?.listDir(path)
      .then((e: Entry[]) => {
        const dirs = e.filter(x => x.isDir);
        const mds = e.filter(x => !x.isDir && x.name.endsWith('.md'));
        setEntries([...dirs, ...mds]);
      })
      .catch(() => setError('Could not list directory'));
  }, []);

  React.useEffect(() => { loadDir(cwd); }, [cwd]);

  const openFile = async (path: string, name: string) => {
    try {
      const text = await window.Morph?.readFile(path) ?? '';
      setContent(text);
      setDraft(text);
      setSelectedPath(path);
      setSelectedName(name);
      setEditing(false);
      window.Morph?.updateContext({ currentFile: path, preview: text.slice(0, 200), cwd });
    } catch { setContent('Error reading file'); }
  };

  const startEdit = () => { setDraft(content); setEditing(true); setTimeout(() => textareaRef.current?.focus(), 50); };
  const cancelEdit = () => setEditing(false);
  const saveEdit = () => { setContent(draft); setEditing(false); /* TODO: write back via Morph */ };

  const filtered = search
    ? entries.filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
    : entries;

  const titleLine = content.split('\n').find(l => l.startsWith('#'))?.replace(/^#+\s*/, '') || selectedName.replace('.md', '');

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg-panel)', color: 'var(--text-1)', fontFamily: 'system-ui, -apple-system, sans-serif', overflow: 'hidden' }}>

      {/* Sidebar */}
      <div style={{ width: 200, flexShrink: 0, background: 'var(--bg-sidebar, var(--bg-card))', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        {/* Folder input */}
        <div style={{ padding: '10px 10px 6px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Folder</div>
          <input
            value={cwdInput}
            onChange={e => setCwdInput(e.target.value)}
            onBlur={() => setCwd(cwdInput)}
            onKeyDown={e => e.key === 'Enter' && setCwd(cwdInput)}
            style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-1)', fontSize: 11, fontFamily: 'monospace', boxSizing: 'border-box', outline: 'none' }}
            placeholder="~/path"
          />
          {error && <div style={{ fontSize: 10, color: '#ef4444', marginTop: 4 }}>{error}</div>}
        </div>

        {/* Search */}
        <div style={{ padding: '0 10px 8px' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-1)', fontSize: 11, boxSizing: 'border-box', outline: 'none' }}
            placeholder="Search..."
          />
        </div>

        {/* File list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 && (
            <div style={{ padding: '12px 12px', fontSize: 11, color: 'var(--text-3)' }}>
              {search ? 'No matches' : 'No .md files'}
            </div>
          )}
          {filtered.map(f => (
            <button
              key={f.path}
              onClick={() => f.isDir ? (setCwd(f.path), setCwdInput(f.path)) : openFile(f.path, f.name)}
              style={{
                width: '100%', display: 'block', padding: '7px 12px', textAlign: 'left',
                background: f.path === selectedPath ? 'var(--bg-active)' : 'transparent',
                border: 'none', borderLeft: `2px solid ${f.path === selectedPath ? 'var(--accent)' : 'transparent'}`,
                color: f.path === selectedPath ? 'var(--text-1)' : 'var(--text-2)',
                cursor: 'pointer', fontSize: 12,
              }}
            >
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: f.path === selectedPath ? 500 : 400 }}>
                {f.isDir ? '📁 ' : ''}{f.name.replace('.md', '')}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Content area */}
      {selectedPath ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          {/* Toolbar */}
          <div style={{ height: 40, display: 'flex', alignItems: 'center', padding: '0 20px', borderBottom: '1px solid var(--border)', gap: 8, flexShrink: 0 }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedName}</span>
            {editing ? (
              <>
                <button onClick={saveEdit} style={{ padding: '4px 12px', borderRadius: 6, background: 'var(--accent)', color: '#fff', border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Save</button>
                <button onClick={cancelEdit} style={{ padding: '4px 10px', borderRadius: 6, background: 'var(--bg-active)', color: 'var(--text-2)', border: '1px solid var(--border)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              </>
            ) : (
              <button onClick={startEdit} style={{ padding: '4px 12px', borderRadius: 6, background: 'var(--bg-active)', color: 'var(--text-2)', border: '1px solid var(--border)', fontSize: 12, cursor: 'pointer' }}>Edit</button>
            )}
          </div>

          {editing ? (
            /* Edit mode — raw textarea */
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              style={{
                flex: 1, padding: '24px 32px', border: 'none', outline: 'none',
                background: 'var(--bg-panel)', color: 'var(--text-1)',
                fontSize: 14, lineHeight: 1.7, fontFamily: "'SF Mono', 'JetBrains Mono', monospace",
                resize: 'none', boxSizing: 'border-box',
              }}
            />
          ) : (
            /* Preview mode */
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
              {titleLine && (
                <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', marginBottom: 16, marginTop: 0, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                  {titleLine}
                </h1>
              )}
              {markedReady ? (
                <div
                  className="md-content"
                  dangerouslySetInnerHTML={{ __html: renderMd(content) }}
                />
              ) : (
                <pre style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-1)', whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{content}</pre>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Empty state */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <div style={{ fontSize: 32, opacity: 0.3 }}>📝</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Select a note to read</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Set a folder path to browse .md files</div>
        </div>
      )}
    </div>
  );
}
