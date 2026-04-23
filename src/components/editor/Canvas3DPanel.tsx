import { useCallback, useEffect, useState } from "react";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";
import { Canvas3DViewport } from "../shared/Canvas3DViewport";
import { Canvas3dModelSourceActions } from "./Canvas3dModelSourceActions";
import type { Presenter3dViewState } from "../../utils/presenter3dView";
import type { Slide } from "../../types";

const CANVAS_MEDIA_BOUNDS_MARGIN = 1.08;

export interface Canvas3DPanelProps {
  embeddedInCanvas?: boolean;
  canvasPanelSlide?: Slide;
  /** Id del bloque `mediaPanel` en el lienzo (si hay varios paneles). */
  canvasMediaElementId?: string;
  /** Lienzo: fuerza re-medición del host WebGL (p. ej. tras cambiar orden z). */
  hostMeasureKey?: string;
  /** Lienzo: notificar nombres de clips del GLB cargado en el visor. */
  onCanvas3dAnimationClipNames?: (
    mediaPanelElementId: string,
    names: string[],
  ) => void;
}

export function Canvas3DPanel({
  embeddedInCanvas = false,
  canvasPanelSlide,
  canvasMediaElementId,
  hostMeasureKey,
  onCanvas3dAnimationClipNames,
}: Canvas3DPanelProps = {}) {
  const {
    currentSlide,
    setCurrentSlideCanvas3dViewState,
  } = usePresentation();

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

  if (!currentSlide) return null;

  const slide = canvasPanelSlide ?? currentSlide;
  const glbUrl = slide.canvas3dGlbUrl;

  useEffect(() => {
    setAnimationClipNames([]);
  }, [glbUrl]);

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
          boundsMargin={
            embeddedInCanvas ? CANVAS_MEDIA_BOUNDS_MARGIN : undefined
          }
          className={cn("min-h-0 flex-1", embeddedInCanvas ? "" : "rounded-xl")}
        />
      </div>
    </div>
  );
}
