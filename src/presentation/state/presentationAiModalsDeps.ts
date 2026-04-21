import type { MutableRefObject } from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { Slide, ImageStyle, SavedCharacter } from "../../types";
import type { SavePresentationNowPayload } from "./presentationDeckMutationsDeps";
import type { DeckVisualTheme } from "../../domain/entities";
import type { CanvasTextEditTargets } from "../../domain/slideCanvas/slideCanvasApplyEditBuffers";
import type { PromptAttachment } from "../../utils/promptAttachments";

/** Opción del combo de modelo de presentación (derivado en el orquestador). */
export type PresentationModelOptionLite = {
  id: string;
  provider: string;
} | undefined;

export type PresentationAiModalsDeps = {
  queryClient: QueryClient;
  localAccountScope: string;
  lastOpenedSessionKey: string;
  slides: Slide[];
  setSlides: (slides: Slide[] | ((prev: Slide[]) => Slide[])) => void;
  slidesUndoRef: MutableRefObject<Slide[][]>;
  slidesRedoRef: MutableRefObject<Slide[][]>;
  topic: string;
  setTopic: (topic: string | ((prev: string) => string)) => void;
  currentIndex: number;
  setCurrentIndex: (index: number | ((prev: number) => number)) => void;
  currentSavedId: string | null;
  setCurrentSavedId: (
    id: string | null | ((prev: string | null) => string | null),
  ) => void;
  selectedCharacterId: string | null;
  deckVisualTheme: DeckVisualTheme;
  deckNarrativePresetId: string;
  narrativeNotes: string;
  setDeckNarrativePresetId: (id: string | ((prev: string) => string)) => void;
  setNarrativeNotes: (notes: string | ((prev: string) => string)) => void;
  presentationModelId: string;
  presentationModelOption: PresentationModelOptionLite;
  /** Mismo criterio que en el orquestador (`presentationModelOption` + fallback flash). */
  effectiveGeminiModel: string;
  modelForGeminiOps: string;
  deckNarrativeSlideOptions: { deckNarrativeContext: string };
  currentSlide: Slide | undefined;
  slidesRef: MutableRefObject<Slide[]>;
  currentIndexRef: MutableRefObject<number>;
  canvasTextTargetsRef: MutableRefObject<CanvasTextEditTargets>;
  pendingImageGenerateMediaPanelIdRef: MutableRefObject<string | null>;
  pendingImageUploadMediaPanelIdRef: MutableRefObject<string | null>;
  pendingVideoUrlMediaPanelIdRef: MutableRefObject<string | null>;
  setDiagramRemountToken: (fn: (n: number) => number) => void;
  setEditTitle: (value: string | ((prev: string) => string)) => void;
  setEditSubtitle: (value: string | ((prev: string) => string)) => void;
  setEditContent: (value: string | ((prev: string) => string)) => void;
  setEditContentRichHtml: (value: string | ((prev: string) => string)) => void;
  setEditContentBodyFontScale: (value: number | ((prev: number) => number)) => void;
  setEditCode: (value: string | ((prev: string) => string)) => void;
  setEditLanguage: (value: string | ((prev: string) => string)) => void;
  savePresentationNow: (
    presentation: SavePresentationNowPayload,
  ) => Promise<string | null>;
  runAutoSyncAfterSaveRef: MutableRefObject<(id: string) => Promise<void>>;
  user: { uid: string } | null;
  autoCloudSyncOnSave: boolean;
  showImageModal: boolean;
  setShowImageModal: (open: boolean) => void;
  setShowImageUploadModal: (open: boolean) => void;
  setShowSplitModal: (open: boolean) => void;
  setShowRewriteModal: (open: boolean) => void;
  setShowVideoModal: (open: boolean) => void;
  setShowGenerateFullDeckModal: (open: boolean) => void;
  setShowGenerateSlideContentModal: (open: boolean) => void;
  setShowCodeGenModal: (open: boolean) => void;
  setShowSpeechModal: (open: boolean) => void;
  geminiImageModelId: string;
  imageProvider: "gemini" | "openai";
  selectedStyle: ImageStyle;
  includeBackground: boolean;
  savedCharacters: SavedCharacter[];
  setCanvasMediaPanelEditTarget: (
    elementId: string | null,
    options?: { rehydrateCodeBuffers?: boolean },
  ) => void;
};
