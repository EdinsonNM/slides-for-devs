import type { Slide } from "../../types";
import { cn } from "../../utils/cn";
import {
  normalizeDataMotionRingState,
} from "../../domain/dataMotionRing/dataMotionRingModel";
import { DataMotionRingExperience } from "../shared/DataMotionRingExperience";

export interface DataMotionRingPanelProps {
  embeddedInCanvas?: boolean;
  canvasPanelSlide?: Slide;
  currentSlide: Slide;
}

export function DataMotionRingPanel({
  embeddedInCanvas = false,
  canvasPanelSlide,
  currentSlide,
}: DataMotionRingPanelProps) {
  const slide = canvasPanelSlide ?? currentSlide;
  const state = normalizeDataMotionRingState(slide.dataMotionRing);

  return (
    <div
      className={cn(
        "relative flex min-h-0 flex-1 flex-col overflow-visible",
        embeddedInCanvas ? "p-0" : "p-2",
      )}
    >
      <DataMotionRingExperience
        state={state}
        className={cn("min-h-0 flex-1", embeddedInCanvas ? "" : "rounded-xl")}
      />
    </div>
  );
}
