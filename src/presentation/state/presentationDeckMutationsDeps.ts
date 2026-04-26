import type { MutableRefObject } from "react";
import type { Slide } from "../../types";
import type { DeckVisualTheme } from "../../domain/entities";
import type { CanvasTextEditTargets } from "../../domain/slideCanvas/slideCanvasApplyEditBuffers";

export type SavePresentationNowPayload = {
  topic: string;
  slides: Slide[];
  characterId?: string;
  deckVisualTheme?: DeckVisualTheme;
  deckNarrativePresetId?: string;
  narrativeNotes?: string;
  presentationReadme?: string;
};

export type PresentationDeckMutationsDeps = {
  slides: Slide[];
  setSlides: (slides: Slide[] | ((prev: Slide[]) => Slide[])) => void;
  currentIndex: number;
  setCurrentIndex: (index: number | ((prev: number) => number)) => void;
  topic: string;
  selectedCharacterId: string | null;
  canvasTextTargetsRef: MutableRefObject<CanvasTextEditTargets>;
  savePresentationNow: (
    presentation: SavePresentationNowPayload,
  ) => Promise<string | null>;
};
