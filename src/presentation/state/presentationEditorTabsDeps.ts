import type { MutableRefObject } from "react";
import type { Slide } from "../../types";
import type { DeckVisualTheme } from "../../domain/entities";
import type { CanvasTextEditTargets } from "../../domain/slideCanvas/slideCanvasApplyEditBuffers";

export type PresentationEditorTabsDeps = {
  localAccountScope: string;

  slides: Slide[];
  setSlides: (slides: Slide[] | ((prev: Slide[]) => Slide[])) => void;
  topic: string;
  setTopic: (topic: string | ((prev: string) => string)) => void;
  currentIndex: number;
  setCurrentIndex: (index: number | ((prev: number) => number)) => void;
  currentSavedId: string | null;
  setCurrentSavedId: (id: string | null | ((prev: string | null) => string | null)) => void;
  selectedCharacterId: string | null;
  setSelectedCharacterId: (
    id: string | null | ((prev: string | null) => string | null),
  ) => void;

  deckVisualTheme: DeckVisualTheme;
  setDeckVisualThemeState: (
    theme: DeckVisualTheme | ((prev: DeckVisualTheme) => DeckVisualTheme),
  ) => void;
  deckNarrativePresetId: string;
  setDeckNarrativePresetId: (
    id: string | ((prev: string) => string),
  ) => void;
  narrativeNotes: string;
  setNarrativeNotes: (notes: string | ((prev: string) => string)) => void;
  presentationReadme: string;
  setPresentationReadme: (
    markdown: string | ((prev: string) => string),
  ) => void;

  slidesUndoRef: MutableRefObject<Slide[][]>;
  slidesRedoRef: MutableRefObject<Slide[][]>;

  editTitleRef: MutableRefObject<string>;
  editSubtitleRef: MutableRefObject<string>;
  editContentRef: MutableRefObject<string>;
  editContentRichHtmlRef: MutableRefObject<string>;
  editContentBodyFontScaleRef: MutableRefObject<number>;
  editCodeRef: MutableRefObject<string>;
  editLanguageRef: MutableRefObject<string>;
  editFontSizeRef: MutableRefObject<number>;
  editEditorHeightRef: MutableRefObject<number>;
  canvasTextTargetsRef: MutableRefObject<CanvasTextEditTargets>;
};
