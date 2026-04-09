import { Monitor } from "lucide-react";
import type { Slide } from "../../types";
import { SLIDE_TYPE } from "../../domain/entities";
import { cn } from "../../utils/cn";

export interface PresenterSlideSummaryProps {
  slide: Slide;
  /**
   * `inline`: panel estrecho a la izquierda (layout clásico).
   * `stacked`: ancho completo arriba del bloque de notas (columna con escenario de diapositiva).
   */
  layout?: "inline" | "stacked";
}

/**
 * Resumen de la diapositiva actual en el panel lateral del presentador.
 */
export function PresenterSlideSummary({ slide, layout = "inline" }: PresenterSlideSummaryProps) {
  return (
    <aside
      className={cn(
        "shrink-0 flex flex-col gap-2 border-stone-700 p-3",
        layout === "stacked"
          ? "max-h-[min(120px,22vh)] w-full border-b"
          : "max-h-[120px] border-b md:max-h-[140px] md:w-[min(220px,28%)] md:min-w-[160px] md:max-w-[260px] md:border-b-0 md:border-r",
      )}
    >
      <h2 className="text-[10px] font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5 shrink-0">
        <Monitor size={12} />
        Diapositiva actual
      </h2>
      <div className="bg-stone-800 rounded-lg border border-stone-700 p-2.5 min-h-0 overflow-auto flex flex-col gap-1">
        <p className="font-serif italic text-stone-100 text-sm leading-tight line-clamp-2">
          {slide.title}
        </p>
        {slide.type === SLIDE_TYPE.CHAPTER ? (
          slide.subtitle && (
            <p className="text-stone-400 text-xs uppercase tracking-widest line-clamp-1">
              {slide.subtitle}
            </p>
          )
        ) : slide.type === SLIDE_TYPE.DIAGRAM ? (
          <p className="text-stone-400 text-xs">Diagrama editable</p>
        ) : slide.type === SLIDE_TYPE.ISOMETRIC ? (
          <p className="text-stone-400 text-xs">Diagrama isométrico</p>
        ) : slide.type === SLIDE_TYPE.MATRIX ? (
          <p className="text-stone-400 text-xs line-clamp-2">
            Tabla · {slide.matrixData?.columnHeaders?.length ?? 0}×
            {slide.matrixData?.rows?.length ?? 0}
          </p>
        ) : slide.contentLayout === "panel-full" && slide.subtitle ? (
          <p className="text-stone-400 text-xs line-clamp-2">{slide.subtitle}</p>
        ) : (
          <p className="text-stone-400 text-xs line-clamp-2 overflow-hidden">
            {slide.content
              ?.replace(/#{1,6}\s/g, "")
              .replace(/\*\*/g, "")
              .slice(0, 100)}
            {(slide.content?.length ?? 0) > 100 ? "…" : ""}
          </p>
        )}
        <div className="flex gap-1 flex-wrap">
          {slide.type === SLIDE_TYPE.DIAGRAM && (
            <span className="text-[9px] px-1.5 py-0.5 bg-stone-700 rounded text-stone-400">
              Diagrama
            </span>
          )}
          {slide.type === SLIDE_TYPE.ISOMETRIC && (
            <span className="text-[9px] px-1.5 py-0.5 bg-stone-700 rounded text-stone-400">
              Isométrico
            </span>
          )}
          {slide.type === SLIDE_TYPE.MATRIX && (
            <span className="text-[9px] px-1.5 py-0.5 bg-stone-700 rounded text-stone-400">
              Matriz
            </span>
          )}
          {slide.imageUrl && (
            <span className="text-[9px] px-1.5 py-0.5 bg-stone-700 rounded text-stone-400">
              Imagen
            </span>
          )}
          {slide.contentType === "code" && (
            <span className="text-[9px] px-1.5 py-0.5 bg-stone-700 rounded text-stone-400">
              Código
            </span>
          )}
          {slide.contentType === "video" && (
            <span className="text-[9px] px-1.5 py-0.5 bg-stone-700 rounded text-stone-400">
              Video
            </span>
          )}
          {slide.contentType === "presenter3d" && (
            <span className="text-[9px] px-1.5 py-0.5 bg-stone-700 rounded text-stone-400">
              Presentador 3D
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}
