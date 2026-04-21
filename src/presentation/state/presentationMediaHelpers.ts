import type { Slide } from "../../types";
import {
  PANEL_CONTENT_KIND,
  normalizePanelContentKind,
} from "../../domain/panelContent";
import type { SlideCanvasMediaPayload } from "../../domain/slideCanvas/slideCanvasPayload";

export function cloneSlideDeck(slides: Slide[]): Slide[] {
  if (typeof structuredClone === "function") {
    return structuredClone(slides) as Slide[];
  }
  return JSON.parse(JSON.stringify(slides)) as Slide[];
}

export function applyImageDataUrlToMediaPanelPayload(
  m: SlideCanvasMediaPayload,
  dataUrl: string,
): SlideCanvasMediaPayload {
  if (normalizePanelContentKind(m.contentType) === PANEL_CONTENT_KIND.PRESENTER_3D) {
    return {
      ...m,
      imageUrl: dataUrl,
      presenter3dScreenMedia: "image",
    };
  }
  return {
    ...m,
    imageUrl: dataUrl,
    contentType: PANEL_CONTENT_KIND.IMAGE,
  };
}

export function applyRiveUrlToMediaPanelPayload(
  m: SlideCanvasMediaPayload,
  riveUrl: string,
): SlideCanvasMediaPayload {
  return {
    ...m,
    contentType: PANEL_CONTENT_KIND.RIVE,
    riveUrl,
  };
}

export function applyVideoUrlToMediaPanelPayload(
  m: SlideCanvasMediaPayload,
  videoUrl: string,
): SlideCanvasMediaPayload {
  if (normalizePanelContentKind(m.contentType) === PANEL_CONTENT_KIND.PRESENTER_3D) {
    return {
      ...m,
      videoUrl,
      presenter3dScreenMedia: "video",
    };
  }
  return {
    ...m,
    videoUrl,
    contentType: PANEL_CONTENT_KIND.VIDEO,
  };
}

export function applyGeneratedImageToMediaPanelPayload(
  m: SlideCanvasMediaPayload,
  imageUrl: string,
  imagePrompt: string,
): SlideCanvasMediaPayload {
  if (normalizePanelContentKind(m.contentType) === PANEL_CONTENT_KIND.PRESENTER_3D) {
    return {
      ...m,
      imageUrl,
      imagePrompt,
      presenter3dScreenMedia: "image",
    };
  }
  return {
    ...m,
    imageUrl,
    imagePrompt,
    contentType: PANEL_CONTENT_KIND.IMAGE,
  };
}
