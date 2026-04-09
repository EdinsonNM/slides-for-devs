/**
 * Identificadores estables de plantillas de layout en el editor (no usar strings sueltos en la UI).
 */
export const SLIDE_LAYOUT_TEMPLATE_ID = {
  TITLE: "title",
  CONTENT_SPLIT: "content-split",
  CONTENT_FULL: "content-full",
  CONTENT_PANEL_FULL: "content-panel-full",
  DIAGRAM: "diagram",
  ISOMETRIC_FLOW: "isometric-flow",
  MATRIX: "matrix",
} as const;

export type SlideLayoutTemplateId =
  (typeof SLIDE_LAYOUT_TEMPLATE_ID)[keyof typeof SLIDE_LAYOUT_TEMPLATE_ID];
