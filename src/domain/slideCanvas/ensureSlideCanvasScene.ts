import type { Slide } from "../entities";
import { isSlideCanvasScene } from "../entities/SlideCanvas";
import { migrateLegacySlideToCanvas } from "./migrateLegacySlideToCanvas";

/** Devuelve el slide con `canvasScene` válido (migra si falta o está corrupto). */
export function ensureSlideCanvasScene(slide: Slide): Slide {
  const s = slide.canvasScene;
  if (isSlideCanvasScene(s) && s.elements.length > 0) {
    return slide;
  }
  return { ...slide, canvasScene: migrateLegacySlideToCanvas(slide) };
}

/** Normaliza todo el deck (p. ej. tras cargar desde SQLite o generar). */
export function normalizeSlidesCanvasScenes(slides: Slide[]): Slide[] {
  return slides.map((s) => ensureSlideCanvasScene(s));
}
