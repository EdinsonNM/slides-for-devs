import { usePresentation } from "@/presentation/contexts/PresentationContext";
import { useMinWidthLg } from "@/presentation/hooks/global/useMatchMedia";
import { cn } from "../../utils/cn";
import type { Slide } from "../../types";
import { SlideWebcamView } from "../shared/SlideWebcamView";
import {
  normalizeWebcamPanelState,
} from "../../domain/webcam/webcamPanelModel";

export interface WebcamPanelProps {
  canvasPanelSlide?: Slide;
}

/**
 * Panel de cámara en el área de media: vista previa en directo con máscara y espejo del slide.
 */
export function WebcamPanel({ canvasPanelSlide }: WebcamPanelProps = {}) {
  const { currentSlide } = usePresentation();
  const isLgUp = useMinWidthLg();

  if (!currentSlide) return null;
  const slide = canvasPanelSlide ?? currentSlide;
  const state = normalizeWebcamPanelState(slide.webcam);

  return (
    <div
      className={cn(
        "relative flex min-h-0 w-full flex-1 flex-col overflow-hidden",
        isLgUp ? "p-0" : "p-2",
      )}
    >
      <SlideWebcamView state={state} className="h-full min-h-0" />
    </div>
  );
}
