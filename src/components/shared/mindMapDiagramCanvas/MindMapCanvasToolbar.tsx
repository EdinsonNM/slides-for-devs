import { Plus, ScanSearch, Wand2, ZoomIn, ZoomOut } from "lucide-react";
import type { MindMapCanvasController } from "./useMindMapCanvasController";
import { slideCanvasToolbarIconBtnClass, slideCanvasToolbarPillRowClass } from "../../canvas/slideCanvasToolbarStyles";
import { cn } from "../../../utils/cn";

export function MindMapCanvasToolbar(ctrl: MindMapCanvasController) {
  const { readOnly, resetView, addNode, slideTextOverlayToolbar } = ctrl;

  return (
    <>
      <div
        data-mind-map-ui
        className={cn(
          "absolute right-4 z-[100] flex flex-col gap-2 pointer-events-auto",
          /* Presentador / preview: zoom abajo a la derecha para no chocar con HUD superior. */
          readOnly ? "bottom-4" : "top-4",
        )}
      >
        <div className={cn(slideCanvasToolbarPillRowClass, "flex-col p-1.5 gap-1.5 bg-white/80 dark:bg-stone-900/80 backdrop-blur-md shadow-sm")}>
          {!readOnly && (
            <>
              <button type="button" onClick={addNode} className={slideCanvasToolbarIconBtnClass} title="Añadir nodo (Manual)">
                <Plus size={18} />
              </button>
              <div className="h-px bg-stone-200 dark:bg-stone-700 w-full" />
              <button 
                type="button" 
                onClick={() => alert("Generación con IA en desarrollo...")} 
                className={cn(slideCanvasToolbarIconBtnClass, "text-purple-600 dark:text-purple-400")} 
                title="Autogenerar con IA"
              >
                <Wand2 size={18} />
              </button>
              <div className="h-px bg-stone-200 dark:bg-stone-700 w-full" />
            </>
          )}
          <button type="button" onClick={() => ctrl.setZoom(z => Math.min(5, z + 0.1))} className={slideCanvasToolbarIconBtnClass} title="Acercar">
            <ZoomIn size={18} />
          </button>
          <button type="button" onClick={() => ctrl.setZoom(z => Math.max(0.1, z - 0.1))} className={slideCanvasToolbarIconBtnClass} title="Alejar">
            <ZoomOut size={18} />
          </button>
          <button type="button" onClick={resetView} className={slideCanvasToolbarIconBtnClass} title="Centrar cámara">
            <ScanSearch size={18} />
          </button>
        </div>
      </div>
      
      {!readOnly && slideTextOverlayToolbar && (
        <div
          data-mind-map-ui
          className="absolute left-1/2 top-4 z-[100] -translate-x-1/2 bg-white/90 dark:bg-stone-900/90 backdrop-blur-sm border border-stone-200 dark:border-stone-800 rounded-lg p-1.5 flex gap-2 shadow-lg pointer-events-auto"
        >
          <button 
            type="button" 
            onClick={slideTextOverlayToolbar.onAddTitle}
            disabled={slideTextOverlayToolbar.disableTitle}
            className="px-3 py-1 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            + Título flotante
          </button>
          <div className="w-px bg-stone-200 dark:bg-stone-700" />
          <button 
            type="button" 
            onClick={slideTextOverlayToolbar.onAddDescription}
            disabled={slideTextOverlayToolbar.disableDescription}
            className="px-3 py-1 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            + Descripción
          </button>
        </div>
      )}
    </>
  );
}
