import { useEffect, useRef } from 'react';
import { usePlaybackStore } from './store.ts';

/**
 * Headless component that drives playback via requestAnimationFrame.
 * Calls store.tick(deltaMs) each frame while the session is playing.
 */
export function PlaybackLoop() {
  const lastTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    function loop(now: number) {
      const { isPlaying, tick } = usePlaybackStore.getState();

      if (isPlaying) {
        if (lastTimeRef.current !== null) {
          // B3: Clamp delta to prevent spiral-of-death after tab backgrounding
          const delta = Math.min(now - lastTimeRef.current, 100);
          tick(delta);
        }
        lastTimeRef.current = now;
      } else {
        lastTimeRef.current = null;
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return null;
}
