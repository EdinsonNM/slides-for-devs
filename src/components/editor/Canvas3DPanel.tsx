import { useCallback, useEffect, useState } from "react";
import { usePresentation } from "@/presentation/contexts/PresentationContext";
import { cn } from "../../utils/cn";
import { Canvas3DViewport } from "../shared/Canvas3DViewport";
import { Canvas3dModelSourceActions } from "./Canvas3dModelSourceActions";
import type { Presenter3dViewState } from "../../utils/presenter3dView";
import type { Slide } from "../../types";

export interface Canvas3DPanelProps {
  embeddedInCanvas?: boolean;
  canvasPanelSlide?: Slide;
  /** Id del bloque `mediaPanel` en el lienzo (si hay varios paneles). */
  canvasMediaElementId?: string;
  /** Lienzo: fuerza re-medición del host WebGL (p. ej. tras cambiar orden z). */
  hostMeasureKey?: string;
  /**
   * Apilado en el lienzo: re-sincro del viewport 3D al reordenar (no remontar el `Canvas` completo).
   * @default 0
   */
  stackRevision?: number;
  /** Lienzo: notificar nombres de clips del GLB cargado en el visor. */
  onCanvas3dAnimationClipNames?: (
    mediaPanelElementId: string,
    names: string[],
  ) => void;
  /**
   * Lienzo: con `false`, no monta WebGL: muestra una imagen (última captura) y libera el
   * contexto. Con `true`, el visor 3D en vivo. El panel de la derecha del deck usa `true`.
   * @default true
   */
  r3fUseLiveWebgl?: boolean;
}

export function Canvas3DPanel({
  embeddedInCanvas = false,
  canvasPanelSlide,
  canvasMediaElementId,
  hostMeasureKey,
  stackRevision = 0,
  onCanvas3dAnimationClipNames,
  r3fUseLiveWebgl = true,
}: Canvas3DPanelProps = {}) {
  const {
    currentSlide,
    setCurrentSlideCanvas3dViewState,
    isPreviewMode,
  } = usePresentation();
  const slide = canvasPanelSlide ?? currentSlide;
  const glbUrl = slide?.canvas3dGlbUrl;

  const handleViewCommit = useCallback(
    (s: Presenter3dViewState) => {
      setCurrentSlideCanvas3dViewState(s, canvasMediaElementId);
    },
    [canvasMediaElementId, setCurrentSlideCanvas3dViewState],
  );

  const [animationClipNames, setAnimationClipNames] = useState<string[]>([]);
  const handleAnimationClipNames = useCallback(
    (names: string[]) => {
      setAnimationClipNames(names);
      if (canvasMediaElementId) {
        onCanvas3dAnimationClipNames?.(canvasMediaElementId, names);
      }
    },
    [canvasMediaElementId, onCanvas3dAnimationClipNames],
  );

  useEffect(() => {
    setAnimationClipNames([]);
  }, [glbUrl]);

  const [throttledFrameSnapshot, setThrottledFrameSnapshot] = useState<
    string | null
  >(null);

  useEffect(() => {
    setThrottledFrameSnapshot(null);
  }, [glbUrl]);

  const setThrottledFrameSnapshotRef = useCallback(
    (s: string) => {
      setThrottledFrameSnapshot(s);
    },
    [],
  );

  if (!currentSlide || !slide) return null;

  if (!r3fUseLiveWebgl) {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          className={cn(
            "relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden bg-transparent",
            embeddedInCanvas ? "p-0" : "p-2",
          )}
        >
          {throttledFrameSnapshot != null ? (
            <img
              src={throttledFrameSnapshot}
              alt=""
              className="h-full w-full min-h-0 min-w-0 object-contain"
            />
          ) : (
            <p className="px-3 text-center text-xs text-stone-500 dark:text-stone-400">
              {glbUrl?.trim()
                ? "Selecciona el bloque 3D en el lienzo para ver e interactuar con el modelo en vivo"
                : "Añade un .glb para ver el visor 3D"}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        className={cn(
          "relative flex min-h-0 flex-1 flex-col bg-transparent",
          embeddedInCanvas ? "p-0" : "p-2",
        )}
      >
        {!embeddedInCanvas ? (
          <Canvas3dModelSourceActions
            httpGlbUrl={glbUrl?.startsWith("http") ? glbUrl : ""}
            slideId={slide.id}
            glbUrl={slide.canvas3dGlbUrl}
            viewState={slide.canvas3dViewState}
            modelTransform={slide.canvas3dModelTransform}
            canvasMediaElementId={canvasMediaElementId}
            animationClipNames={animationClipNames}
            animationClipValue={slide.canvas3dAnimationClipName}
          />
        ) : null}
        <Canvas3DViewport
          slideId={slide.id}
          glbUrl={glbUrl}
          viewState={slide.canvas3dViewState}
          modelTransform={slide.canvas3dModelTransform}
          animationClipName={slide.canvas3dAnimationClipName}
          onAnimationClipNames={handleAnimationClipNames}
          onViewStateCommit={handleViewCommit}
          showInteractionHint={!embeddedInCanvas}
          r3fInstanceId={canvasMediaElementId}
          hostMeasureKey={hostMeasureKey}
          stackRevision={stackRevision}
          onThrottledFrameSnapshot={
            embeddedInCanvas && r3fUseLiveWebgl && !isPreviewMode
              ? setThrottledFrameSnapshotRef
              : undefined
          }
          className={cn("min-h-0 flex-1", embeddedInCanvas ? "" : "rounded-xl")}
        />
      </div>
    </div>
  );
}
