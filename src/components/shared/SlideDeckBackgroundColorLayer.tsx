import { cn } from "../../utils/cn";
import type { Slide } from "../../types";
import { slideTypeUsesSlideDeckBackgroundImage } from "../../domain/entities/slideInspectorSections";

export interface SlideDeckBackgroundColorLayerProps {
  slide: Slide;
  className?: string;
}

/**
 * Tinte de color opcional de la diapositiva, encima del tema del deck y debajo de la imagen de fondo.
 */
export function SlideDeckBackgroundColorLayer({ slide, className }: SlideDeckBackgroundColorLayerProps) {
  const raw = slide.slideBackgroundColor?.trim();
  if (!raw || !slideTypeUsesSlideDeckBackgroundImage(slide.type)) return null;
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 z-0", className)}
      style={{ backgroundColor: raw }}
      aria-hidden
    />
  );
}
