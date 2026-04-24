import { SLIDE_TYPE, type Slide } from "../entities";
import { SLIDE_LAYOUT_TEMPLATE_ID, type SlideLayoutTemplateId } from "./slideLayoutTemplateIds";

/**
 * Deduce qué miniatura de plantilla debe aparecer seleccionada según el slide actual.
 */
export function inferSlideLayoutTemplateId(slide: Slide): SlideLayoutTemplateId {
  if (slide.type === SLIDE_TYPE.CHAPTER) return SLIDE_LAYOUT_TEMPLATE_ID.TITLE;
  if (slide.type === SLIDE_TYPE.DIAGRAM) return SLIDE_LAYOUT_TEMPLATE_ID.DIAGRAM;
  if (slide.type === SLIDE_TYPE.ISOMETRIC)
    return SLIDE_LAYOUT_TEMPLATE_ID.ISOMETRIC_FLOW;
  if (slide.type === SLIDE_TYPE.MIND_MAP) return SLIDE_LAYOUT_TEMPLATE_ID.MIND_MAP;
  if (slide.type === SLIDE_TYPE.MAPS) return SLIDE_LAYOUT_TEMPLATE_ID.MAPS;
  if (slide.type === SLIDE_TYPE.DOCUMENT)
    return SLIDE_LAYOUT_TEMPLATE_ID.DOCUMENT;
  if (slide.type === SLIDE_TYPE.CANVAS_3D)
    return SLIDE_LAYOUT_TEMPLATE_ID.CANVAS_3D;
  if (slide.type === SLIDE_TYPE.MATRIX) return SLIDE_LAYOUT_TEMPLATE_ID.MATRIX;
  if (slide.type === SLIDE_TYPE.CONTENT) {
    if (slide.contentLayout === "full") return SLIDE_LAYOUT_TEMPLATE_ID.CONTENT_FULL;
    if (slide.contentLayout === "panel-full")
      return SLIDE_LAYOUT_TEMPLATE_ID.CONTENT_PANEL_FULL;
    return SLIDE_LAYOUT_TEMPLATE_ID.CONTENT_SPLIT;
  }
  return SLIDE_LAYOUT_TEMPLATE_ID.CONTENT_SPLIT;
}
