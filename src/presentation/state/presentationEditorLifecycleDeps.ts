import type { MutableRefObject } from "react";
import type { Slide } from "../../types";

export type PresentationEditorLifecycleDeps = {
  currentIndex: number;
  prevSlideIndexForFlushRef: MutableRefObject<number>;
  isEditingRef: MutableRefObject<boolean>;
  flushEditsToSlideIndex: (slideIndex: number) => void;
  currentSlide: Slide | undefined;
  syncEditFieldsFromSlide: (slide: Slide) => void;
  setIsEditing: (editing: boolean) => void;
  slidesLength: number;
  localAccountScope: string;
  refreshSavedList: () => Promise<void>;
};
