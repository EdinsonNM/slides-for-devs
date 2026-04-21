import { X } from "lucide-react";
import type { SavedPresentationMeta } from "../../types";

export interface DeletePresentationModalProps {
  open: boolean;
  meta: SavedPresentationMeta | null;
  onClose: () => void;
  /** Elimina en todos los ámbitos disponibles (nube + caché). */
  onDeleteEverywhere: () => void | Promise<void>;
}

export function DeletePresentationModal({
  open,
  meta,
  onClose,
  onDeleteEverywhere,
}: DeletePresentationModalProps) {
  if (!open || !meta) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white dark:bg-surface-elevated rounded-xl shadow-xl max-w-md w-full flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="delete-presentation-title"
      >
        <div className="p-4 border-b border-stone-200 dark:border-border flex items-center justify-between shrink-0">
          <h3
            id="delete-presentation-title"
            className="font-semibold text-stone-900 dark:text-foreground pr-4"
          >
            ¿Eliminar “{meta.topic || "Sin título"}”?
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-lg text-stone-600 dark:text-stone-400 shrink-0"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-4 space-y-3 text-sm text-stone-600 dark:text-stone-300">
          <p>
            Esta acción eliminará la presentación por completo y quitará sus datos
            de todos los ámbitos disponibles (nube y caché offline).
          </p>
        </div>
        <div className="p-4 pt-0 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void onDeleteEverywhere()}
            className="w-full py-2.5 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700"
          >
            Eliminar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-lg text-sm font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
