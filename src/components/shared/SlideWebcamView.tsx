import { useId } from "react";
import { cn } from "../../utils/cn";
import { getWebcamMaskBoxProps } from "./webcamMaskBox";
import { type WebcamPanelState } from "../../domain/webcam/webcamPanelModel";
import { WebcamPipelineView } from "../../features/webcam";

export interface SlideWebcamViewProps {
  state: WebcamPanelState;
  className?: string;
}

export function SlideWebcamView({ state, className }: SlideWebcamViewProps) {
  const labelId = useId();
  const mask = getWebcamMaskBoxProps(state.maskShape);

  return (
    <div
      className={cn(
        "flex min-h-0 w-full min-w-0 flex-1 items-center justify-center",
        className,
      )}
    >
      <p id={labelId} className="sr-only">
        Vista cámara en vivo
      </p>
      <div
        className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-col items-stretch"
        aria-labelledby={labelId}
      >
        <div className={cn("mx-auto h-full w-full min-h-0", mask.className)} style={mask.style}>
          <WebcamPipelineView state={state} mirrored={state.mirrored} className="h-full min-h-0" />
        </div>
      </div>
    </div>
  );
}
