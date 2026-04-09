/** Escena 2D de una diapositiva: rectángulos en % del contenedor 16:9 (origen arriba-izquierda). */

export const SLIDE_CANVAS_SCENE_VERSION = 1 as const;

export type SlideCanvasElementKind =
  | "sectionLabel"
  | "title"
  | "subtitle"
  | "chapterTitle"
  | "chapterSubtitle"
  | "markdown"
  | "mediaPanel"
  | "matrix"
  | "matrixNotes"
  | "excalidraw";

export interface SlideCanvasRect {
  /** 0–100, borde izquierdo del elemento */
  x: number;
  /** 0–100, borde superior */
  y: number;
  /** 0–100, ancho */
  w: number;
  /** 0–100, alto */
  h: number;
}

export interface SlideCanvasElement {
  id: string;
  kind: SlideCanvasElementKind;
  /** Orden de pintado (mayor = encima). */
  z: number;
  rect: SlideCanvasRect;
  /** Grados; origen en el centro del bloque (sentido horario positivo). */
  rotation?: number;
}

export interface SlideCanvasScene {
  version: typeof SLIDE_CANVAS_SCENE_VERSION;
  elements: SlideCanvasElement[];
}

export function clampCanvasRect(r: SlideCanvasRect): SlideCanvasRect {
  const x = Math.max(0, Math.min(100, r.x));
  const y = Math.max(0, Math.min(100, r.y));
  const w = Math.max(4, Math.min(100 - x, r.w));
  const h = Math.max(3, Math.min(100 - y, r.h));
  return { x, y, w, h };
}

function isCanvasRect(v: unknown): v is SlideCanvasRect {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.x === "number" &&
    typeof r.y === "number" &&
    typeof r.w === "number" &&
    typeof r.h === "number"
  );
}

export function isSlideCanvasScene(v: unknown): v is SlideCanvasScene {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    o.version === SLIDE_CANVAS_SCENE_VERSION &&
    Array.isArray(o.elements) &&
    o.elements.every(
      (e) =>
        e &&
        typeof e === "object" &&
        typeof (e as SlideCanvasElement).id === "string" &&
        typeof (e as SlideCanvasElement).kind === "string" &&
        typeof (e as SlideCanvasElement).z === "number" &&
        isCanvasRect((e as SlideCanvasElement).rect) &&
        ((e as SlideCanvasElement).rotation === undefined ||
          typeof (e as SlideCanvasElement).rotation === "number"),
    )
  );
}
