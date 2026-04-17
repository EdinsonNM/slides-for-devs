import type { Slide } from "../entities";
import { SLIDE_TYPE } from "../entities";
import type {
  SlideCanvasElementKind,
  SlideCanvasMediaPayload,
  SlideCanvasScene,
  SlideCanvasTextPayload,
} from "../entities/SlideCanvas";
import { isSlideCanvasTextPayload } from "../entities/SlideCanvas";
import {
  compareCanvasElementsByZThenId,
  patchElementPayload,
  readMediaPayloadFromElement,
  textPayloadForElementKind,
} from "./slideCanvasPayload";
import { ensureSlideCanvasScene } from "./ensureSlideCanvasScene";
import { syncSlideRootFromCanvas } from "./syncSlideRootFromCanvas";
import { sanitizeSlideRichHtml } from "../../utils/slideRichText";

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

export type SlideCanvasEditBuffers = {
  title: string;
  subtitle: string;
  content: string;
  code: string;
  language: string;
  fontSize: number;
  editorHeight: number;
  /**
   * HTML del bloque descripción (`markdown`). `undefined` = conservar el payload;
   * `null` o `""` tras trim = quitar texto enriquecido.
   */
  contentRichHtml?: string | null;
  /** Escala del bloque descripción (solo con `richHtml`). */
  contentBodyFontScale?: number;
};

/**
 * Aplica buffers de edición a los payloads del lienzo y sincroniza la raíz del slide.
 */
export function applyEditBuffersToSlide(
  base: Slide,
  buffers: SlideCanvasEditBuffers,
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
    const root = textPayloadForElementKind(slide, el.kind);
    const prev = el.payload;
    const merged: SlideCanvasTextPayload = isSlideCanvasTextPayload(prev)
      ? { ...root, ...prev, markdown }
      : { ...root, markdown };
    const next: SlideCanvasTextPayload = { ...merged };

    if (isBodyKind(el.kind) && el.kind === "markdown") {
      if (buffers.contentRichHtml !== undefined) {
        const raw = buffers.contentRichHtml?.trim() ?? "";
        if (raw) {
          next.richHtml = sanitizeSlideRichHtml(raw);
        } else {
          delete next.richHtml;
          delete next.bodyFontScale;
        }
      }
      if (buffers.contentBodyFontScale !== undefined && next.richHtml?.trim()) {
        const s = buffers.contentBodyFontScale;
        next.bodyFontScale = Math.min(
          2.5,
          Math.max(0.5, Number.isFinite(s) ? s : 1),
        );
      }
    }
    if (el.kind !== "markdown") {
      delete next.richHtml;
      delete next.bodyFontScale;
    }

    scene = patchElementPayload(scene, id, next);
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

/** Sustituye el markdown del primer bloque `markdown` y elimina HTML enriquecido (p. ej. tras IA). */
export function replaceFirstMarkdownCanvasBody(
  slide: Slide,
  markdown: string,
): Slide {
  const ensured = ensureSlideCanvasScene(slide);
  if (!ensured.canvasScene) return { ...slide, content: markdown };
  const sorted = [...ensured.canvasScene.elements].sort(
    compareCanvasElementsByZThenId,
  );
  const el = sorted.find((e) => e.kind === "markdown");
  if (!el) return { ...slide, content: markdown };
  const p = el.payload;
  const nextPayload: SlideCanvasTextPayload = isSlideCanvasTextPayload(p)
    ? {
        ...p,
        markdown,
        richHtml: undefined,
        bodyFontScale: undefined,
      }
    : { ...textPayloadForElementKind(slide, el.kind), markdown };
  const scene = patchElementPayload(ensured.canvasScene, el.id, nextPayload);
  return syncSlideRootFromCanvas({ ...ensured, canvasScene: scene });
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
