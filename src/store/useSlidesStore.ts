import { create } from "zustand";
import type { Slide } from "../types";

export interface SlidesState {
  slides: Slide[];
  topic: string;
  currentIndex: number;
  setTopic: (topic: string) => void;
  setSlides: (slides: Slide[] | ((prev: Slide[]) => Slide[])) => void;
  setCurrentIndex: (index: number | ((prev: number) => number)) => void;
  pushSlidesUndo: (snapshot: Slide[]) => void;
  undoSlides: () => void;
  redoSlides: () => void;
  // Let the composite handle the detailed logic for now, we just store state.
}

export const useSlidesStore = create<SlidesState>((set) => ({
  slides: [],
  topic: "",
  currentIndex: 0,
  
  setTopic: (topic) => set({ topic }),
  setSlides: (slides) => set((state) => ({ 
    slides: typeof slides === "function" ? slides(state.slides) : slides 
  })),
  setCurrentIndex: (index) => set((state) => ({ 
    currentIndex: typeof index === "function" ? index(state.currentIndex) : index 
  })),

  // Undo/Redo buffers (basic structure, advanced logic mapped via old refs later)
  pushSlidesUndo: () => { /* Logic to be moved */ },
  undoSlides: () => { /* Logic to be moved */ },
  redoSlides: () => { /* Logic to be moved */ }
}));

export function createSlidesSetter<K extends keyof SlidesState>(key: K) {
  return (val: SlidesState[K] | ((prev: SlidesState[K]) => SlidesState[K])) => {
    useSlidesStore.setState((prev) => ({
      ...prev,
      [key]: typeof val === 'function' ? (val as any)(prev[key]) : val
    }));
  };
}
