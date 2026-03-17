import { Monitor } from "lucide-react";
import type { Slide } from "../../types";

export interface PresenterSlideSummaryProps {
  slide: Slide;
}

/**
 * Resumen de la diapositiva actual en el panel lateral del presentador.
 */
export function PresenterSlideSummary({ slide }: PresenterSlideSummaryProps) {
  return (
    <aside className="shrink-0 flex flex-col gap-2 p-3 border-b md:border-b-0 md:border-r border-stone-700 md:w-[min(220px,28%)] md:min-w-[160px] md:max-w-[260px] max-h-[120px] md:max-h-[140px]">
      <h2 className="text-[10px] font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5 shrink-0">
        <Monitor size={12} />
        Diapositiva actual
      </h2>
      <div className="bg-stone-800 rounded-lg border border-stone-700 p-2.5 min-h-0 overflow-auto flex flex-col gap-1">
        <p className="font-serif italic text-stone-100 text-sm leading-tight line-clamp-2">
          {slide.title}
        </p>
        {slide.type === "chapter" ? (
          slide.subtitle && (
            <p className="text-stone-400 text-xs uppercase tracking-widest line-clamp-1">
              {slide.subtitle}
            </p>
          )
        ) : slide.type === "diagram" ? (
          <p className="text-stone-400 text-xs">Diagrama editable</p>
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
          {slide.type === "diagram" && (
            <span className="text-[9px] px-1.5 py-0.5 bg-stone-700 rounded text-stone-400">
              Diagrama
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
        </div>
      </div>
    </aside>
  );
}
