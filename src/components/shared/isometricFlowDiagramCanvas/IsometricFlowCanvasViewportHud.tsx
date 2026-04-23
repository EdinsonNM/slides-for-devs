import { Maximize2 } from "lucide-react";
import { cn } from "../../../utils/cn";
import type { IsoViewRect } from "./constants";
import { isoViewRectIsDefault } from "./canvasModel";

export type IsometricFlowCanvasViewportHudProps = {
  viewRect: IsoViewRect;
  onResetView: () => void;
  /** Presentador y vista previa: sin botón de reencuadre; rueda/pan siguen activos. */
  readOnly: boolean;
};

export function IsometricFlowCanvasViewportHud({
  viewRect,
  onResetView,
  readOnly,
}: IsometricFlowCanvasViewportHudProps) {
  return (
    <div className="pointer-events-none absolute bottom-2 right-2 z-10 flex max-w-[min(100%,260px)] flex-col items-end gap-1">
      {!readOnly && (
        <div className="pointer-events-auto flex items-center gap-1 rounded-md border border-stone-200/90 bg-white/95 px-1.5 py-1 shadow-sm dark:border-border dark:bg-stone-900/95">
          <button
            type="button"
            onClick={onResetView}
            disabled={isoViewRectIsDefault(viewRect)}
            title="Volver al encuadre completo (también restablece zoom y desplazamiento)"
            aria-label="Encuadrar diagrama completo"
            className={cn(
              "inline-flex items-center justify-center rounded-md border border-stone-200 p-1.5 text-stone-700 hover:bg-stone-100 disabled:pointer-events-none disabled:opacity-35 dark:border-stone-600 dark:text-stone-200 dark:hover:bg-stone-800",
            )}
          >
            <Maximize2 size={15} strokeWidth={2} />
          </button>
        </div>
      )}
      <p className="hidden text-right text-[10px] leading-snug text-stone-500 dark:text-stone-400 sm:block">
        Vacío: arrastrar rectángulo de selección · Mayús/Cmd/Ctrl: añadir a la selección o varios bloques ·
        Rueda: zoom · Centro o Alt+arrastrar: mover la vista
      </p>
    </div>
  );
}
