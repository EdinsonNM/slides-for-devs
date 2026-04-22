import { create } from "zustand";
import {
  createSlideElementUiSlice,
  type SlideElementUiSlice,
} from "./slices/slideElementUi.slice.ts";

export type PresentationUiStore = SlideElementUiSlice;

/** Estado UI de la capa `presentation` (Zustand). Los datos del deck siguen en `PresentationContext`. */
export const usePresentationUiStore = create<PresentationUiStore>()(
  (...args) => ({
    ...createSlideElementUiSlice(...args),
  }),
);
