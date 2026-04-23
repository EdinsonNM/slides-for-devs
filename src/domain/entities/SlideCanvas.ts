/** Escena 2D de una diapositiva: rectángulos en % del contenedor 16:9 (origen arriba-izquierda). */

import type { Presenter3dViewState } from "../../utils/presenter3dView";
import type { Canvas3dModelTransform } from "../../utils/canvas3dModelTransform";
import type { DataMotionRingState } from "../dataMotionRing/dataMotionRingModel";
import type { PanelContentKind } from "../panelContent/panelContentKind";
import { isPanelContentKind } from "../panelContent/panelContentKind";

/** Alineado con `SlidePanelContentType` / `PANEL_CONTENT_KIND`. */
export type SlideCanvasPanelContentType = PanelContentKind;

/** Tema del bloque de código en un `mediaPanel` (persistido en el payload del lienzo). */
export type SlideCodeEditorTheme = "light" | "dark";

/** Escenas guardadas antes del modelo por-bloque (solo geometría + datos en raíz del slide). */
export const SLIDE_CANVAS_SCENE_LEGACY_VERSION = 1 as const;
/** Escena con `payload` por elemento de texto / panel de media. */
export const SLIDE_CANVAS_SCENE_VERSION = 2 as const;

export type SlideCanvasSceneVersion =
  | typeof SLIDE_CANVAS_SCENE_LEGACY_VERSION
  | typeof SLIDE_CANVAS_SCENE_VERSION;

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
  | "excalidraw"
  | "mindMap"
  | "isometricFlow"
  | "mapboxMap";

export type SlideCanvasTextRole = "title" | "subtitle" | "body";

export type SlideCanvasTextPayload = {
  type: "text";
  role: SlideCanvasTextRole;
  markdown: string;
  /** HTML sanitizado solo para `kind === "markdown"` (descripción en lienzo). */
  richHtml?: string;
  /** Escala tipográfica del bloque (1 = base). */
  bodyFontScale?: number;
};

export type SlideCanvasMediaPayload = {
  type: "media";
  contentType: SlideCanvasPanelContentType;
  imageUrl?: string;
  imagePrompt?: string;
  code?: string;
  language?: string;
  fontSize?: number;
  editorHeight?: number;
  videoUrl?: string;
  iframeEmbedUrl?: string;
  riveUrl?: string;
  /** Nombres de state machines (coma) para interacción; vacío = auto (todas). */
  riveStateMachineNames?: string;
  /** Nombre del artboard; vacío = default del .riv. */
  riveArtboard?: string;
  presenter3dDeviceId?: string;
  presenter3dScreenMedia?: "image" | "video";
  presenter3dViewState?: Presenter3dViewState;
  canvas3dGlbUrl?: string;
  canvas3dViewState?: Presenter3dViewState;
  canvas3dModelTransform?: Canvas3dModelTransform;
  dataMotionRing?: DataMotionRingState;
  /** Solo panel código en lienzo: tema claro/oscuro independiente por bloque. */
  codeEditorTheme?: SlideCodeEditorTheme;
};

export type SlideCanvasElementPayload =
  | SlideCanvasTextPayload
  | SlideCanvasMediaPayload;

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
  /** Contenido por bloque (v2). Ausente en escenas legacy v1. */
  payload?: SlideCanvasElementPayload;
}

export interface SlideCanvasScene {
  version: SlideCanvasSceneVersion;
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

export function isSlideCanvasTextPayload(v: unknown): v is SlideCanvasTextPayload {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    o.type === "text" &&
    (o.role === "title" || o.role === "subtitle" || o.role === "body") &&
    typeof o.markdown === "string"
  );
}

export function isSlideCanvasMediaPayload(v: unknown): v is SlideCanvasMediaPayload {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return o.type === "media" && isPanelContentKind(o.contentType);
}

export function isSlideCanvasElementPayload(
  v: unknown,
): v is SlideCanvasElementPayload {
  return isSlideCanvasTextPayload(v) || isSlideCanvasMediaPayload(v);
}

function isOptionalElementPayload(v: unknown): boolean {
  if (v === undefined) return true;
  return isSlideCanvasElementPayload(v);
}

export function isSlideCanvasScene(v: unknown): v is SlideCanvasScene {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  const ver = o.version;
  if (ver !== SLIDE_CANVAS_SCENE_LEGACY_VERSION && ver !== SLIDE_CANVAS_SCENE_VERSION) {
    return false;
  }
  if (!Array.isArray(o.elements)) return false;
  return o.elements.every(
    (e) =>
      e &&
      typeof e === "object" &&
      typeof (e as SlideCanvasElement).id === "string" &&
      typeof (e as SlideCanvasElement).kind === "string" &&
      typeof (e as SlideCanvasElement).z === "number" &&
      isCanvasRect((e as SlideCanvasElement).rect) &&
      ((e as SlideCanvasElement).rotation === undefined ||
        typeof (e as SlideCanvasElement).rotation === "number") &&
      isOptionalElementPayload((e as SlideCanvasElement).payload),
  );
}
