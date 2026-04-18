/**
 * VizView — renders the 3D session visualization.
 * Manages playback store lifecycle (set session on mount, reset on unmount).
 * This component is lazy-loaded by SessionViz.
 */
import { useEffect, useState, useCallback } from "react";
import type { ParsedSession } from "./parser/types.ts";
import { usePlaybackStore } from "./playback/store.ts";
import { useSettingsStore, resolveTheme } from "../../stores/settingsStore";
import { useSelectionStore } from "./playback/selection-store.ts";
import { runCleanups, resetBuilder } from "./playback/graph-builder.ts";
import { SessionForceGraph } from "./graph/ForceGraph.tsx";
import { PlaybackLoop } from "./playback/PlaybackLoop.tsx";
import { Timeline } from "./playback/Timeline.tsx";
import { SessionHeader } from "./panels/SessionHeader.tsx";
import { EventLog } from "./panels/EventLog.tsx";
import { NodeDetail } from "./panels/NodeDetail.tsx";
import { Legend } from "./panels/Legend.tsx";

interface Props {
  session: ParsedSession;
  onClose: () => void;
}

export default function VizView({ session, onClose }: Props) {
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const theme = useSettingsStore(s => s.theme);
  const isDark = resolveTheme(theme) === "dark";
  const containerRef = useCallback((el: HTMLDivElement | null) => {
    if (el) setDims({ w: el.clientWidth, h: el.clientHeight });
  }, []);

  // Resize tracking
  useEffect(() => {
    const onResize = () => {
      const el = document.getElementById("viz-container");
      if (el) setDims({ w: el.clientWidth, h: el.clientHeight });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Set session into playback store on mount
  useEffect(() => {
    usePlaybackStore.getState().setSession(session);
  }, [session]);

  // Full cleanup on unmount — reset stores, dispose Three.js resources
  useEffect(() => {
    return () => {
      usePlaybackStore.getState().reset();
      useSelectionStore.getState().deselect();
      resetBuilder();
      runCleanups();
    };
  }, []);

  // Keyboard shortcuts for playback
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      const store = usePlaybackStore.getState();
      const selection = useSelectionStore.getState();
      switch (e.key) {
        case " ":
          e.preventDefault();
          store.isPlaying ? store.pause() : store.play();
          break;
        case "ArrowRight": store.stepForward(); break;
        case "ArrowLeft": store.stepBackward(); break;
        case "1": store.setSpeed(1); break;
        case "2": store.setSpeed(2); break;
        case "3": store.setSpeed(5); break;
        case "4": store.setSpeed(10); break;
        case "5": store.setSpeed(50); break;
        case "Escape":
          if (selection.selectedNode) selection.deselect();
          else onClose();
          break;
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="flex flex-col flex-1 min-h-0 relative">
      {/* Compact top bar: back + session info */}
      <SessionHeader onClose={onClose} />

      {/* 3D viewport */}
      <div
        id="viz-container"
        ref={containerRef}
        style={{ flex: 1, position: "relative", overflow: "hidden", background: isDark ? "#020208" : "#f4f4f8" }}
      >
        {dims.w > 0 && dims.h > 0 && (
          <SessionForceGraph width={dims.w} height={dims.h} isDark={isDark} />
        )}
        <Legend />
        <EventLog />
        <NodeDetail />
      </div>

      {/* Timeline + playback engine */}
      <Timeline />
      <PlaybackLoop />
    </div>
  );
}
