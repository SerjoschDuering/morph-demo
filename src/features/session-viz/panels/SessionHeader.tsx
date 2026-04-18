import { usePlaybackStore } from '../playback/store.ts';

function formatTokens(n: number): string {
  if (n < 1_000) return String(n);
  if (n < 1_000_000) {
    const k = n / 1_000;
    return k >= 100 ? `${Math.round(k)}K` : `${k.toFixed(1).replace(/\.0$/, '')}K`;
  }
  const m = n / 1_000_000;
  return m >= 100 ? `${Math.round(m)}M` : `${m.toFixed(1).replace(/\.0$/, '')}M`;
}

export function SessionHeader({ onClose }: { onClose: () => void }) {
  const session = usePlaybackStore((s) => s.session);
  const nodes = usePlaybackStore((s) => s.nodes);

  if (!session) return null;

  const fileCount = nodes.filter((n) => n.kind === 'file').length;
  const agentCount = nodes.filter((n) => n.kind === 'agent' || n.kind === 'subagent').length;
  const totalTokens = session.totalTokens.input + session.totalTokens.output;

  return (
    <div className="relative z-20 flex items-center gap-3 px-3 py-2 bg-[var(--bg-sidebar)] border-b border-[var(--border-subtle)] shrink-0">
      <button
        onClick={onClose}
        className="flex items-center gap-1 px-2 py-1 rounded-md text-[12px] text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--bg-active)] transition-colors shrink-0"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back
      </button>
      <div className="min-w-0 flex-1">
        <span className="text-[13px] font-medium text-[var(--text-1)] truncate block">
          {session.slug}
        </span>
      </div>
      <div className="text-[11px] text-[var(--text-3)] whitespace-nowrap shrink-0 hidden sm:block">
        {session.events.length} events · {formatTokens(totalTokens)} tok · {fileCount} files · {agentCount} agents
      </div>
    </div>
  );
}
