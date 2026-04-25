import { SLIDE_TYPE, type Slide } from "../entities";
import {
  SLIDE_CANVAS_SCENE_VERSION,
  isSlideCanvasMediaPayload,
  type SlideCanvasElement,
  type SlideCanvasMediaPayload,
  type SlideCanvasScene,
} from "../entities/SlideCanvas";
import {
  PANEL_CONTENT_KIND,
  normalizePanelContentKind,
  type PanelContentKind,
} from "../panelContent/panelContentKind";
import {
  compareCanvasElementsByZThenId,
  mergeMediaPayloadIntoSlide,
  readMediaPayloadFromElement,
  readTextMarkdownFromElement,
} from "./slideCanvasPayload";

function sortedElements(slide: Slide): SlideCanvasElement[] {
  const els = slide.canvasScene?.elements ?? [];
  return [...els].sort(compareCanvasElementsByZThenId);
}

function firstMediaPanelContentKind(slide: Slide): PanelContentKind | null {
  const sorted = sortedElements(slide);
  const fm = sorted.find((e) => e.kind === "mediaPanel");
  if (!fm) return null;
  const p = fm.payload;
  if (!isSlideCanvasMediaPayload(p)) {
    return PANEL_CONTENT_KIND.IMAGE;
  }
  return normalizePanelContentKind(p.contentType);
}

/**
 * Si el espejo en la raíz (`contentType`) sigue siendo Presentador 3D pero el primer `mediaPanel`
 * en z ya es otro tipo, los datos (textura, dispositivo, vista) pueden seguir solo en la raíz.
 * Los copiamos al payload de **cada** bloque Presentador 3D que aún no declare esas claves,
 * antes de que `mergeMediaPayloadIntoSlide` reescriba la raíz con el nuevo primer panel.
 */
function rehydratePresenter3dPayloadsFromSlideRoot(slide: Slide): SlideCanvasScene | undefined {
  if (slide.type !== SLIDE_TYPE.CONTENT) return undefined;
  const scene = slide.canvasScene;
  if (!scene || scene.version !== SLIDE_CANVAS_SCENE_VERSION) return undefined;

  const rootsKind = normalizePanelContentKind(
    slide.contentType ?? PANEL_CONTENT_KIND.IMAGE,
  );
  const firstKind = firstMediaPanelContentKind(slide);
  if (firstKind == null) return undefined;
  if (
    rootsKind !== PANEL_CONTENT_KIND.PRESENTER_3D ||
    firstKind === PANEL_CONTENT_KIND.PRESENTER_3D
  ) {
    return undefined;
  }

  const rootDevice = slide.presenter3dDeviceId;
  const rootScreen = slide.presenter3dScreenMedia;
  const rootVs = slide.presenter3dViewState;
  const rootImg = slide.imageUrl;
  const rootVid = slide.videoUrl;

  let changed = false;
  const elements = scene.elements.map((e) => {
    if (e.kind !== "mediaPanel") return e;
    const p = e.payload;
    if (!isSlideCanvasMediaPayload(p)) return e;
    if (normalizePanelContentKind(p.contentType) !== PANEL_CONTENT_KIND.PRESENTER_3D) {
      return e;
    }

    const nextPayload: SlideCanvasMediaPayload = { ...p, type: "media" };
    let elChanged = false;

    if (
      !Object.prototype.hasOwnProperty.call(p, "presenter3dDeviceId") &&
      rootDevice != null &&
      String(rootDevice).trim() !== ""
    ) {
      nextPayload.presenter3dDeviceId = rootDevice;
      elChanged = true;
    }
    if (
      !Object.prototype.hasOwnProperty.call(p, "presenter3dScreenMedia") &&
      (rootScreen === "image" || rootScreen === "video")
    ) {
      nextPayload.presenter3dScreenMedia = rootScreen;
      elChanged = true;
    }
    if (!Object.prototype.hasOwnProperty.call(p, "presenter3dViewState") && rootVs != null) {
      nextPayload.presenter3dViewState = rootVs;
      elChanged = true;
    }

    const screen =
      (Object.prototype.hasOwnProperty.call(p, "presenter3dScreenMedia")
        ? p.presenter3dScreenMedia
        : rootScreen) ?? "image";

    if (
      screen !== "video" &&
      !Object.prototype.hasOwnProperty.call(p, "imageUrl") &&
      typeof rootImg === "string" &&
      rootImg.trim() !== ""
    ) {
      nextPayload.imageUrl = rootImg;
      elChanged = true;
    }
    if (
      screen === "video" &&
      !Object.prototype.hasOwnProperty.call(p, "videoUrl") &&
      typeof rootVid === "string" &&
      rootVid.trim() !== ""
    ) {
      nextPayload.videoUrl = rootVid;
      elChanged = true;
    }

    if (!elChanged) return e;
    changed = true;
    return { ...e, payload: nextPayload };
  });

  if (!changed) return undefined;
  return { ...scene, elements };
}

/**
 * Persiste en el `payload` del panel CANVAS_3D los datos 3D que solo estaban en la raíz del slide
 * (típico cuando ese panel era el primero en z). Evita perder el GLB al reordenar y que otro
 * `mediaPanel` pase a ser el primero.
 */
function rehydrateCanvas3dPayloadsFromSlideRoot(slide: Slide): SlideCanvasScene | undefined {
  if (slide.type !== SLIDE_TYPE.CONTENT) return undefined;
  const scene = slide.canvasScene;
  if (!scene || scene.version !== SLIDE_CANVAS_SCENE_VERSION) return undefined;

  const rootGlb = slide.canvas3dGlbUrl;
  const rootVs = slide.canvas3dViewState;
  const rootMt = slide.canvas3dModelTransform;
  const rootClip = slide.canvas3dAnimationClipName;

  let changed = false;
  const elements = scene.elements.map((e) => {
    if (e.kind !== "mediaPanel") return e;
    const p = e.payload;
    if (!isSlideCanvasMediaPayload(p)) return e;
    if (normalizePanelContentKind(p.contentType) !== PANEL_CONTENT_KIND.CANVAS_3D) {
      return e;
    }

    const nextPayload: SlideCanvasMediaPayload = { ...p, type: "media" };
    let elChanged = false;

    const ownGlb =
      Object.prototype.hasOwnProperty.call(p, "canvas3dGlbUrl") &&
      typeof (p as { canvas3dGlbUrl?: string }).canvas3dGlbUrl === "string"
        ? String((p as { canvas3dGlbUrl: string }).canvas3dGlbUrl).trim()
        : "";
    if (!ownGlb && typeof rootGlb === "string" && rootGlb.trim() !== "") {
      nextPayload.canvas3dGlbUrl = rootGlb;
      elChanged = true;
    }

    if (!Object.prototype.hasOwnProperty.call(p, "canvas3dViewState") && rootVs != null) {
      nextPayload.canvas3dViewState = rootVs;
      elChanged = true;
    }

    if (!Object.prototype.hasOwnProperty.call(p, "canvas3dModelTransform") && rootMt != null) {
      nextPayload.canvas3dModelTransform = rootMt;
      elChanged = true;
    }

    if (
      !Object.prototype.hasOwnProperty.call(p, "canvas3dAnimationClipName") &&
      typeof rootClip === "string" &&
      rootClip.trim() !== ""
    ) {
      nextPayload.canvas3dAnimationClipName = rootClip;
      elChanged = true;
    }

    if (!elChanged) return e;
    changed = true;
    return { ...e, payload: nextPayload };
  });

  if (!changed) return undefined;
  return { ...scene, elements };
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

  let slideForHydrate: Slide = slide;
  const scenePresenter = rehydratePresenter3dPayloadsFromSlideRoot(slideForHydrate);
  if (scenePresenter !== undefined) {
    slideForHydrate = { ...slideForHydrate, canvasScene: scenePresenter };
  }
  const sceneCanvas3d = rehydrateCanvas3dPayloadsFromSlideRoot(slideForHydrate);
  if (sceneCanvas3d !== undefined) {
    slideForHydrate = { ...slideForHydrate, canvasScene: sceneCanvas3d };
  }
  const slideBase: Slide =
    scenePresenter !== undefined || sceneCanvas3d !== undefined ? slideForHydrate : slide;

  const sorted = sortedElements(slideBase);
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

  let next: Slide = { ...slideBase };

  if (firstTitle) {
    next.title = readTextMarkdownFromElement(slideBase, firstTitle);
  }
  if (firstSubtitle) {
    const sub = readTextMarkdownFromElement(slideBase, firstSubtitle).trim();
    next.subtitle = sub || undefined;
  }
  if (firstBody) {
    next.content = readTextMarkdownFromElement(slideBase, firstBody);
  }
  if (firstMedia && slideBase.type === SLIDE_TYPE.CONTENT) {
    const media = readMediaPayloadFromElement(slideBase, firstMedia);
    /**
     * `mergeMediaPayloadIntoSlide` solo escribe campos definidos en `media`, así no se pisa
     * p. ej. `canvas3dGlbUrl` con `undefined` cuando el primer panel es imagen y el 3D quedó atrás.
     */
    next = mergeMediaPayloadIntoSlide(next, media);
  }

  return next;
}
