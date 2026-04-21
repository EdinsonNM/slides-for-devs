import type { Slide } from "../../types";

export type PresentationSlideResizeGesturesDeps = {
  isResizing: boolean;
  setIsResizing: (value: boolean) => void;
  isResizingPanelHeight: boolean;
  setIsResizingPanelHeight: (value: boolean) => void;
  currentIndex: number;
  setSlides: (slides: Slide[] | ((prev: Slide[]) => Slide[])) => void;
};
