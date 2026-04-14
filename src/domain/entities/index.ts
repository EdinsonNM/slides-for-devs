export type {
  DeckBackgroundKind,
  DeckContentTone,
  DeckVisualTheme,
} from "./DeckVisualTheme";
export {
  DECK_VISUAL_THEME_VERSION,
  DEFAULT_DECK_VISUAL_THEME,
  deckThemeToExportBackgroundCss,
  mergeDeckVisualTheme,
  normalizeDeckVisualTheme,
} from "./DeckVisualTheme";
export type {
  Slide,
  SlideType,
  SlidePanelContentType,
} from "./Slide";
export { SLIDE_TYPE, slideUsesFullBleedCanvas } from "./Slide";
export type {
  SlideCanvasElement,
  SlideCanvasElementKind,
  SlideCanvasRect,
  SlideCanvasScene,
  SlideCanvasSceneVersion,
  SlideCanvasTextPayload,
  SlideCanvasMediaPayload,
  SlideCanvasElementPayload,
  SlideCanvasTextRole,
  SlideCanvasPanelContentType,
} from "./SlideCanvas";
export {
  SLIDE_CANVAS_SCENE_VERSION,
  SLIDE_CANVAS_SCENE_LEGACY_VERSION,
  clampCanvasRect,
  isSlideCanvasScene,
  isSlideCanvasTextPayload,
  isSlideCanvasMediaPayload,
  isSlideCanvasElementPayload,
} from "./SlideCanvas";
export type { SlideMatrixData } from "./SlideMatrix";
export {
  createEmptySlideMatrixData,
  normalizeSlideMatrixData,
  serializeSlideMatrixForPrompt,
  SLIDE_MATRIX_INITIAL_COLUMN_COUNT,
  SLIDE_MATRIX_INITIAL_DATA_ROW_COUNT,
  SLIDE_MATRIX_MAX_COLUMNS,
  SLIDE_MATRIX_MAX_DATA_ROWS,
  SLIDE_MATRIX_MIN_COLUMNS,
  SLIDE_MATRIX_MIN_DATA_ROWS,
  applyMatrixAddColumn,
  applyMatrixRemoveColumn,
  applyMatrixAddRow,
  applyMatrixRemoveRow,
} from "./SlideMatrix";
