export type { Slide, SlideType, SlidePanelContentType } from "./Slide";
export { SLIDE_TYPE, slideUsesFullBleedCanvas } from "./Slide";
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
