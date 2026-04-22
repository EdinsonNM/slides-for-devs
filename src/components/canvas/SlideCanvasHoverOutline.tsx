import { cn } from "../../utils/cn";

/**
 * Marco al pasar el ratón (estilo Canva): solo borde fino, sin handles ni toolbar.
 * El seleccionado usa `SlideCanvasCanvaChrome` (borde más grueso + controles).
 */
export function SlideCanvasHoverOutline({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-[12] rounded-sm border border-emerald-500/95 dark:border-emerald-400/90",
        className,
      )}
      aria-hidden
      data-slide-canvas-hover=""
    />
  );
}
