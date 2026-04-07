import {
  Trash2,
  X,
  CloudUpload,
  Loader2,
  Share2,
  Cloud,
  CloudDownload,
  HardDrive,
} from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";
import { presentationListCardBorderClass } from "../../utils/presentationStorageUi";

export function SavedListModal() {
  const {
    showSavedListModal,
    setShowSavedListModal,
    savedList,
    handleOpenSaved,
    requestDeletePresentation,
    cloudSyncAvailable,
    syncingToCloudId,
    handleSyncPresentationToCloud,
    openSharePresentationModal,
  } = usePresentation();

  if (!showSavedListModal) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={() => setShowSavedListModal(false)}
    >
      <div
        className="bg-white dark:bg-surface-elevated rounded-xl shadow-xl max-w-4xl w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-stone-200 dark:border-border flex items-center justify-between shrink-0 gap-3">
          <div>
            <h3 className="font-semibold text-stone-900 dark:text-foreground">
              Mis presentaciones
            </h3>
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
              Verde: local+nube. Punteado ámbar: solo equipo. Punteado azul: en
              nube sin copia local.
            </p>
          </div>
          <button
            onClick={() => setShowSavedListModal(false)}
            className="p-2 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-lg text-stone-600 dark:text-stone-400"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 min-h-0">
          {savedList.length === 0 ? (
            <p className="text-stone-500 dark:text-stone-400 text-center py-8">
              No hay presentaciones guardadas.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {savedList.map((p) => (
                <div
                  key={p.id}
                  className={cn(
                    "flex flex-col rounded-xl bg-stone-50 dark:bg-surface overflow-hidden hover:shadow-md transition-all",
                    presentationListCardBorderClass(p),
                  )}
                >
                  <button
                    type="button"
                    onClick={() => handleOpenSaved(p.id)}
                    className="flex-1 p-4 text-left min-h-[100px] focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-inset"
                  >
                    <div
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide mb-2",
                        p.cloudId && p.localBodyCleared
                          ? "bg-sky-100 text-sky-950 dark:bg-sky-900/60 dark:text-sky-100"
                          : p.cloudId
                            ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-100"
                            : "bg-amber-100 text-amber-950 dark:bg-amber-900/50 dark:text-amber-50",
                      )}
                    >
                      {p.cloudId && p.localBodyCleared ? (
                        <>
                          <CloudDownload size={11} aria-hidden />
                          Nube (sin local)
                        </>
                      ) : p.cloudId ? (
                        <>
                          <Cloud size={11} aria-hidden />
                          En la nube
                        </>
                      ) : (
                        <>
                          <HardDrive size={11} aria-hidden />
                          Solo local
                        </>
                      )}
                    </div>
                    <p className="font-medium text-stone-900 dark:text-foreground line-clamp-2">
                      {p.topic}
                    </p>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-2">
                      {p.localBodyCleared ? "—" : p.slideCount} diapositivas
                    </p>
                    <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                      {new Date(p.savedAt).toLocaleDateString()}
                    </p>
                  </button>
                  <div className="flex border-t border-stone-200 dark:border-border bg-white/80 dark:bg-surface-elevated/80">
                    <button
                      onClick={() => handleOpenSaved(p.id)}
                      className="flex-1 py-2.5 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/40"
                    >
                      Abrir
                    </button>
                    {cloudSyncAvailable && !p.localBodyCleared && (
                      <button
                        type="button"
                        onClick={() => handleSyncPresentationToCloud(p.id)}
                        disabled={syncingToCloudId === p.id}
                        className="p-2.5 text-stone-500 hover:text-emerald-600 border-l border-stone-200 dark:border-border disabled:opacity-50"
                        title={
                          p.cloudId
                            ? "Actualizar copia en la nube"
                            : "Subir a la nube (copia en tu cuenta)"
                        }
                      >
                        {syncingToCloudId === p.id ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <CloudUpload size={18} />
                        )}
                      </button>
                    )}
                    {cloudSyncAvailable && p.cloudId && !p.localBodyCleared && (
                      <button
                        type="button"
                        onClick={() => openSharePresentationModal(p.id)}
                        className="p-2.5 text-stone-500 hover:text-violet-600 border-l border-stone-200 dark:border-border"
                        title="Compartir (correo o UID)"
                      >
                        <Share2 size={18} />
                      </button>
                    )}
                    <button
                      onClick={() => requestDeletePresentation(p.id)}
                      className="p-2.5 text-stone-400 dark:text-stone-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 border-l border-stone-200 dark:border-border"
                      title={
                        p.localBodyCleared && p.cloudId
                          ? "Eliminar de la nube o cancelar"
                          : p.cloudId
                            ? "Eliminar (elige alcance)"
                            : "Eliminar de este dispositivo"
                      }
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
