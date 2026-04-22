import { useCallback } from "react";
import { useLatestRef } from "./useLatestRef";
import {
  SLIDE_TYPE,
  createEmptySlideMatrixData,
  normalizeSlideMatrixData,
  type SlideType,
} from "../../domain/entities";
import {
  createDefaultIsometricFlowDiagram,
  serializeIsometricFlowDiagram,
} from "../../domain/entities/IsometricFlowDiagram";
import {
  createDefaultSlideMapData,
  serializeSlideMapData,
} from "../../domain/entities/SlideMapData";
import {
  PANEL_CONTENT_KIND,
  PANEL_CONTENT_TOGGLE_ORDER,
  normalizePanelContentKind,
} from "../../domain/panelContent";
import { DEFAULT_DEVICE_3D_ID } from "../../constants/device3d";
import { createDefaultDataMotionRingState } from "../../domain/dataMotionRing/dataMotionRingModel";
import { patchSlideMediaPanelByElementId } from "../../domain/slideCanvas/slideCanvasApplyEditBuffers";
import { normalizeSlidesCanvasScenes } from "../../domain/slideCanvas/ensureSlideCanvasScene";
import type { Slide } from "../../types";
import type { PresentationDeckMutationsDeps } from "./presentationDeckMutationsDeps";

export function usePresentationDeckMutations(
  deps: PresentationDeckMutationsDeps,
) {
  const depsRef = useLatestRef(deps);

  const toggleContentType = useCallback(() => {
    const d = depsRef.current;
    const slideIdx = d.currentIndex;
    const slideAt = d.slides[slideIdx];
    if (!slideAt) return;
    const curKind = normalizePanelContentKind(slideAt.contentType);
    let orderIdx = PANEL_CONTENT_TOGGLE_ORDER.indexOf(curKind);
    if (orderIdx < 0) orderIdx = 0;
    const newType =
      PANEL_CONTENT_TOGGLE_ORDER[
        (orderIdx + 1) % PANEL_CONTENT_TOGGLE_ORDER.length
      ]!;

    d.setSlides((prev) => {
      const updated = [...prev];
      const cur = updated[slideIdx];
      if (!cur) return prev;
      let next = patchSlideMediaPanelByElementId(
        cur,
        d.canvasTextTargetsRef.current.mediaPanelElementId,
        (m) => {
          const o = { ...m, contentType: newType };
          if (normalizePanelContentKind(newType) !== PANEL_CONTENT_KIND.RIVE) {
            delete (o as { riveUrl?: string }).riveUrl;
            delete (o as { riveStateMachineNames?: string }).riveStateMachineNames;
            delete (o as { riveArtboard?: string }).riveArtboard;
          }
          if (normalizePanelContentKind(newType) !== PANEL_CONTENT_KIND.IFRAME_EMBED) {
            delete (o as { iframeEmbedUrl?: string }).iframeEmbedUrl;
          }
          if (normalizePanelContentKind(newType) !== PANEL_CONTENT_KIND.DATA_MOTION_RING) {
            delete (o as { dataMotionRing?: unknown }).dataMotionRing;
          }
          return o;
        },
      );
      if (newType === PANEL_CONTENT_KIND.PRESENTER_3D) {
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
      if (newType === PANEL_CONTENT_KIND.DATA_MOTION_RING) {
        next = patchSlideMediaPanelByElementId(
          next,
          d.canvasTextTargetsRef.current.mediaPanelElementId,
          (m) => ({
            ...m,
            dataMotionRing: m.dataMotionRing ?? createDefaultDataMotionRingState(),
          }),
        );
      }
      updated[slideIdx] = next;
      return updated;
    });
  }, []);

  const setCurrentSlideType = useCallback((type: SlideType) => {
    const d = depsRef.current;
    const slideIdx = d.currentIndex;
    const slideNow = d.slides[slideIdx];
    if (!slideNow || slideNow.type === type) return;
    d.setSlides((prev) => {
      const currentSlide = prev[slideIdx];
      if (!currentSlide || currentSlide.type === type) return prev;
      const updated = [...prev];
      const next: Slide = { ...currentSlide, type };
      delete (next as Slide).canvasScene;

      if (type === SLIDE_TYPE.DIAGRAM) {
        delete (next as Slide).contentType;
        delete (next as Slide).contentLayout;
        delete (next as Slide).matrixData;
        delete (next as Slide).isometricFlowData;
        if (!next.excalidrawData) next.excalidrawData = "{}";
      } else if (type === SLIDE_TYPE.ISOMETRIC) {
        delete (next as Slide).contentType;
        delete (next as Slide).contentLayout;
        delete (next as Slide).matrixData;
        delete (next as Slide).excalidrawData;
        if (!next.isometricFlowData) {
          next.isometricFlowData = serializeIsometricFlowDiagram(
            createDefaultIsometricFlowDiagram(),
          );
        }
      } else {
        delete (next as Slide).excalidrawData;
        delete (next as Slide).isometricFlowData;
      }

      if (type !== SLIDE_TYPE.MAPS) {
        delete (next as Slide).mapData;
      }

      if (type === SLIDE_TYPE.MAPS) {
        delete (next as Slide).contentType;
        delete (next as Slide).contentLayout;
        delete (next as Slide).matrixData;
        delete (next as Slide).mindMapData;
        if (!next.mapData) {
          next.mapData = serializeSlideMapData(createDefaultSlideMapData());
        }
      }

      if (type === SLIDE_TYPE.CHAPTER) {
        delete (next as Slide).contentType;
        delete (next as Slide).contentLayout;
        delete (next as Slide).matrixData;
      } else if (type === SLIDE_TYPE.MATRIX) {
        delete (next as Slide).contentType;
        delete (next as Slide).contentLayout;
        next.matrixData = normalizeSlideMatrixData(
          next.matrixData ?? createEmptySlideMatrixData(),
        );
      } else if (type === SLIDE_TYPE.CONTENT) {
        delete (next as Slide).matrixData;
        if (!next.contentType) next.contentType = PANEL_CONTENT_KIND.IMAGE;
        if (!next.contentLayout) next.contentLayout = "split";
      }

      updated[slideIdx] = next;
      return updated;
    });
  }, []);

  const deleteSlideAt = useCallback((index: number) => {
    const d = depsRef.current;
    if (index < 0 || index >= d.slides.length || d.slides.length <= 1) return;
    d.setSlides((prev) => prev.filter((_, i) => i !== index));
    d.setCurrentIndex((prev) => {
      if (prev === index) return Math.max(0, index - 1);
      if (prev > index) return prev - 1;
      return prev;
    });
  }, []);

  const insertSlideAfter = useCallback((index: number) => {
    const d = depsRef.current;
    const newSlide: Slide = {
      id: crypto.randomUUID(),
      type: SLIDE_TYPE.CONTENT,
      title: "Nueva diapositiva",
      content: "",
    };
    const next = normalizeSlidesCanvasScenes([
      ...d.slides.slice(0, index + 1),
      newSlide,
      ...d.slides.slice(index + 1),
    ]);
    d.setSlides(next);
    d.setCurrentIndex(index + 1);
    void d.savePresentationNow({
      topic: d.topic || "Sin título",
      slides: next,
      characterId: d.selectedCharacterId ?? undefined,
    });
  }, []);

  const moveSlide = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const d = depsRef.current;
    let nextDeck: Slide[] | null = null;
    d.setSlides((prev) => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex >= prev.length
      ) {
        return prev;
      }
      const copy = [...prev];
      const [item] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, item);
      nextDeck = normalizeSlidesCanvasScenes(copy);
      return nextDeck;
    });
    if (!nextDeck) return;
    d.setCurrentIndex((prev) => {
      if (prev === fromIndex) return toIndex;
      if (fromIndex < toIndex) {
        if (prev > fromIndex && prev <= toIndex) return prev - 1;
      } else if (fromIndex > toIndex) {
        if (prev >= toIndex && prev < fromIndex) return prev + 1;
      }
      return prev;
    });
    void d.savePresentationNow({
      topic: d.topic || "Sin título",
      slides: nextDeck,
      characterId: d.selectedCharacterId ?? undefined,
    });
  }, []);

  const nextSlide = useCallback(() => {
    const d = depsRef.current;
    if (d.currentIndex < d.slides.length - 1) {
      d.setCurrentIndex(d.currentIndex + 1);
    }
  }, []);

  const prevSlide = useCallback(() => {
    const d = depsRef.current;
    if (d.currentIndex > 0) {
      d.setCurrentIndex(d.currentIndex - 1);
    }
  }, []);

  return {
    toggleContentType,
    setCurrentSlideType,
    deleteSlideAt,
    insertSlideAfter,
    moveSlide,
    nextSlide,
    prevSlide,
  };
}
