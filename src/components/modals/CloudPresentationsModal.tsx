import { X, Cloud, Download, Loader2, FolderOpen } from "lucide-react";
import type { CloudPresentationListItem } from "../../services/presentationCloud";
import type { SavedPresentationMeta } from "../../types";

export interface CloudPresentationsModalProps {
  open: boolean;
  onClose: () => void;
  items: CloudPresentationListItem[];
  loading: boolean;
  error: string | null;
  savedList: SavedPresentationMeta[];
  downloadingCloudId: string | null;
  onDownload: (cloudId: string) => void;
  onOpenLocal: (localId: string) => void;
}

export function CloudPresentationsModal({
  open,
  onClose,
  items,
  loading,
  error,
  savedList,
  downloadingCloudId,
  onDownload,
  onOpenLocal,
}: CloudPresentationsModalProps) {
  if (!open) return null;

  const localForCloud = (cloudId: string) =>
    savedList.find((p) => p.cloudId === cloudId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white dark:bg-surface-elevated rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="cloud-modal-title"
      >
        <div className="p-4 border-b border-stone-200 dark:border-border flex items-center justify-between shrink-0">
          <h3
            id="cloud-modal-title"
            className="font-semibold text-stone-900 dark:text-foreground flex items-center gap-2"
          >
            <Cloud className="text-emerald-600" size={22} />
            Presentaciones en la nube
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-lg text-stone-600 dark:text-stone-400"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 min-h-0">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-stone-500">
              <Loader2 className="animate-spin w-8 h-8" />
              <p className="text-sm">Cargando…</p>
            </div>
          )}
          {!loading && error && (
            <p className="text-sm text-red-600 dark:text-red-400 text-center py-8">
              {error}
            </p>
          )}
          {!loading && !error && items.length === 0 && (
            <p className="text-stone-500 dark:text-stone-400 text-center py-8 text-sm">
              No hay presentaciones en la nube. Sincroniza desde las tarjetas del
              inicio.
            </p>
          )}
          {!loading && !error && items.length > 0 && (
            <ul className="space-y-2">
              {items.map((item) => {
                const local = localForCloud(item.cloudId);
                const isBusy = downloadingCloudId === item.cloudId;
                return (
                  <li
                    key={item.cloudId}
                    className="flex items-center gap-3 p-3 rounded-lg border border-stone-200 dark:border-border bg-stone-50/80 dark:bg-surface"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-stone-900 dark:text-foreground truncate">
                        {item.topic || "Sin título"}
                      </p>
                      <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                        {item.updatedAt
                          ? new Date(item.updatedAt).toLocaleString()
                          : new Date(item.savedAt).toLocaleDateString()}
                      </p>
                      {local && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                          En este equipo
                        </p>
                      )}
                    </div>
                    {local ? (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onOpenLocal(local.id)}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <FolderOpen size={16} />
                        Abrir
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onDownload(item.cloudId)}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 text-sm font-medium hover:opacity-90 disabled:opacity-50"
                      >
                        {isBusy ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Download size={16} />
                        )}
                        Descargar
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <p className="px-4 pb-3 text-xs text-stone-400 dark:text-stone-500">
          Los personajes asociados no se sincronizan; puede que haya que volver a
          asignarlos tras descargar.
        </p>
      </div>
    </div>
  );
}
