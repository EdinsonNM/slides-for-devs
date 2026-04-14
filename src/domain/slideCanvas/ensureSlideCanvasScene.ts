import type { Slide } from "../entities";
import { isSlideCanvasScene } from "../entities/SlideCanvas";
import { migrateLegacySlideToCanvas } from "./migrateLegacySlideToCanvas";
import { upgradeSlideToBlockModel } from "./upgradeSlideToBlockModel";

/** Devuelve el slide con `canvasScene` válido (migra si falta o está corrupto) y modelo v2 por bloque. */
export function ensureSlideCanvasScene(slide: Slide): Slide {
  let s = slide;
  const cs = s.canvasScene;
  if (!isSlideCanvasScene(cs) || cs.elements.length === 0) {
    s = { ...s, canvasScene: migrateLegacySlideToCanvas(s) };
  }
  return upgradeSlideToBlockModel(s);
}

/** Normaliza todo el deck (p. ej. tras cargar desde SQLite o generar). */
export function normalizeSlidesCanvasScenes(slides: Slide[]): Slide[] {
  return slides.map((s) => ensureSlideCanvasScene(s));
}
