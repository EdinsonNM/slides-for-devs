import type { MutableRefObject } from "react";
import type { Slide } from "../../types";
import type { CanvasTextEditTargets } from "../../domain/slideCanvas/slideCanvasApplyEditBuffers";

/**
 * Dependencias compartidas para la lógica de edición de slides (buffers, undo, flush al canvas).
 * Los refs viven en el orquestador; este tipo documenta el contrato del sub-hook.
 */
export type PresentationSlideEditingDeps = {
  slidesRef: MutableRefObject<Slide[]>;
  slidesUndoRef: MutableRefObject<Slide[][]>;
  slidesRedoRef: MutableRefObject<Slide[][]>;
  currentIndexRef: MutableRefObject<number>;
  isEditingRef: MutableRefObject<boolean>;
  editTitleRef: MutableRefObject<string>;
  editSubtitleRef: MutableRefObject<string>;
  editContentRef: MutableRefObject<string>;
  editContentRichHtmlRef: MutableRefObject<string>;
  editContentBodyFontScaleRef: MutableRefObject<number>;
  editContentDraftDirtyRef: MutableRefObject<boolean>;
  editCodeRef: MutableRefObject<string>;
  editLanguageRef: MutableRefObject<string>;
  editFontSizeRef: MutableRefObject<number>;
  editEditorHeightRef: MutableRefObject<number>;
  canvasTextTargetsRef: MutableRefObject<CanvasTextEditTargets>;

  setSlides: (slides: Slide[] | ((prev: Slide[]) => Slide[])) => void;
  setIsEditing: (value: boolean | ((prev: boolean) => boolean)) => void;
  setEditTitle: (value: string | ((prev: string) => string)) => void;
  setEditSubtitle: (value: string | ((prev: string) => string)) => void;
  setEditContentState: (value: string | ((prev: string) => string)) => void;
  setEditContentRichHtmlState: (value: string | ((prev: string) => string)) => void;
  /** Estado local del orquestador (escala del cuerpo enriquecido). */
  setEditContentBodyFontScale: (value: number | ((prev: number) => number)) => void;
  setEditCode: (value: string | ((prev: string) => string)) => void;
  setEditLanguage: (value: string | ((prev: string) => string)) => void;
  setEditFontSizeState: (value: number | ((prev: number) => number)) => void;
  setEditEditorHeight: (value: number | ((prev: number) => number)) => void;
  setCanvasMediaPanelElementId: (value: string | null) => void;

  editContent: string;
  editContentRichHtml: string;
  editContentBodyFontScale: number;
  editCode: string;
  editLanguage: string;
  editFontSize: number;
  editEditorHeight: number;
  currentIndex: number;
  isEditing: boolean;
};
