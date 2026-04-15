import type { Slide } from "../entities";
import { SLIDE_TYPE } from "../entities";
import { PANEL_CONTENT_KIND } from "../panelContent/panelContentKind";
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
  return next;
}

/** Primer `mediaPanel` en orden z (misma convención que `syncSlideRootFromCanvas`). */
export function canvasFirstMediaPanelElementId(slide: Slide): string | null {
  const els = slide.canvasScene?.elements ?? [];
  const sorted = [...els].sort((a, b) => a.z - b.z);
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
 * Lee el payload de un `mediaPanel`. Solo el **primer** panel sin payload hereda la raíz del slide;
 * el resto obtiene un payload aislado para no espejar el mismo `code` entre paneles.
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
    base = { ...p };
  } else if (firstId === el.id) {
    base = mediaPayloadFromSlideRoot(slide);
  } else {
    base = {
      type: "media",
      contentType: slide.contentType ?? PANEL_CONTENT_KIND.IMAGE,
    };
  }

  return normalizeCodeMediaPayload(base);
}

/** Slide “vista” con campos de panel tomados de un `mediaPanel` concreto. */
export function slideAppearanceForMediaElement(
  slide: Slide,
  el: SlideCanvasElement,
): Slide {
  if (el.kind !== "mediaPanel") return slide;
  return mergeMediaPayloadIntoSlide(
    slide,
    readMediaPayloadFromElement(slide, el),
  );
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
