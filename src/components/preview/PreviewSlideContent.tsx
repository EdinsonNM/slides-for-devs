import { motion } from "motion/react";
import { cn } from "../../utils/cn";
import type { Slide } from "../../types";
import { SLIDE_TYPE } from "../../domain/entities";
import { SlideCanvasView } from "../canvas/SlideCanvasView";

export interface PreviewSlideContentProps {
  slide: Slide;
  formatMarkdown: (content: string) => string;
  /** Conservado por compatibilidad; el lienzo usa `canvasScene` + campos del slide. */
  imageWidthPercent: number;
  panelHeightPercent?: number;
  /** Índice 0-based para la etiqueta «Sección N». */
  slideIndex?: number;
}

/**
 * Vista previa / presentador: una sola capa de lienzo (`canvasScene`) por diapositiva.
 */
export function PreviewSlideContent({
  slide,
  formatMarkdown,
  slideIndex = 0,
}: PreviewSlideContentProps) {
  return (
    <motion.div
      key={slide.id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={cn(
        "preview-slide-outer flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-1 overflow-hidden 2xl:max-w-[1600px]",
      )}
    >
      <div className="shrink-0 self-start px-0.5 text-stone-900 dark:text-foreground">
        <span
          className="font-bold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400"
          style={{ fontSize: "var(--slide-section-out-label)" }}
        >
          Sección {slideIndex + 1}
        </span>
      </div>
      <div
        className={cn(
          "preview-slide relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white text-stone-900 dark:bg-surface-elevated dark:text-foreground",
          "aspect-video max-h-full",
          slide.type === SLIDE_TYPE.CHAPTER ? "items-stretch justify-stretch" : "",
        )}
      >
        <SlideCanvasView
          slide={slide}
          formatMarkdown={formatMarkdown}
          className="min-h-0 flex-1"
        />
      </div>
    </motion.div>
  );
}
