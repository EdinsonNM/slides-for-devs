import type { Slide } from "../entities";
import { SLIDE_TYPE } from "../entities";
import type {
  SlideCanvasElementKind,
  SlideCanvasMediaPayload,
  SlideCanvasScene,
} from "../entities/SlideCanvas";
import {
  compareCanvasElementsByZThenId,
  patchElementPayload,
  readMediaPayloadFromElement,
  textPayloadForElementKind,
} from "./slideCanvasPayload";
import { ensureSlideCanvasScene } from "./ensureSlideCanvasScene";
import { syncSlideRootFromCanvas } from "./syncSlideRootFromCanvas";

export type CanvasTextEditTargets = {
  titleElementId: string | null;
  subtitleElementId: string | null;
  contentElementId: string | null;
  mediaPanelElementId: string | null;
};

function sortedElements(slide: Slide) {
  const els = slide.canvasScene?.elements ?? [];
  return [...els].sort(compareCanvasElementsByZThenId);
}

export function defaultCanvasTextEditTargets(slide: Slide): CanvasTextEditTargets {
  const sorted = sortedElements(slide);
  const titleElementId =
    sorted.find((e) => e.kind === "title" || e.kind === "chapterTitle")?.id ??
    null;
  const subtitleElementId =
    sorted.find((e) => e.kind === "subtitle" || e.kind === "chapterSubtitle")
      ?.id ?? null;
  const contentElementId =
    sorted.find((e) => e.kind === "markdown" || e.kind === "matrixNotes")
      ?.id ?? null;
  const mediaPanelElementId =
    slide.type === SLIDE_TYPE.CONTENT
      ? (sorted.find((e) => e.kind === "mediaPanel")?.id ?? null)
      : null;
  return {
    titleElementId,
    subtitleElementId,
    contentElementId,
    mediaPanelElementId,
  };
}

function isTitleKind(k: SlideCanvasElementKind): boolean {
  return k === "title" || k === "chapterTitle";
}

function isSubtitleKind(k: SlideCanvasElementKind): boolean {
  return k === "subtitle" || k === "chapterSubtitle";
}

function isBodyKind(k: SlideCanvasElementKind): boolean {
  return k === "markdown" || k === "matrixNotes";
}

/**
 * Aplica buffers de edición a los payloads del lienzo y sincroniza la raíz del slide.
 */
export function applyEditBuffersToSlide(
  base: Slide,
  buffers: {
    title: string;
    subtitle: string;
    content: string;
    code: string;
    language: string;
    fontSize: number;
    editorHeight: number;
  },
  targets: CanvasTextEditTargets,
): Slide {
  const ensured = ensureSlideCanvasScene(base);
  if (!ensured.canvasScene) return ensured;
  let scene = ensured.canvasScene;
  let slide: Slide = { ...ensured, canvasScene: scene };

  const patchText = (
    id: string | null,
    kindPred: (k: SlideCanvasElementKind) => boolean,
    markdown: string,
  ) => {
    if (!id) return;
    const el = scene.elements.find((e) => e.id === id);
    if (!el || !kindPred(el.kind)) return;
    const payload = { ...textPayloadForElementKind(slide, el.kind), markdown };
    scene = patchElementPayload(scene, id, payload);
    slide = { ...slide, canvasScene: scene };
  };

  patchText(targets.titleElementId, isTitleKind, buffers.title);
  patchText(targets.subtitleElementId, isSubtitleKind, buffers.subtitle);
  patchText(targets.contentElementId, isBodyKind, buffers.content);

  if (targets.mediaPanelElementId && slide.type === SLIDE_TYPE.CONTENT) {
    const el = scene.elements.find((e) => e.id === targets.mediaPanelElementId);
    if (el?.kind === "mediaPanel") {
      const media = readMediaPayloadFromElement(slide, el);
      const nextMedia = {
        ...media,
        code: buffers.code,
        language: buffers.language,
        fontSize: buffers.fontSize,
        editorHeight: buffers.editorHeight,
      };
      scene = patchElementPayload(scene, targets.mediaPanelElementId, nextMedia);
      slide = { ...slide, canvasScene: scene };
    }
  }

  return syncSlideRootFromCanvas(slide);
}

/** Comparación estable: detecta cambios en bloques que no reflejan el espejo raíz (p. ej. 2º subtítulo). */
function canvasSceneSnapshotForCompare(scene: SlideCanvasScene | undefined): unknown {
  if (!scene) return null;
  const elements = [...scene.elements].map((e) => ({
    id: e.id,
    kind: e.kind,
    z: e.z,
    rect: e.rect,
    rotation: e.rotation,
    payload: e.payload,
  }));
  elements.sort((x, y) => x.id.localeCompare(y.id));
  return { version: scene.version, elements };
}

export function isSlidePatchedDifferentFromBuffers(
  a: Slide,
  b: Slide,
): boolean {
  const rootDiff =
    a.title !== b.title ||
    (a.subtitle ?? "") !== (b.subtitle ?? "") ||
    a.content !== b.content ||
    (a.code ?? "") !== (b.code ?? "") ||
    (a.language || "javascript") !== (b.language || "javascript") ||
    (a.fontSize ?? 14) !== (b.fontSize ?? 14) ||
    (a.editorHeight ?? 280) !== (b.editorHeight ?? 280);
  if (rootDiff) return true;
  return (
    JSON.stringify(canvasSceneSnapshotForCompare(a.canvasScene)) !==
    JSON.stringify(canvasSceneSnapshotForCompare(b.canvasScene))
  );
}

/** Actualiza el payload del panel de media y sincroniza la raíz del slide. */
export function patchSlideMediaPanelByElementId(
  slide: Slide,
  mediaElementId: string | null,
  mutate: (m: SlideCanvasMediaPayload) => SlideCanvasMediaPayload,
): Slide {
  if (slide.type !== SLIDE_TYPE.CONTENT) return slide;
  const ensured = ensureSlideCanvasScene(slide);
  const id =
    mediaElementId ??
    defaultCanvasTextEditTargets(ensured).mediaPanelElementId;
  if (!id || !ensured.canvasScene) return ensured;
  const el = ensured.canvasScene.elements.find((e) => e.id === id);
  if (!el || el.kind !== "mediaPanel") return ensured;
  const media = readMediaPayloadFromElement(ensured, el);
  const nextMedia = mutate(media);
  const scene = patchElementPayload(ensured.canvasScene, id, nextMedia);
  return syncSlideRootFromCanvas({ ...ensured, canvasScene: scene });
}
