import { motion } from "motion/react";
import { cn } from "../../utils/cn";
import type { Slide } from "../../types";
import {
  DEFAULT_DECK_VISUAL_THEME,
  type DeckVisualTheme,
  SLIDE_TYPE,
} from "../../domain/entities";
import { SlideCanvasView } from "../canvas/SlideCanvasView";
import { DeckBackdrop } from "../shared/DeckBackdrop";
import {
  deckSectionLabelClass,
  deckSlideContentWrapperClass,
} from "../../utils/deckSlideChrome";
import { usePresentationOptional } from "../../context/PresentationContext";

export interface PreviewSlideContentProps {
  slide: Slide;
  /** Conservado por compatibilidad; el lienzo usa `canvasScene` + campos del slide. */
  imageWidthPercent: number;
  panelHeightPercent?: number;
  /** Índice 0-based para la etiqueta «Sección N». */
  slideIndex?: number;
  /** Si se omite, se usa el contexto del editor (si existe). */
  deckVisualTheme?: DeckVisualTheme;
  /**
   * `fullscreen`: sin ancho máximo ni hueco exterior; escala al viewport (overlay de vista previa).
   * `default`: marco acotado para incrustar en presentador u otros contenedores.
   */
  layout?: "default" | "fullscreen";
}

/**
 * Vista previa / presentador: una sola capa de lienzo (`canvasScene`) por diapositiva.
 */
export function PreviewSlideContent({
  slide,
  slideIndex = 0,
  deckVisualTheme: deckProp,
  imageWidthPercent: _imageWidthPercent,
  panelHeightPercent: _panelHeightPercent,
  layout = "default",
}: PreviewSlideContentProps) {
  const ctx = usePresentationOptional();
  const deckVisualTheme =
    deckProp ?? ctx?.deckVisualTheme ?? DEFAULT_DECK_VISUAL_THEME;
  const toneClass = deckSlideContentWrapperClass(deckVisualTheme.contentTone);
  const sectionLabelClass = deckSectionLabelClass(deckVisualTheme.contentTone);
  const isFullscreen = layout === "fullscreen";
  const isIsometricSlide = slide.type === SLIDE_TYPE.ISOMETRIC;

  return (
    <motion.div
      key={slide.id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={cn(
        "preview-slide-outer flex min-h-0 w-full flex-1 flex-col overflow-hidden",
        isFullscreen
          ? "max-w-none min-h-0 items-center justify-center gap-0 overflow-hidden bg-black"
          : "max-w-7xl gap-1 2xl:max-w-[1600px]",
        toneClass,
      )}
    >
      {!isFullscreen && (
        <div className="shrink-0 self-start px-0.5">
          <span
            className={cn("font-bold uppercase tracking-[0.2em]", sectionLabelClass)}
            style={{ fontSize: "var(--slide-section-out-label)" }}
          >
            Sección {slideIndex + 1}
          </span>
        </div>
      )}
      <div
        className={cn(
          "preview-slide relative flex min-h-0 min-w-0 flex-col overflow-hidden bg-transparent",
          isFullscreen
            ? "aspect-video h-auto w-[min(100dvw,calc(100dvh*16/9))] max-h-[100dvh] max-w-[100dvw] shrink-0"
            : "aspect-video max-h-full flex-1",
          slide.type === SLIDE_TYPE.CHAPTER ? "items-stretch justify-stretch" : "",
          isIsometricSlide && "bg-slate-50 dark:bg-slate-950",
        )}
      >
        {!isIsometricSlide && <DeckBackdrop theme={deckVisualTheme} />}
        <SlideCanvasView
          slide={slide}
          className="relative z-[1] min-h-0 flex-1"
          deckContentTone={deckVisualTheme.contentTone}
        />
      </div>
    </motion.div>
  );
}
