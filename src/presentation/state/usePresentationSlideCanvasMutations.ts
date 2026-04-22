import { useCallback } from "react";
import { useLatestRef } from "./useLatestRef";
import {
  SLIDE_TYPE,
  createEmptySlideMatrixData,
  normalizeSlideMatrixData,
  type SlideCanvasElementKind,
  type SlideCanvasScene,
  type SlideCodeEditorTheme,
  type SlideMatrixData,
} from "../../domain/entities";
import { ensureSlideCanvasScene } from "../../domain/slideCanvas/ensureSlideCanvasScene";
import {
  patchSlideMediaPanelByElementId,
} from "../../domain/slideCanvas/slideCanvasApplyEditBuffers";
import {
  patchElementPayload,
  readMediaPayloadFromElement,
} from "../../domain/slideCanvas/slideCanvasPayload";
import { syncSlideRootFromCanvas } from "../../domain/slideCanvas/syncSlideRootFromCanvas";
import {
  appendCanvasElementToScene,
  type AppendCanvasElementOptions,
} from "../../domain/slideCanvas/insertCanvasElement";
import { readPersistedCodeEditorTheme } from "../../hooks/useCodeEditorTheme";
import { DEFAULT_DEVICE_3D_ID } from "../../constants/device3d";
import {
  createDefaultDataMotionRingState,
  type DataMotionRingState,
} from "../../domain/dataMotionRing/dataMotionRingModel";
import {
  PANEL_CONTENT_KIND,
  normalizePanelContentKind,
  resolveMediaPanelDescriptor,
  Canvas3dMediaPanelDescriptor,
} from "../../domain/panelContent";
import type { Slide } from "../../types";
import type { Presenter3dViewState } from "../../utils/presenter3dView";
import type { PresentationSlideCanvasMutationsDeps } from "./presentationSlideCanvasMutationsDeps";

export function usePresentationSlideCanvasMutations(
  deps: PresentationSlideCanvasMutationsDeps,
) {
  const depsRef = useLatestRef(deps);

  const patchCurrentSlideMatrix = useCallback(
    (updater: (prev: SlideMatrixData) => SlideMatrixData) => {
      const d = depsRef.current;
      d.setSlides((prev) => {
        const idx = d.currentIndexRef.current;
        const cur = prev[idx];
        if (!cur || cur.type !== SLIDE_TYPE.MATRIX) return prev;
        const raw = cur.matrixData ?? createEmptySlideMatrixData();
        const nextMatrix = normalizeSlideMatrixData(updater(raw));
        const out = [...prev];
        out[idx] = { ...cur, matrixData: nextMatrix };
        return out;
      });
    },
    [],
  );

  const patchCurrentSlideCanvasScene = useCallback(
    (updater: (scene: SlideCanvasScene) => SlideCanvasScene) => {
      const d = depsRef.current;
      d.setSlides((prev) => {
        const idx = d.currentIndexRef.current;
        const cur = prev[idx];
        if (!cur?.canvasScene) return prev;
        const nextScene = updater(cur.canvasScene);
        const out = [...prev];
        out[idx] = syncSlideRootFromCanvas({
          ...cur,
          canvasScene: nextScene,
        });
        return out;
      });
    },
    [],
  );

  const cycleCodeEditorThemeForMediaPanel = useCallback((elementId: string) => {
    const d = depsRef.current;
    d.setSlides((prev) => {
      const idx = d.currentIndexRef.current;
      const cur = prev[idx];
      if (!cur?.canvasScene || cur.type !== SLIDE_TYPE.CONTENT) return prev;
      const el = cur.canvasScene.elements.find((e) => e.id === elementId);
      if (!el || el.kind !== "mediaPanel") return prev;
      const media = readMediaPayloadFromElement(cur, el);
      const persisted = readPersistedCodeEditorTheme();
      const effective: SlideCodeEditorTheme =
        media.codeEditorTheme ?? persisted;
      const flipped: SlideCodeEditorTheme =
        effective === "dark" ? "light" : "dark";
      const nextMedia = { ...media, codeEditorTheme: flipped };
      const scene = patchElementPayload(cur.canvasScene, elementId, nextMedia);
      const out = [...prev];
      out[idx] = syncSlideRootFromCanvas({ ...cur, canvasScene: scene });
      return out;
    });
  }, []);

  const addCanvasElementToCurrentSlide = useCallback(
    (
      kind: SlideCanvasElementKind,
      options?: AppendCanvasElementOptions,
    ) => {
      const d = depsRef.current;
      let newMediaPanelId: string | null = null;
      d.setSlides((prev) => {
        const idx = d.currentIndexRef.current;
        const raw = prev[idx];
        if (!raw) return prev;
        const cur = ensureSlideCanvasScene(raw);
        const scene = cur.canvasScene;
        if (!scene) return prev;
        const appended = appendCanvasElementToScene(
          cur,
          scene.elements,
          kind,
          options,
        );
        if (!appended) return prev;
        const { elements: nextElements, created } = appended;
        if (created.kind === "mediaPanel") {
          newMediaPanelId = created.id;
        }
        const nextSlide = syncSlideRootFromCanvas({
          ...cur,
          canvasScene: { ...scene, elements: nextElements },
        });
        const out = [...prev];
        out[idx] = nextSlide;
        return out;
      });
      if (newMediaPanelId != null) {
        window.setTimeout(() => {
          d.setCanvasMediaPanelEditTarget(newMediaPanelId, {
            rehydrateCodeBuffers: true,
          });
        }, 0);
      }
    },
    [],
  );

  const setCurrentSlideExcalidrawData = useCallback((data: string) => {
    const d = depsRef.current;
    const idx = d.currentIndexRef.current;
    const slide = d.slidesRef.current[idx];
    if (!slide || slide.type !== SLIDE_TYPE.DIAGRAM) return;
    d.setSlides((prev) => {
      const cur = prev[idx];
      if (!cur || cur.type !== SLIDE_TYPE.DIAGRAM) return prev;
      const updated = [...prev];
      updated[idx] = { ...cur, excalidrawData: data };
      return updated;
    });
  }, []);

  const setCurrentSlideIsometricFlowData = useCallback((data: string) => {
    const d = depsRef.current;
    const idx = d.currentIndexRef.current;
    const slide = d.slidesRef.current[idx];
    if (!slide || slide.type !== SLIDE_TYPE.ISOMETRIC) return;
    d.setSlides((prev) => {
      const cur = prev[idx];
      if (!cur || cur.type !== SLIDE_TYPE.ISOMETRIC) return prev;
      const updated = [...prev];
      updated[idx] = { ...cur, isometricFlowData: data };
      return updated;
    });
  }, []);

  const setCurrentSlideMindMapData = useCallback((data: string) => {
    const d = depsRef.current;
    const idx = d.currentIndexRef.current;
    const slide = d.slidesRef.current[idx];
    if (!slide || slide.type !== SLIDE_TYPE.MIND_MAP) return;
    d.setSlides((prev) => {
      const cur = prev[idx];
      if (!cur || cur.type !== SLIDE_TYPE.MIND_MAP) return prev;
      const updated = [...prev];
      updated[idx] = { ...cur, mindMapData: data };
      return updated;
    });
  }, []);

  const setCurrentSlideMapData = useCallback((data: string) => {
    const d = depsRef.current;
    const idx = d.currentIndexRef.current;
    const slide = d.slidesRef.current[idx];
    if (!slide || slide.type !== SLIDE_TYPE.MAPS) return;
    d.setSlides((prev) => {
      const cur = prev[idx];
      if (!cur || cur.type !== SLIDE_TYPE.MAPS) return prev;
      const updated = [...prev];
      updated[idx] = { ...cur, mapData: data };
      return updated;
    });
  }, []);

  const setCurrentSlideContentLayout = useCallback(
    (contentLayout: "split" | "full" | "panel-full") => {
      const d = depsRef.current;
      const idx = d.currentIndexRef.current;
      d.setSlides((prev) => {
        const slide = prev[idx];
        if (!slide || slide.type !== SLIDE_TYPE.CONTENT) return prev;
        if (slide.contentLayout === contentLayout) return prev;
        const updated = [...prev];
        const next: Slide = { ...slide, contentLayout };
        delete (next as Slide).canvasScene;
        updated[idx] = next;
        return updated;
      });
    },
    [],
  );

  const setCurrentSlideContentType = useCallback(
    (contentType: NonNullable<Slide["contentType"]>) => {
      const d = depsRef.current;
      const idx = d.currentIndexRef.current;
      const slideNow = d.slidesRef.current[idx];
      if (!slideNow || slideNow.type !== SLIDE_TYPE.CONTENT) return;
      if (slideNow.contentType === contentType) return;
      d.setSlides((prev) => {
        const updated = [...prev];
        const cur = updated[idx];
        if (!cur) return prev;
        let next = patchSlideMediaPanelByElementId(
          cur,
          d.canvasTextTargetsRef.current.mediaPanelElementId,
          (m) => {
            const o: typeof m = { ...m, contentType };
            if (normalizePanelContentKind(contentType) !== PANEL_CONTENT_KIND.RIVE) {
              delete (o as { riveUrl?: string }).riveUrl;
              delete (o as { riveStateMachineNames?: string }).riveStateMachineNames;
              delete (o as { riveArtboard?: string }).riveArtboard;
            }
            if (normalizePanelContentKind(contentType) !== PANEL_CONTENT_KIND.IFRAME_EMBED) {
              delete (o as { iframeEmbedUrl?: string }).iframeEmbedUrl;
            }
            if (normalizePanelContentKind(contentType) !== PANEL_CONTENT_KIND.DATA_MOTION_RING) {
              delete (o as { dataMotionRing?: unknown }).dataMotionRing;
            }
            return o;
          },
        );
        if (contentType === PANEL_CONTENT_KIND.PRESENTER_3D) {
          next = patchSlideMediaPanelByElementId(
            next,
            d.canvasTextTargetsRef.current.mediaPanelElementId,
            (m) => ({
              ...m,
              presenter3dDeviceId: m.presenter3dDeviceId ?? DEFAULT_DEVICE_3D_ID,
              presenter3dScreenMedia: m.presenter3dScreenMedia ?? "image",
            }),
          );
        }
        if (contentType === PANEL_CONTENT_KIND.DATA_MOTION_RING) {
          next = patchSlideMediaPanelByElementId(
            next,
            d.canvasTextTargetsRef.current.mediaPanelElementId,
            (m) => ({
              ...m,
              dataMotionRing: m.dataMotionRing ?? createDefaultDataMotionRingState(),
            }),
          );
        }
        updated[idx] = next;
        return updated;
      });
    },
    [],
  );

  const setCurrentSlideDataMotionRing = useCallback(
    (dataMotionRing: DataMotionRingState) => {
      const d = depsRef.current;
      const idx = d.currentIndexRef.current;
      const slide = d.slidesRef.current[idx];
      if (
        !slide ||
        (slide.type !== SLIDE_TYPE.CONTENT && slide.type !== SLIDE_TYPE.CHAPTER)
      ) {
        return;
      }
      d.setSlides((prev) => {
        const updated = [...prev];
        const cur = updated[idx];
        if (!cur) return prev;
        updated[idx] = patchSlideMediaPanelByElementId(
          cur,
          d.canvasTextTargetsRef.current.mediaPanelElementId,
          (m) => ({
            ...m,
            contentType: PANEL_CONTENT_KIND.DATA_MOTION_RING,
            dataMotionRing,
          }),
        );
        return updated;
      });
    },
    [],
  );

  const setCurrentSlidePresenter3dDeviceId = useCallback(
    (
      presenter3dDeviceId: string,
      explicitMediaPanelElementId?: string | null,
    ) => {
      const d = depsRef.current;
      const cur = d.slidesRef.current[d.currentIndexRef.current];
      if (!cur || cur.type !== SLIDE_TYPE.CONTENT) return;
      const targetId = d.resolvePresenter3dMediaPatchElementId(
        cur,
        explicitMediaPanelElementId,
      );
      if (!targetId) return;
      d.setSlides((prev) => {
        const updated = [...prev];
        const idx = d.currentIndexRef.current;
        const slide = updated[idx];
        if (!slide) return prev;
        updated[idx] = patchSlideMediaPanelByElementId(
          slide,
          targetId,
          (m) => ({ ...m, presenter3dDeviceId }),
        );
        return updated;
      });
    },
    [],
  );

  const setCurrentSlidePresenter3dScreenMedia = useCallback(
    (
      presenter3dScreenMedia: "image" | "video",
      explicitMediaPanelElementId?: string | null,
    ) => {
      const d = depsRef.current;
      const cur = d.slidesRef.current[d.currentIndexRef.current];
      if (!cur || cur.type !== SLIDE_TYPE.CONTENT) return;
      const targetId = d.resolvePresenter3dMediaPatchElementId(
        cur,
        explicitMediaPanelElementId,
      );
      if (!targetId) return;
      d.setSlides((prev) => {
        const updated = [...prev];
        const idx = d.currentIndexRef.current;
        const slide = updated[idx];
        if (!slide) return prev;
        updated[idx] = patchSlideMediaPanelByElementId(
          slide,
          targetId,
          (m) => ({ ...m, presenter3dScreenMedia }),
        );
        return updated;
      });
    },
    [],
  );

  const setCurrentSlidePresenter3dViewState = useCallback(
    (
      presenter3dViewState: Presenter3dViewState,
      explicitMediaPanelElementId?: string | null,
    ) => {
      const d = depsRef.current;
      const cur = d.slidesRef.current[d.currentIndexRef.current];
      if (!cur || cur.type !== SLIDE_TYPE.CONTENT) return;
      const targetId = d.resolvePresenter3dMediaPatchElementId(
        cur,
        explicitMediaPanelElementId,
      );
      if (!targetId) return;
      d.setSlides((prev) => {
        const updated = [...prev];
        const idx = d.currentIndexRef.current;
        const slide = updated[idx];
        if (!slide) return prev;
        updated[idx] = patchSlideMediaPanelByElementId(
          slide,
          targetId,
          (m) => ({ ...m, presenter3dViewState }),
        );
        return updated;
      });
    },
    [],
  );

  const setCurrentSlideCanvas3dGlbUrl = useCallback((canvas3dGlbUrl: string) => {
    const d = depsRef.current;
    const idx = d.currentIndexRef.current;
    const slide = d.slidesRef.current[idx];
    if (!slide || slide.type !== SLIDE_TYPE.CONTENT) return;
    if (
      !(resolveMediaPanelDescriptor(slide) instanceof Canvas3dMediaPanelDescriptor)
    ) {
      return;
    }
    d.setSlides((prev) => {
      const updated = [...prev];
      const cur = updated[idx];
      if (!cur) return prev;
      const trimmed = canvas3dGlbUrl.trim();
      updated[idx] = patchSlideMediaPanelByElementId(
        cur,
        d.canvasTextTargetsRef.current.mediaPanelElementId,
        (m) => ({
          ...m,
          canvas3dGlbUrl: trimmed || undefined,
          canvas3dViewState: undefined,
        }),
      );
      return updated;
    });
  }, []);

  const setCurrentSlideCanvas3dViewState = useCallback(
    (canvas3dViewState: Presenter3dViewState) => {
      const d = depsRef.current;
      const idx = d.currentIndexRef.current;
      const slide = d.slidesRef.current[idx];
      if (!slide || slide.type !== SLIDE_TYPE.CONTENT) return;
      if (
        !(resolveMediaPanelDescriptor(slide) instanceof Canvas3dMediaPanelDescriptor)
      ) {
        return;
      }
      d.setSlides((prev) => {
        const updated = [...prev];
        const cur = updated[idx];
        if (!cur) return prev;
        updated[idx] = patchSlideMediaPanelByElementId(
          cur,
          d.canvasTextTargetsRef.current.mediaPanelElementId,
          (m) => ({ ...m, canvas3dViewState }),
        );
        return updated;
      });
    },
    [],
  );

  const clearCurrentSlideCanvas3dViewState = useCallback(() => {
    const d = depsRef.current;
    const idx = d.currentIndexRef.current;
    const slide = d.slidesRef.current[idx];
    if (!slide || slide.type !== SLIDE_TYPE.CONTENT) return;
    if (
      !(resolveMediaPanelDescriptor(slide) instanceof Canvas3dMediaPanelDescriptor)
    ) {
      return;
    }
    d.setSlides((prev) => {
      const updated = [...prev];
      const cur = updated[idx];
      if (!cur) return prev;
      updated[idx] = patchSlideMediaPanelByElementId(
        cur,
        d.canvasTextTargetsRef.current.mediaPanelElementId,
        (m) => ({ ...m, canvas3dViewState: undefined }),
      );
      return updated;
    });
  }, []);

  return {
    patchCurrentSlideMatrix,
    patchCurrentSlideCanvasScene,
    cycleCodeEditorThemeForMediaPanel,
    addCanvasElementToCurrentSlide,
    setCurrentSlideExcalidrawData,
    setCurrentSlideIsometricFlowData,
    setCurrentSlideMindMapData,
    setCurrentSlideMapData,
    setCurrentSlideContentLayout,
    setCurrentSlideContentType,
    setCurrentSlidePresenter3dDeviceId,
    setCurrentSlidePresenter3dScreenMedia,
    setCurrentSlidePresenter3dViewState,
    setCurrentSlideCanvas3dGlbUrl,
    setCurrentSlideCanvas3dViewState,
    clearCurrentSlideCanvas3dViewState,
    setCurrentSlideDataMotionRing,
  };
}
