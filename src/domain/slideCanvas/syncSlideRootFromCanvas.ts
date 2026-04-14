import type { Slide } from "../entities";
import {
  SLIDE_CANVAS_SCENE_VERSION,
  type SlideCanvasElement,
} from "../entities/SlideCanvas";
import {
  readMediaPayloadFromElement,
  readTextMarkdownFromElement,
} from "./slideCanvasPayload";

function sortedElements(slide: Slide): SlideCanvasElement[] {
  const els = slide.canvasScene?.elements ?? [];
  return [...els].sort((a, b) => a.z - b.z);
}

/**
 * Mantiene los campos raíz del slide como espejo del primer bloque relevante (orden z),
 * para listas, IA y clientes que aún lean `title` / panel en la raíz.
 */
export function syncSlideRootFromCanvas(slide: Slide): Slide {
  const scene = slide.canvasScene;
  if (!scene || scene.version !== SLIDE_CANVAS_SCENE_VERSION) {
    return slide;
  }

  const sorted = sortedElements(slide);
  const firstTitle = sorted.find(
    (e) => e.kind === "title" || e.kind === "chapterTitle",
  );
  const firstSubtitle = sorted.find(
    (e) => e.kind === "subtitle" || e.kind === "chapterSubtitle",
  );
  const firstBody = sorted.find(
    (e) => e.kind === "markdown" || e.kind === "matrixNotes",
  );
  const firstMedia = sorted.find((e) => e.kind === "mediaPanel");

  let next: Slide = { ...slide };

  if (firstTitle) {
    next.title = readTextMarkdownFromElement(slide, firstTitle);
  }
  if (firstSubtitle) {
    const sub = readTextMarkdownFromElement(slide, firstSubtitle).trim();
    next.subtitle = sub || undefined;
  }
  if (firstBody) {
    next.content = readTextMarkdownFromElement(slide, firstBody);
  }
  if (firstMedia && slide.type === "content") {
    const media = readMediaPayloadFromElement(slide, firstMedia);
    next = {
      ...next,
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

  return next;
}
