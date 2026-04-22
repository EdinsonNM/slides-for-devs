import { motion } from "motion/react";
import { cn } from "../../utils/cn";
import type { Slide } from "../../types";
import {
  DEFAULT_DECK_VISUAL_THEME,
  type DeckVisualTheme,
  SLIDE_TYPE,
} from "../../domain/entities";
import { SlideCanvasView } from "../canvas/SlideCanvasView";
import {
  PANEL_CONTENT_KIND,
  resolveMediaPanelDescriptor,
} from "../../domain/panelContent";
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
  /**
   * Sin animación de entrada (p. ej. captura offscreen para PPTX): evita fotogramas con opacidad 0.
   */
  disableEntryMotion?: boolean;
  /** Ancho completo del contenedor (p. ej. export PPTX offscreen sin tope `max-w-7xl`). */
  fillExportContainer?: boolean;
  /**
   * Marco fijo para captura PPTX: oculta «Sección n» y evita `aspect-video` para que el lienzo
   * llene el contenedor (los diagramas isométricos en SVG no queden con alto 0).
   */
  pptxExportFrame?: boolean;
  /**
   * Oculta la etiqueta exterior «Sección n» (cromo del presentador/vista previa, no del slide).
   * Útil en miniaturas del home u otros embeds donde solo debe verse el lienzo 16:9.
   */
  hideSectionLabel?: boolean;
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
  disableEntryMotion = false,
  fillExportContainer = false,
  pptxExportFrame = false,
  hideSectionLabel = false,
}: PreviewSlideContentProps) {
  const ctx = usePresentationOptional();
  const deckVisualTheme =
    deckProp ?? ctx?.deckVisualTheme ?? DEFAULT_DECK_VISUAL_THEME;
  const toneClass = deckSlideContentWrapperClass(deckVisualTheme.contentTone);
  const sectionLabelClass = deckSectionLabelClass(deckVisualTheme.contentTone);
  const isFullscreen = layout === "fullscreen";
  const isIsometricSlide = slide.type === SLIDE_TYPE.ISOMETRIC;
  const hideDeckBackdropBehindCanvas =
    isIsometricSlide ||
    slide.type === SLIDE_TYPE.MIND_MAP ||
    slide.type === SLIDE_TYPE.MAPS;
  const isDataMotionRingSlide =
    slide.type === SLIDE_TYPE.CONTENT &&
    resolveMediaPanelDescriptor(slide).kind === PANEL_CONTENT_KIND.DATA_MOTION_RING;
  const previewSlideOverflowClass = isDataMotionRingSlide
    ? "overflow-visible"
    : "overflow-hidden";

  const outerClass = cn(
    "preview-slide-outer flex min-h-0 w-full flex-1 flex-col",
    isFullscreen
      ? "max-w-none min-h-0 items-center justify-center gap-0 overflow-hidden bg-black"
      : fillExportContainer
        ? cn("max-w-none min-w-0 gap-1", previewSlideOverflowClass)
        : cn("max-w-7xl gap-1 2xl:max-w-[1600px]", previewSlideOverflowClass),
    toneClass,
  );

  if (disableEntryMotion) {
    return (
      <div key={slide.id} className={outerClass}>
        {!isFullscreen && !pptxExportFrame && !hideSectionLabel && (
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
            "preview-slide relative flex min-h-0 min-w-0 flex-col bg-transparent",
            previewSlideOverflowClass,
            isFullscreen
              ? "aspect-video h-auto w-[min(100dvw,calc(100dvh*16/9))] max-h-[100dvh] max-w-[100dvw] shrink-0"
              : pptxExportFrame
                ? "h-full w-full min-h-0 flex-1"
                : "aspect-video max-h-full flex-1",
            slide.type === SLIDE_TYPE.CHAPTER ? "items-stretch justify-stretch" : "",
            (isIsometricSlide || slide.type === SLIDE_TYPE.MAPS) &&
              "bg-slate-50 dark:bg-slate-950",
          )}
        >
          {!hideDeckBackdropBehindCanvas && (
            <DeckBackdrop theme={deckVisualTheme} />
          )}
          <SlideCanvasView
            slide={slide}
            className="relative z-[1] min-h-0 flex-1"
            deckContentTone={deckVisualTheme.contentTone}
          />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      key={slide.id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={cn(
        outerClass,
        /* El translateX de la entrada no debe aplanar el subárbol 3D del aro. */
        isDataMotionRingSlide && "[transform-style:preserve-3d]",
      )}
    >
      {!isFullscreen && !pptxExportFrame && !hideSectionLabel && (
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
          "preview-slide relative flex min-h-0 min-w-0 flex-col bg-transparent",
          previewSlideOverflowClass,
          isFullscreen
            ? "aspect-video h-auto w-[min(100dvw,calc(100dvh*16/9))] max-h-[100dvh] max-w-[100dvw] shrink-0"
            : "aspect-video max-h-full flex-1",
          slide.type === SLIDE_TYPE.CHAPTER ? "items-stretch justify-stretch" : "",
          (isIsometricSlide || slide.type === SLIDE_TYPE.MAPS) &&
            "bg-slate-50 dark:bg-slate-950",
        )}
      >
        {!hideDeckBackdropBehindCanvas && (
          <DeckBackdrop theme={deckVisualTheme} />
        )}
        <SlideCanvasView
          slide={slide}
          className="relative z-[1] min-h-0 flex-1"
          deckContentTone={deckVisualTheme.contentTone}
        />
      </div>
    </motion.div>
  );
}
