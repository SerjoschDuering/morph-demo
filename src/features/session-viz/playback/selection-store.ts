import { create } from 'zustand';
import type { GraphNode } from '../parser/types.ts';

export interface SelectionState {
  selectedNode: GraphNode | null;
  select: (node: GraphNode) => void;
  deselect: () => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedNode: null,
  select: (node: GraphNode) => set({ selectedNode: node }),
  deselect: () => set({ selectedNode: null }),
}));
