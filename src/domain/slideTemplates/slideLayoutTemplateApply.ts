import { SLIDE_TYPE, type SlideType } from "../entities";
import { SLIDE_LAYOUT_TEMPLATE_ID, type SlideLayoutTemplateId } from "./slideLayoutTemplateIds";

/** API mínima que el panel de estilos inyecta al aplicar una plantilla. */
export interface SlideLayoutTemplateApplyApi {
  setCurrentSlideType: (type: SlideType) => void;
  setCurrentSlideContentLayout: (
    layout: "split" | "full" | "panel-full",
  ) => void;
}

/**
 * Aplica la plantilla elegida. Centraliza el mapeo id → mutaciones de estado.
 */
export function applySlideLayoutTemplate(
  id: SlideLayoutTemplateId,
  api: SlideLayoutTemplateApplyApi,
): void {
  switch (id) {
    case SLIDE_LAYOUT_TEMPLATE_ID.TITLE:
      api.setCurrentSlideType(SLIDE_TYPE.CHAPTER);
      return;
    case SLIDE_LAYOUT_TEMPLATE_ID.DIAGRAM:
      api.setCurrentSlideType(SLIDE_TYPE.DIAGRAM);
      return;
    case SLIDE_LAYOUT_TEMPLATE_ID.ISOMETRIC_FLOW:
      api.setCurrentSlideType(SLIDE_TYPE.ISOMETRIC);
      return;
    case SLIDE_LAYOUT_TEMPLATE_ID.MIND_MAP:
      api.setCurrentSlideType(SLIDE_TYPE.MIND_MAP);
      return;
    case SLIDE_LAYOUT_TEMPLATE_ID.MAPS:
      api.setCurrentSlideType(SLIDE_TYPE.MAPS);
      return;
    case SLIDE_LAYOUT_TEMPLATE_ID.MATRIX:
      api.setCurrentSlideType(SLIDE_TYPE.MATRIX);
      return;
    case SLIDE_LAYOUT_TEMPLATE_ID.CONTENT_SPLIT:
      api.setCurrentSlideType(SLIDE_TYPE.CONTENT);
      api.setCurrentSlideContentLayout("split");
      return;
    case SLIDE_LAYOUT_TEMPLATE_ID.CONTENT_PANEL_FULL:
      api.setCurrentSlideType(SLIDE_TYPE.CONTENT);
      api.setCurrentSlideContentLayout("panel-full");
      return;
    case SLIDE_LAYOUT_TEMPLATE_ID.CONTENT_FULL:
      api.setCurrentSlideType(SLIDE_TYPE.CONTENT);
      api.setCurrentSlideContentLayout("full");
      return;
  }
}
