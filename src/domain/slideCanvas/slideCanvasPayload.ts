import type { Slide } from "../entities";
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
    contentType: slide.contentType ?? "image",
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
  };
}

export function mergeMediaPayloadIntoSlide(
  slide: Slide,
  media: SlideCanvasMediaPayload,
): Slide {
  return {
    ...slide,
    contentType: media.contentType,
    imageUrl: media.imageUrl,
    imagePrompt: media.imagePrompt,
    code: media.code,
    language: media.language,
    fontSize: media.fontSize,
    editorHeight: media.editorHeight,
    videoUrl: media.videoUrl,
    presenter3dDeviceId: media.presenter3dDeviceId,
    presenter3dScreenMedia: media.presenter3dScreenMedia,
    presenter3dViewState: media.presenter3dViewState,
  };
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

export function readMediaPayloadFromElement(
  slide: Slide,
  el: SlideCanvasElement,
): SlideCanvasMediaPayload {
  const p = el.payload;
  if (isSlideCanvasMediaPayload(p)) return p;
  return mediaPayloadFromSlideRoot(slide);
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
