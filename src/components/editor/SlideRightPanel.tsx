import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";
import { useMinWidthLg } from "../../hooks/useMatchMedia";
import { CodeBlock } from "./CodeBlock";
import { ImagePanel } from "./ImagePanel";
import { VideoPanel } from "./VideoPanel";
import { Presenter3DPanel } from "./Presenter3DPanel";

export interface SlideRightPanelProps {
  /** Si true, el panel ocupa todo el espacio (layout panel-full), sin borde ni resize. */
  fullWidth?: boolean;
}

export function SlideRightPanel({ fullWidth }: SlideRightPanelProps = {}) {
  const { currentSlide, imageWidthPercent, isResizing, setIsResizing } =
    usePresentation();
  const isLgUp = useMinWidthLg();

  if (!currentSlide) return null;

  return (
    <div
      className={cn(
        "bg-white dark:bg-surface flex flex-col relative group min-h-0",
        fullWidth ? "flex-1 border-0" : "border-l border-stone-200 dark:border-border"
      )}
      style={fullWidth ? undefined : { width: `${imageWidthPercent}%` }}
    >
      {!fullWidth && (
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizing(true);
          }}
          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-emerald-500/30 transition-colors z-30 flex items-center justify-center group/handle"
        >
          <div className="w-0.5 h-8 bg-stone-300 dark:bg-stone-600 group-hover/handle:bg-emerald-500 rounded-full" />
        </div>
      )}

      {currentSlide.contentType === "code" ? (
        <CodeBlock titleBarMode={isLgUp ? "minimal" : "full"} />
      ) : currentSlide.contentType === "video" ? (
        <VideoPanel />
      ) : currentSlide.contentType === "presenter3d" ? (
        <Presenter3DPanel />
      ) : (
        <ImagePanel />
      )}
    </div>
  );
}
