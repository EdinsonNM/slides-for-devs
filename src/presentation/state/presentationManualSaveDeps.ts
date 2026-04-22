import type { MutableRefObject } from "react";
import type { Slide } from "../../types";
import type { CanvasTextEditTargets } from "../../domain/slideCanvas/slideCanvasApplyEditBuffers";
import type { SavePresentationNowPayload } from "./presentationDeckMutationsDeps";

export type PresentationManualSaveDeps = {
  slides: Slide[];
  setSlides: (slides: Slide[] | ((prev: Slide[]) => Slide[])) => void;
  topic: string;
  setTopic: (topic: string | ((prev: string) => string)) => void;
  selectedCharacterId: string | null;
  currentIndexRef: MutableRefObject<number>;
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
  presentationTitleDraftRef: MutableRefObject<string | null>;
  flushDiagramPending: () => string | null;
  flushIsometricFlowPending: () => string | null;
  savePresentationNow: (
    presentation: SavePresentationNowPayload,
  ) => Promise<string | null>;
  setIsSaving: (value: boolean) => void;
  setSaveMessage: (message: string | null) => void;
};
