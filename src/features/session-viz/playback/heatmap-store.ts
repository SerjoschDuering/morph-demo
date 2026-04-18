import { create } from 'zustand';

interface HeatmapState {
  enabled: boolean;
  toggle: () => void;
}

export const useHeatmapStore = create<HeatmapState>((set) => ({
  enabled: false,
  toggle: () => set((s) => ({ enabled: !s.enabled })),
}));
