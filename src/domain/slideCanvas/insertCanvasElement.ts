import { SLIDE_TYPE, type Slide } from "../entities";
import { PANEL_CONTENT_KIND } from "../panelContent/panelContentKind";
import {
  clampCanvasRect,
  type SlideCanvasElement,
  type SlideCanvasElementKind,
  type SlideCanvasMediaPayload,
  type SlideCanvasTextPayload,
} from "../entities/SlideCanvas";
import { normalizeCanvasElementsZOrder } from "./normalizeCanvasElementsZOrder";

const EMPTY_MEDIA: SlideCanvasMediaPayload = {
  type: "media",
  contentType: PANEL_CONTENT_KIND.IMAGE,
};

function emptyTextPayloadForKind(kind: SlideCanvasElementKind): SlideCanvasTextPayload {
  if (kind === "title" || kind === "chapterTitle") {
    return { type: "text", role: "title", markdown: "" };
  }
  if (kind === "subtitle" || kind === "chapterSubtitle") {
    return { type: "text", role: "subtitle", markdown: "" };
  }
  return { type: "text", role: "body", markdown: "" };
}

function defaultInsertRect(
  kind: SlideCanvasElementKind,
  slide?: Slide,
): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  if (slide?.type === SLIDE_TYPE.ISOMETRIC) {
    if (kind === "title") return { x: 4, y: 3, w: 88, h: 11 };
    if (kind === "markdown") return { x: 4, y: 76, w: 92, h: 20 };
  }
  switch (kind) {
    case "title":
    case "chapterTitle":
      return { x: 8, y: 8, w: 84, h: 11 };
    case "subtitle":
    case "chapterSubtitle":
      return { x: 8, y: 21, w: 84, h: 8 };
    case "markdown":
      return { x: 8, y: 32, w: 84, h: 48 };
    case "mediaPanel":
      return { x: 52, y: 28, w: 40, h: 48 };
    case "matrixNotes":
      return { x: 6, y: 72, w: 88, h: 22 };
    default:
      return { x: 10, y: 30, w: 80, h: 24 };
  }
}

/** Bloques que el usuario puede insertar desde la UI (por tipo de diapositiva). */
export function insertableCanvasElementKindsForSlide(slide: Slide): SlideCanvasElementKind[] {
  switch (slide.type) {
    case SLIDE_TYPE.CONTENT:
      return ["title", "subtitle", "markdown", "mediaPanel"];
    case SLIDE_TYPE.CHAPTER:
      return ["chapterTitle", "chapterSubtitle"];
    case SLIDE_TYPE.MATRIX:
      return ["title", "subtitle", "matrixNotes"];
    case SLIDE_TYPE.ISOMETRIC:
      /** Inserción desde el toolbar del diagrama (no se lista en la barra flotante inferior). */
      return ["title", "markdown"];
    default:
      return [];
  }
}

export function canInsertCanvasElementKind(
  slide: Slide,
  kind: SlideCanvasElementKind,
): boolean {
  return insertableCanvasElementKindsForSlide(slide).includes(kind);
}

/**
 * Crea un elemento nuevo con payload v2 y rect por defecto (ligero desplazamiento si ya hay varios del mismo kind).
 */
export function createCanvasElementForInsert(
  slide: Slide,
  elements: SlideCanvasElement[],
  kind: SlideCanvasElementKind,
): SlideCanvasElement | null {
  if (!canInsertCanvasElementKind(slide, kind)) return null;

  const sameKindCount = elements.filter((e) => e.kind === kind).length;
  const ox = (sameKindCount % 4) * 3;
  const oy = (sameKindCount % 3) * 2.5;

  const raw = defaultInsertRect(kind, slide);
  const rect = clampCanvasRect({
    x: raw.x + ox,
    y: raw.y + oy,
    w: raw.w,
    h: raw.h,
  });

  const maxZ = elements.reduce((m, e) => Math.max(m, e.z), -1);
  const z = maxZ + 1;

  const id = `canvas-el-${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}`;

  const base: SlideCanvasElement = {
    id,
    kind,
    z,
    rect,
  };

  if (
    kind === "title" ||
    kind === "chapterTitle" ||
    kind === "subtitle" ||
    kind === "chapterSubtitle" ||
    kind === "markdown" ||
    kind === "matrixNotes"
  ) {
    return { ...base, payload: emptyTextPayloadForKind(kind) };
  }

  if (kind === "mediaPanel" && slide.type === SLIDE_TYPE.CONTENT) {
    return { ...base, payload: { ...EMPTY_MEDIA } };
  }

  return null;
}

export function appendCanvasElementToScene(
  slide: Slide,
  elements: SlideCanvasElement[],
  kind: SlideCanvasElementKind,
): SlideCanvasElement[] | null {
  const el = createCanvasElementForInsert(slide, elements, kind);
  if (!el) return null;
  return normalizeCanvasElementsZOrder([...elements, el]);
}
