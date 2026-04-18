import { useCallback } from 'react';
import { usePlaybackStore, type PlaybackSpeed } from './store.ts';
import { useHeatmapStore } from './heatmap-store.ts';
import { getPanel } from '../panels/panel-styles.ts';
import { SkipBack, Play, Pause, SkipForward, Flame } from 'lucide-react';

const SPEEDS: PlaybackSpeed[] = [1, 2, 5, 10, 50];

function getIsDark() {
  return document.documentElement.getAttribute("data-theme") !== "light";
}

export function Timeline() {
  const isDark = getIsDark();
  const P = getPanel();

  const barStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    background: isDark ? '#0a0a0f' : 'var(--bg-card)',
    borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'var(--border)'}`,
    fontFamily: P.font,
    fontVariantNumeric: 'tabular-nums',
    fontSize: 11,
    color: P.textMuted,
    userSelect: 'none',
    flexShrink: 0,
  };

  const session = usePlaybackStore((s) => s.session);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const speed = usePlaybackStore((s) => s.speed);
  const currentEventIndex = usePlaybackStore((s) => s.currentEventIndex);
  const play = usePlaybackStore((s) => s.play);
  const pause = usePlaybackStore((s) => s.pause);
  const setSpeed = usePlaybackStore((s) => s.setSpeed);
  const stepForward = usePlaybackStore((s) => s.stepForward);
  const stepBackward = usePlaybackStore((s) => s.stepBackward);
  const seekToEvent = usePlaybackStore((s) => s.seekToEvent);

  const heatmapEnabled = useHeatmapStore((s) => s.enabled);
  const heatmapToggle = useHeatmapStore((s) => s.toggle);

  const totalEvents = session ? session.events.length : 0;

  const handleScrub = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      seekToEvent(Number(e.target.value));
    },
    [seekToEvent],
  );

  const handlePlayPause = useCallback(() => {
    if (isPlaying) pause(); else play();
  }, [isPlaying, play, pause]);

  const iconBtnStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: P.text,
    cursor: 'pointer',
    padding: 4,
    borderRadius: 6,
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const speedBtnBorder = isDark ? '#334155' : '#cbd5e1';

  return (
    <div style={barStyle}>
      <button onClick={stepBackward} style={iconBtnStyle} title="Step backward" aria-label="Step backward">
        <SkipBack size={14} />
      </button>
      <button
        onClick={handlePlayPause}
        style={iconBtnStyle}
        title={isPlaying ? 'Pause' : 'Play'}
        aria-label={isPlaying ? 'Pause playback' : 'Start playback'}
      >
        {isPlaying ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <button onClick={stepForward} style={iconBtnStyle} title="Step forward" aria-label="Step forward">
        <SkipForward size={14} />
      </button>

      <input
        type="range"
        min={-1}
        max={totalEvents - 1}
        value={currentEventIndex}
        onChange={handleScrub}
        aria-label="Playback position"
        style={{ flex: 1, accentColor: P.accent, cursor: 'pointer', height: 3, minWidth: 60 }}
      />

      <span style={{ minWidth: 70, textAlign: 'center', whiteSpace: 'nowrap', fontSize: 10, color: P.textDim }}>
        {currentEventIndex + 1}/{totalEvents}
      </span>

      <div style={{ display: 'flex', gap: 2 }}>
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            aria-pressed={speed === s}
            title={`Speed ${s}x`}
            style={{
              border: `1px solid ${speedBtnBorder}`,
              borderRadius: 3,
              padding: '1px 5px',
              cursor: 'pointer',
              fontSize: 10,
              fontFamily: 'inherit',
              background: speed === s ? P.accent : 'transparent',
              color: speed === s ? '#fff' : P.textDim,
              borderColor: speed === s ? P.accent : speedBtnBorder,
            }}
          >
            {s}x
          </button>
        ))}
      </div>

      <button
        onClick={heatmapToggle}
        style={{
          ...iconBtnStyle,
          color: heatmapEnabled ? '#ef4444' : P.textDim,
        }}
        title={heatmapEnabled ? 'Disable heatmap' : 'Enable heatmap'}
        aria-label="Toggle heatmap overlay"
        aria-pressed={heatmapEnabled}
      >
        <Flame size={14} />
      </button>
    </div>
  );
}
