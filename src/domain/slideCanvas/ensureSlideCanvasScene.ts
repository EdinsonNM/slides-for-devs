import { SLIDE_TYPE, type Slide } from "../entities";
import { isSlideCanvasScene } from "../entities/SlideCanvas";
import { migrateLegacySlideToCanvas } from "./migrateLegacySlideToCanvas";
import { normalizeCanvasElementsZOrder } from "./normalizeCanvasElementsZOrder";
import { upgradeSlideToBlockModel } from "./upgradeSlideToBlockModel";

function canvasFullBleedElementNotFull(
  iso: { rect: { x: number; y: number; w: number; h: number } },
): boolean {
  const { x, y, w, h } = iso.rect;
  return x > 0.5 || y > 0.5 || w < 99 || h < 99;
}

const FULL_BLEED_KINDS_FOR_OTHER_SLIDE_TYPES = new Set([
  "mapboxMap",
  "isometricFlow",
  "mindMap",
  "documentEmbed",
]);

/**
 * Slides CANVAS_3D no llevan capa de mapa/isométrico/mapa mental en el canvas.
 * Un bug previo hacía que `patchLegacyIsometricCanvasScene` tratara CANVAS_3D como MAPS
 * e insertara un `mapboxMap` a pantalla completa, tapando el visor 3D y bloqueando punteros.
 */
function stripForeignFullBleedFromCanvas3dSlide(slide: Slide): Slide {
  if (slide.type !== SLIDE_TYPE.CANVAS_3D) return slide;
  const cs = slide.canvasScene;
  if (!isSlideCanvasScene(cs)) return slide;
  const filtered = cs.elements.filter(
    (e) => !FULL_BLEED_KINDS_FOR_OTHER_SLIDE_TYPES.has(e.kind),
  );
  if (filtered.length === cs.elements.length) return slide;
  return {
    ...slide,
    canvasScene: { ...cs, elements: normalizeCanvasElementsZOrder(filtered) },
  };
}

/** Diagrama isométrico no a pantalla completa (p. ej. layout antiguo): restaura rect y z sin borrar bloques de texto. */
function patchLegacyIsometricCanvasScene(slide: Slide): Slide {
  if (
    slide.type !== SLIDE_TYPE.ISOMETRIC &&
    slide.type !== SLIDE_TYPE.MIND_MAP &&
    slide.type !== SLIDE_TYPE.MAPS &&
    slide.type !== SLIDE_TYPE.DOCUMENT
  )
    return slide;
  const cs = slide.canvasScene;
  if (!isSlideCanvasScene(cs)) return slide;

  const expectedKind =
    slide.type === SLIDE_TYPE.ISOMETRIC
      ? "isometricFlow"
      : slide.type === SLIDE_TYPE.MIND_MAP
        ? "mindMap"
        : slide.type === SLIDE_TYPE.DOCUMENT
          ? "documentEmbed"
          : "mapboxMap";
  const iso = cs.elements.find((e) => e.kind === expectedKind);

  if (!iso) {
    // Missing completely (e.g. template changed from Content to MindMap but kept text elements)
    const newElement = {
      id: `canvas-${expectedKind}`,
      kind: expectedKind as any,
      z: -1,
      rect: { x: 0, y: 0, w: 100, h: 100 }
    };
    const elements = normalizeCanvasElementsZOrder([newElement, ...cs.elements]);
    return { ...slide, canvasScene: { ...cs, elements } };
  }

  if (!canvasFullBleedElementNotFull(iso)) return slide;

  const others = cs.elements.filter((e) => e.kind !== expectedKind);
  const isoFixed = {
    ...iso,
    rect: { x: 0, y: 0, w: 100, h: 100 },
    z: -1,
  };
  const elements = normalizeCanvasElementsZOrder([isoFixed, ...others]);
  return { ...slide, canvasScene: { ...cs, elements } };
}

/** Devuelve el slide con `canvasScene` válido (migra si falta o está corrupto) y modelo v2 por bloque. */
export function ensureSlideCanvasScene(slide: Slide): Slide {
  let s = slide;
  const cs = s.canvasScene;
  if (!isSlideCanvasScene(cs) || cs.elements.length === 0) {
    s = { ...s, canvasScene: migrateLegacySlideToCanvas(s) };
  } else {
    s = patchLegacyIsometricCanvasScene(s);
  }
  s = stripForeignFullBleedFromCanvas3dSlide(s);
  return upgradeSlideToBlockModel(s);
}

/** Normaliza todo el deck (p. ej. tras cargar desde SQLite o generar). */
export function normalizeSlidesCanvasScenes(slides: Slide[]): Slide[] {
  return slides.map((s) => ensureSlideCanvasScene(s));
}
