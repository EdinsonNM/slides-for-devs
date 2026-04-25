import type { MutableRefObject } from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { Slide, SavedCharacter, ImageStyle } from "../../types";
import type { SavePresentationNowPayload } from "./presentationDeckMutationsDeps";
import type { CanvasTextEditTargets } from "../../domain/slideCanvas/slideCanvasApplyEditBuffers";

export type PresentationCharactersResourcesDeps = {
  queryClient: QueryClient;
  localAccountScope: string;
  user: { uid: string } | null;
  savedCharacters: SavedCharacter[];
  setSlides: (slides: Slide[] | ((prev: Slide[]) => Slide[])) => void;
  slidesRef: MutableRefObject<Slide[]>;
  currentIndexRef: MutableRefObject<number>;
  canvasTextTargetsRef: MutableRefObject<CanvasTextEditTargets>;
  topic: string;
  selectedCharacterId: string | null;
  setSelectedCharacterId: (
    id: string | null | ((prev: string | null) => string | null),
  ) => void;
  savePresentationNow: (
    presentation: SavePresentationNowPayload,
  ) => Promise<string | null>;
  hasGemini: boolean;
  imageProvider: "gemini" | "openai";
  geminiImageModelId: string;
  selectedStyle: ImageStyle;
};
