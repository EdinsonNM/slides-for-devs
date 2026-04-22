import { PreviewSlideContent } from "../preview/PreviewSlideContent";
import type { Slide } from "../../types";
import {
  DEFAULT_DECK_VISUAL_THEME,
  type DeckVisualTheme,
} from "../../domain/entities";
import { cn } from "../../utils/cn";

/**
 * Réplica del primer slide en tarjetas del home: misma pila que la vista previa del editor
 * (`PreviewSlideContent` → `SlideCanvasView`), no la miniatura del sidebar.
 */
export function HomeDeckSlideReplicaFill({
  slide,
  deckVisualTheme = DEFAULT_DECK_VISUAL_THEME,
  slideIndex = 0,
  className,
}: {
  slide: Slide;
  deckVisualTheme?: DeckVisualTheme;
  slideIndex?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full flex-col overflow-hidden",
        className,
      )}
    >
      <PreviewSlideContent
        slide={slide}
        slideIndex={slideIndex}
        imageWidthPercent={slide.imageWidthPercent ?? 50}
        panelHeightPercent={slide.panelHeightPercent}
        deckVisualTheme={deckVisualTheme}
        layout="default"
        disableEntryMotion
        fillExportContainer
        hideSectionLabel
      />
    </div>
  );
}
