import { useCallback } from "react";
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
}

export function Canvas3DPanel({
  embeddedInCanvas = false,
  canvasPanelSlide,
}: Canvas3DPanelProps = {}) {
  const {
    currentSlide,
    setCurrentSlideCanvas3dViewState,
  } = usePresentation();

  const handleViewCommit = useCallback(
    (s: Presenter3dViewState) => {
      setCurrentSlideCanvas3dViewState(s);
    },
    [setCurrentSlideCanvas3dViewState],
  );

  if (!currentSlide) return null;

  const slide = canvasPanelSlide ?? currentSlide;
  const glbUrl = slide.canvas3dGlbUrl;

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
          />
        ) : null}
        <Canvas3DViewport
          slideId={currentSlide.id}
          glbUrl={glbUrl}
          viewState={slide.canvas3dViewState}
          onViewStateCommit={handleViewCommit}
          showInteractionHint={!embeddedInCanvas}
          boundsMargin={
            embeddedInCanvas ? CANVAS_MEDIA_BOUNDS_MARGIN : undefined
          }
          className={cn("min-h-0 flex-1", embeddedInCanvas ? "" : "rounded-xl")}
        />
      </div>
    </div>
  );
}
