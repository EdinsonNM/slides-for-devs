import type { StateCreator } from "zustand";
import type { SlideTextRole } from "../../types/slideTextRole.ts";

export type SlideElementUiSlice = {
  /** Resaltado opcional para herramientas de texto (presentación / lienzo). */
  highlightedTextRole: SlideTextRole | null;
  setHighlightedTextRole: (role: SlideTextRole | null) => void;
};

export const createSlideElementUiSlice: StateCreator<
  SlideElementUiSlice,
  [],
  [],
  SlideElementUiSlice
> = (set) => ({
  highlightedTextRole: null,
  setHighlightedTextRole: (highlightedTextRole) => set({ highlightedTextRole }),
});
