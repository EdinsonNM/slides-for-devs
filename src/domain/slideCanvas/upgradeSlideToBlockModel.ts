import type { Slide } from "../entities";
import {
  isSlideCanvasScene,
  SLIDE_CANVAS_SCENE_LEGACY_VERSION,
  SLIDE_CANVAS_SCENE_VERSION,
  type SlideCanvasElement,
  type SlideCanvasScene,
} from "../entities/SlideCanvas";
import {
  canvasElementKindNeedsMediaPayload,
  canvasElementKindNeedsTextPayload,
  readMediaPayloadFromElement,
  textPayloadForElementKind,
} from "./slideCanvasPayload";
import { syncSlideRootFromCanvas } from "./syncSlideRootFromCanvas";

function elementNeedsUpgrade(e: SlideCanvasElement): boolean {
  if (canvasElementKindNeedsTextPayload(e.kind)) {
    return !e.payload || e.payload.type !== "text";
  }
  if (canvasElementKindNeedsMediaPayload(e.kind)) {
    return !e.payload || e.payload.type !== "media";
  }
  return false;
}

export function detectLegacySlideCanvas(slide: Slide): boolean {
  const raw = slide.canvasScene;
  if (!raw || !isSlideCanvasScene(raw)) return true;
  if (raw.elements.length === 0) return true;
  if (raw.version === SLIDE_CANVAS_SCENE_LEGACY_VERSION) return true;
  return raw.elements.some((e) => elementNeedsUpgrade(e));
}

function upgradeScene(slide: Slide, scene: SlideCanvasScene): SlideCanvasScene {
  const slideCtx: Slide = { ...slide, canvasScene: scene };
  const elements = scene.elements.map((e) => {
    if (canvasElementKindNeedsTextPayload(e.kind)) {
      return {
        ...e,
        payload: textPayloadForElementKind(slide, e.kind),
      };
    }
    if (canvasElementKindNeedsMediaPayload(e.kind) && slide.type === "content") {
      return {
        ...e,
        payload: readMediaPayloadFromElement(slideCtx, e),
      };
    }
    return e;
  });
  return {
    ...scene,
    version: SLIDE_CANVAS_SCENE_VERSION,
    elements,
  };
}

/**
 * Convierte escena v1 o elementos sin payload a v2 y sincroniza la raíz del slide.
 */
export function upgradeSlideToBlockModel(slide: Slide): Slide {
  const scene = slide.canvasScene;
  if (!scene || !isSlideCanvasScene(scene) || scene.elements.length === 0) {
    return slide;
  }
  if (!detectLegacySlideCanvas(slide)) {
    return syncSlideRootFromCanvas(slide);
  }
  const nextScene = upgradeScene(slide, scene);
  const withScene: Slide = { ...slide, canvasScene: nextScene };
  return syncSlideRootFromCanvas(withScene);
}

export function normalizeSlidesToBlockModel(slides: Slide[]): Slide[] {
  return slides.map((s) => upgradeSlideToBlockModel(s));
}
