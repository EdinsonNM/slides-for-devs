import type { Slide } from "../entities";
import { SLIDE_TYPE } from "../entities";
import { DEFAULT_DEVICE_3D_ID } from "../../constants/device3d";
import type { Presenter3dViewState } from "../../utils/presenter3dView";
import {
  PANEL_CONTENT_KIND,
  normalizePanelContentKind,
  type PanelContentKind,
} from "../panelContent/panelContentKind";
import type {
  SlideCanvasElement,
  SlideCanvasElementKind,
  SlideCanvasElementPayload,
  SlideCanvasMediaPayload,
  SlideCanvasScene,
  SlideCanvasTextPayload,
} from "../entities/SlideCanvas";
import {
  isSlideCanvasMediaPayload,
  isSlideCanvasTextPayload,
} from "../entities/SlideCanvas";

export type {
  SlideCanvasElementPayload,
  SlideCanvasMediaPayload,
  SlideCanvasTextPayload,
  SlideCanvasTextRole,
} from "../entities/SlideCanvas";

const TEXT_PAYLOAD_KINDS: ReadonlySet<SlideCanvasElementKind> = new Set([
  "title",
  "chapterTitle",
  "subtitle",
  "chapterSubtitle",
  "markdown",
  "matrixNotes",
]);

export function canvasElementKindNeedsTextPayload(
  kind: SlideCanvasElementKind,
): boolean {
  return TEXT_PAYLOAD_KINDS.has(kind);
}

export function canvasElementKindNeedsMediaPayload(
  kind: SlideCanvasElementKind,
): boolean {
  return kind === "mediaPanel";
}

/** Orden estable por z y desempate por id (evita “primer panel” ambiguo si hay empate en z). */
export function compareCanvasElementsByZThenId(
  a: SlideCanvasElement,
  b: SlideCanvasElement,
): number {
  if (a.z !== b.z) return a.z - b.z;
  return a.id.localeCompare(b.id);
}

export function textPayloadForElementKind(
  slide: Slide,
  kind: SlideCanvasElementKind,
): SlideCanvasTextPayload {
  if (kind === "title" || kind === "chapterTitle") {
    return { type: "text", role: "title", markdown: slide.title };
  }
  if (kind === "subtitle" || kind === "chapterSubtitle") {
    return { type: "text", role: "subtitle", markdown: slide.subtitle ?? "" };
  }
  return { type: "text", role: "body", markdown: slide.content ?? "" };
}

export function mediaPayloadFromSlideRoot(slide: Slide): SlideCanvasMediaPayload {
  return {
    type: "media",
    contentType: slide.contentType ?? PANEL_CONTENT_KIND.IMAGE,
    imageUrl: slide.imageUrl,
    imagePrompt: slide.imagePrompt,
    code: slide.code,
    language: slide.language,
    fontSize: slide.fontSize,
    editorHeight: slide.editorHeight,
    videoUrl: slide.videoUrl,
    presenter3dDeviceId: slide.presenter3dDeviceId,
    presenter3dScreenMedia: slide.presenter3dScreenMedia,
    presenter3dViewState: slide.presenter3dViewState,
    canvas3dGlbUrl: slide.canvas3dGlbUrl,
    canvas3dViewState: slide.canvas3dViewState,
  };
}

/**
 * Campos de la raíz del slide que el **primer** `mediaPanel` puede heredar solo si
 * no están definidos en su propio `payload` (`Object.hasOwn`).
 *
 * Evita que `{ ...root, ...p }` rellene p. ej. `imageUrl` del slide en un Presentador 3D
 * cuyo payload no declara imagen (la raíz sigue espejando otro panel u orden previo).
 */
const ROOT_MEDIA_KEYS_INHERITABLE_BY_KIND: Record<
  PanelContentKind,
  readonly (keyof SlideCanvasMediaPayload)[]
> = {
  [PANEL_CONTENT_KIND.IMAGE]: ["imageUrl", "imagePrompt"],
  [PANEL_CONTENT_KIND.CODE]: [
    "code",
    "language",
    "fontSize",
    "editorHeight",
    "codeEditorTheme",
  ],
  [PANEL_CONTENT_KIND.VIDEO]: ["videoUrl"],
  [PANEL_CONTENT_KIND.PRESENTER_3D]: [
    "presenter3dDeviceId",
    "presenter3dScreenMedia",
    "presenter3dViewState",
  ],
  [PANEL_CONTENT_KIND.CANVAS_3D]: ["canvas3dGlbUrl", "canvas3dViewState"],
};

function mergeFirstMediaPanelPayloadFromRoot(
  slide: Slide,
  p: SlideCanvasMediaPayload,
): SlideCanvasMediaPayload {
  const root = mediaPayloadFromSlideRoot(slide);
  const kind = normalizePanelContentKind(p.contentType);
  const inheritable = ROOT_MEDIA_KEYS_INHERITABLE_BY_KIND[kind];
  const out: SlideCanvasMediaPayload = { ...p, type: "media" };
  for (const key of inheritable) {
    if (Object.prototype.hasOwnProperty.call(p, key)) continue;
    const v = root[key];
    if (v !== undefined) {
      (out as Record<string, unknown>)[key] = v;
    }
  }
  return out;
}

/**
 * Aplica un payload de panel al slide “vista”. Solo sobrescribe campos definidos en `media`
 * para no borrar con `undefined` (p. ej. varios `mediaPanel` y payloads parciales).
 */
export function mergeMediaPayloadIntoSlide(
  slide: Slide,
  media: SlideCanvasMediaPayload,
): Slide {
  const next: Slide = { ...slide, contentType: media.contentType };
  if (media.imageUrl !== undefined) next.imageUrl = media.imageUrl;
  if (media.imagePrompt !== undefined) next.imagePrompt = media.imagePrompt;
  if (media.code !== undefined) next.code = media.code;
  if (media.language !== undefined) next.language = media.language;
  if (media.fontSize !== undefined) next.fontSize = media.fontSize;
  if (media.editorHeight !== undefined) next.editorHeight = media.editorHeight;
  if (media.videoUrl !== undefined) next.videoUrl = media.videoUrl;
  if (media.presenter3dDeviceId !== undefined) {
    next.presenter3dDeviceId = media.presenter3dDeviceId;
  }
  if (media.presenter3dScreenMedia !== undefined) {
    next.presenter3dScreenMedia = media.presenter3dScreenMedia;
  }
  if (media.presenter3dViewState !== undefined) {
    next.presenter3dViewState = media.presenter3dViewState;
  }
  if (media.canvas3dGlbUrl !== undefined) next.canvas3dGlbUrl = media.canvas3dGlbUrl;
  if (media.canvas3dViewState !== undefined) {
    next.canvas3dViewState = media.canvas3dViewState;
  }
  if (media.codeEditorTheme !== undefined) {
    next.codeEditorTheme = media.codeEditorTheme;
  } else {
    delete (next as { codeEditorTheme?: unknown }).codeEditorTheme;
  }
  return next;
}

/** Quita de la copia del slide los campos que el panel de media refleja en la raíz (evita “fantasma” del primer panel al mostrar otro `mediaPanel`). */
function slideWithoutMirroredPanelRootForView(slide: Slide): Slide {
  const {
    imageUrl: _iu,
    imagePrompt: _ip,
    code: _c,
    language: _l,
    fontSize: _fs,
    editorHeight: _eh,
    videoUrl: _vu,
    presenter3dDeviceId: _p3d,
    presenter3dScreenMedia: _p3sm,
    presenter3dViewState: _p3vs,
    canvas3dGlbUrl: _c3g,
    canvas3dViewState: _c3vs,
    codeEditorTheme: _cet,
    ...rest
  } = slide as Slide;
  return rest as Slide;
}

/** Primer `mediaPanel` en orden z (misma convención que `syncSlideRootFromCanvas`). */
export function canvasFirstMediaPanelElementId(slide: Slide): string | null {
  const els = slide.canvasScene?.elements ?? [];
  const sorted = [...els].sort(compareCanvasElementsByZThenId);
  return sorted.find((e) => e.kind === "mediaPanel")?.id ?? null;
}

export function readTextMarkdownFromElement(
  slide: Slide,
  el: SlideCanvasElement,
): string {
  const p = el.payload;
  if (isSlideCanvasTextPayload(p)) return p.markdown;
  if (el.kind === "title" || el.kind === "chapterTitle") return slide.title;
  if (el.kind === "subtitle" || el.kind === "chapterSubtitle") {
    return slide.subtitle ?? "";
  }
  if (el.kind === "markdown" || el.kind === "matrixNotes") {
    return slide.content ?? "";
  }
  return "";
}

function normalizeCodeMediaPayload(
  media: SlideCanvasMediaPayload,
): SlideCanvasMediaPayload {
  if (media.contentType !== PANEL_CONTENT_KIND.CODE) return media;
  return {
    ...media,
    code: media.code ?? "",
    language: media.language ?? "javascript",
    fontSize: media.fontSize ?? 14,
    editorHeight: media.editorHeight ?? 280,
  };
}

/**
 * Lee el payload de un `mediaPanel`. El **primer** panel (orden z) fusiona su `payload` con la raíz
 * del slide solo en campos permitidos por su `contentType` y que no declara el propio payload
 * (`Object.hasOwn`), para no colar p. ej. `imageUrl` de otro panel vía la raíz.
 * El resto usa solo su payload aislado.
 */
export function readMediaPayloadFromElement(
  slide: Slide,
  el: SlideCanvasElement,
): SlideCanvasMediaPayload {
  if (el.kind !== "mediaPanel" || slide.type !== SLIDE_TYPE.CONTENT) {
    const p = el.payload;
    if (isSlideCanvasMediaPayload(p)) return normalizeCodeMediaPayload({ ...p });
    return mediaPayloadFromSlideRoot(slide);
  }

  const p = el.payload;
  const firstId = canvasFirstMediaPanelElementId(slide);

  let base: SlideCanvasMediaPayload;
  if (isSlideCanvasMediaPayload(p)) {
    base =
      firstId === el.id
        ? mergeFirstMediaPanelPayloadFromRoot(slide, p)
        : { ...p };
  } else if (firstId === el.id) {
    base = mediaPayloadFromSlideRoot(slide);
  } else {
    /* No heredar slide.contentType: en la raíz refleja solo el primer mediaPanel. */
    base = {
      type: "media",
      contentType: PANEL_CONTENT_KIND.IMAGE,
    };
  }

  return normalizeCodeMediaPayload(base);
}

/** Slide “vista” con campos de panel tomados de un `mediaPanel` concreto. */
/**
 * Lectura **solo del payload** del `mediaPanel` para Presentador 3D (sin fusionar raíz del slide).
 * Cada bloque del lienzo es una instancia independiente para vista previa / presentador.
 */
export type Presenter3dCanvasBlockDisplay = {
  deviceId: string;
  screenMedia: "image" | "video";
  imageUrl?: string;
  videoUrl?: string;
  viewState?: Presenter3dViewState | null;
};

export function presenter3dDisplayPropsFromCanvasElement(
  slide: Slide,
  el: SlideCanvasElement,
): Presenter3dCanvasBlockDisplay | null {
  if (slide.type !== SLIDE_TYPE.CONTENT || el.kind !== "mediaPanel") {
    return null;
  }
  const p = el.payload;
  if (!isSlideCanvasMediaPayload(p)) return null;
  if (
    normalizePanelContentKind(p.contentType) !== PANEL_CONTENT_KIND.PRESENTER_3D
  ) {
    return null;
  }
  const imageUrl = Object.prototype.hasOwnProperty.call(p, "imageUrl")
    ? p.imageUrl
    : undefined;
  const videoUrl = Object.prototype.hasOwnProperty.call(p, "videoUrl")
    ? p.videoUrl
    : undefined;
  return {
    deviceId: p.presenter3dDeviceId ?? DEFAULT_DEVICE_3D_ID,
    screenMedia: p.presenter3dScreenMedia ?? "image",
    imageUrl,
    videoUrl,
    viewState: p.presenter3dViewState,
  };
}

export function slideAppearanceForMediaElement(
  slide: Slide,
  el: SlideCanvasElement,
): Slide {
  if (el.kind !== "mediaPanel") return slide;
  const cleared = slideWithoutMirroredPanelRootForView(slide);
  const media = readMediaPayloadFromElement(slide, el);
  const merged = mergeMediaPayloadIntoSlide(cleared, media);

  /**
   * Presentador 3D: la textura solo debe existir si el **payload persistido** del bloque
   * declara `imageUrl` / `videoUrl` (hasOwn). Así vista previa / presentador no heredan
   * residuos de la raíz del slide u otros paneles aunque el merge dejara campos colados.
   */
  if (
    slide.type === SLIDE_TYPE.CONTENT &&
    normalizePanelContentKind(media.contentType) ===
      PANEL_CONTENT_KIND.PRESENTER_3D
  ) {
    const raw = el.payload;
    const payloadOwns = (key: "imageUrl" | "videoUrl") =>
      raw !== null &&
      typeof raw === "object" &&
      Object.prototype.hasOwnProperty.call(raw, key);
    if (!payloadOwns("imageUrl")) {
      delete (merged as { imageUrl?: unknown }).imageUrl;
    }
    if (!payloadOwns("videoUrl")) {
      delete (merged as { videoUrl?: unknown }).videoUrl;
    }
  }

  return merged;
}

export function patchElementPayload(
  scene: SlideCanvasScene,
  elementId: string,
  payload: SlideCanvasElementPayload,
): SlideCanvasScene {
  return {
    ...scene,
    elements: scene.elements.map((e) =>
      e.id === elementId ? { ...e, payload } : e,
    ),
  };
}
