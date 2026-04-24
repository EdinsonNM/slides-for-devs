import { DEFAULT_DEVICE_3D_ID } from "../../constants/device3d";
import { SLIDE_TYPE, type Slide } from "../entities";
import {
  PANEL_CONTENT_KIND,
  type PanelContentKind,
} from "../panelContent/panelContentKind";
import {
  clampCanvasRect,
  type SlideCanvasElement,
  type SlideCanvasElementKind,
  type SlideCanvasMediaPayload,
  type SlideCanvasRect,
  type SlideCanvasTextPayload,
} from "../entities/SlideCanvas";
import { createDefaultDataMotionRingState } from "../dataMotionRing/dataMotionRingModel";
import { normalizeCanvasElementsZOrder } from "./normalizeCanvasElementsZOrder";

/**
 * Payload inicial de un **nuevo** Presentador 3D en el lienzo: solo claves canónicas,
 * sin `imageUrl` / `videoUrl` / `presenter3dViewState` ni mezcla con la raíz del slide.
 * Cada instancia nueva parte de cero; las texturas se añaden solo vía parche del bloque.
 */
export function createFreshPresenter3dMediaPayload(): SlideCanvasMediaPayload {
  return {
    type: "media",
    contentType: PANEL_CONTENT_KIND.PRESENTER_3D,
    presenter3dDeviceId: DEFAULT_DEVICE_3D_ID,
    presenter3dScreenMedia: "image",
  };
}

function mediaPayloadForNewPanel(
  contentType: PanelContentKind,
): SlideCanvasMediaPayload {
  const base: SlideCanvasMediaPayload = { type: "media", contentType };
  if (contentType === PANEL_CONTENT_KIND.PRESENTER_3D) {
    return createFreshPresenter3dMediaPayload();
  }
  if (contentType === PANEL_CONTENT_KIND.DATA_MOTION_RING) {
    return {
      type: "media",
      contentType: PANEL_CONTENT_KIND.DATA_MOTION_RING,
      dataMotionRing: createDefaultDataMotionRingState(),
    };
  }
  return base;
}

/** Opciones al añadir un bloque al lienzo desde la UI. */
export type AppendCanvasElementOptions = {
  /** Solo aplica al insertar `mediaPanel` en diapositivas de tipo contenido. */
  mediaContentType?: PanelContentKind;
  /** Sustituye el rectángulo calculado (p. ej. soltar una imagen en una posición concreta). */
  insertRectOverride?: SlideCanvasRect;
  /** Se fusiona sobre el payload de media al crear un `mediaPanel`. */
  mediaPanelPayloadOverrides?: Partial<SlideCanvasMediaPayload>;
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
  if (
    slide?.type === SLIDE_TYPE.ISOMETRIC ||
    slide?.type === SLIDE_TYPE.MIND_MAP ||
    slide?.type === SLIDE_TYPE.MAPS ||
    slide?.type === SLIDE_TYPE.CANVAS_3D
  ) {
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
      return ["chapterTitle", "chapterSubtitle", "mediaPanel"];
    case SLIDE_TYPE.MATRIX:
      return ["title", "subtitle", "matrixNotes"];
    case SLIDE_TYPE.ISOMETRIC:
    case SLIDE_TYPE.MIND_MAP:
    case SLIDE_TYPE.MAPS:
    case SLIDE_TYPE.CANVAS_3D:
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
  options?: AppendCanvasElementOptions,
): SlideCanvasElement | null {
  if (!canInsertCanvasElementKind(slide, kind)) return null;

  const sameKindCount = elements.filter((e) => e.kind === kind).length;
  const useRectOverride = options?.insertRectOverride != null;
  const ox = useRectOverride ? 0 : (sameKindCount % 4) * 3;
  const oy = useRectOverride ? 0 : (sameKindCount % 3) * 2.5;

  const raw = defaultInsertRect(kind, slide);
  const rect = useRectOverride
    ? clampCanvasRect(options.insertRectOverride!)
    : clampCanvasRect({
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

  if (
    kind === "mediaPanel" &&
    (slide.type === SLIDE_TYPE.CONTENT || slide.type === SLIDE_TYPE.CHAPTER)
  ) {
    const contentType =
      options?.mediaContentType ??
      options?.mediaPanelPayloadOverrides?.contentType ??
      PANEL_CONTENT_KIND.IMAGE;
    const ov = options?.mediaPanelPayloadOverrides;
    let payload: SlideCanvasMediaPayload;
    if (contentType === PANEL_CONTENT_KIND.PRESENTER_3D) {
      payload = { ...createFreshPresenter3dMediaPayload() };
      if (ov?.presenter3dDeviceId != null && ov.presenter3dDeviceId !== "") {
        payload.presenter3dDeviceId = ov.presenter3dDeviceId;
      }
      if (ov?.presenter3dScreenMedia === "image" || ov?.presenter3dScreenMedia === "video") {
        payload.presenter3dScreenMedia = ov.presenter3dScreenMedia;
      }
    } else {
      const baseMedia = mediaPayloadForNewPanel(contentType);
      payload = {
        ...baseMedia,
        ...ov,
        type: "media",
        contentType,
      };
    }
    return {
      ...base,
      payload,
    };
  }

  return null;
}

export type AppendCanvasElementResult = {
  elements: SlideCanvasElement[];
  /** Elemento recién insertado (mismo id que en `elements`). */
  created: SlideCanvasElement;
};

export function appendCanvasElementToScene(
  slide: Slide,
  elements: SlideCanvasElement[],
  kind: SlideCanvasElementKind,
  options?: AppendCanvasElementOptions,
): AppendCanvasElementResult | null {
  const el = createCanvasElementForInsert(slide, elements, kind, options);
  if (!el) return null;
  return {
    elements: normalizeCanvasElementsZOrder([...elements, el]),
    created: el,
  };
}
