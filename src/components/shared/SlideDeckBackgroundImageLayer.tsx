import { cn } from "../../utils/cn";
import type { Slide } from "../../types";
import { slideTypeUsesSlideDeckBackgroundImage } from "../../domain/entities/slideInspectorSections";

export interface SlideDeckBackgroundImageLayerProps {
  slide: Slide;
  className?: string;
}

/**
 * Imagen de fondo opcional de la diapositiva, encima del tema del deck y debajo del contenido.
 */
export function SlideDeckBackgroundImageLayer({ slide, className }: SlideDeckBackgroundImageLayerProps) {
  const url = slide.slideBackgroundImageUrl?.trim();
  if (!url || !slideTypeUsesSlideDeckBackgroundImage(slide.type)) return null;
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 z-0", className)}
      style={{
        backgroundImage: `url(${url})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
      aria-hidden
    />
  );
}
