import { Trash2, X, CloudUpload, Loader2, Share2 } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";

export function SavedListModal() {
  const {
    showSavedListModal,
    setShowSavedListModal,
    savedList,
    handleOpenSaved,
    handleDeleteSaved,
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
        <div className="p-4 border-b border-stone-200 dark:border-border flex items-center justify-between shrink-0">
          <h3 className="font-semibold text-stone-900 dark:text-foreground">
            Mis presentaciones
          </h3>
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
                  className="flex flex-col rounded-xl border border-stone-200 dark:border-border bg-stone-50 dark:bg-surface overflow-hidden hover:border-stone-300 dark:hover:border-stone-600 hover:shadow-md transition-all"
                >
                  <button
                    type="button"
                    onClick={() => handleOpenSaved(p.id)}
                    className="flex-1 p-4 text-left min-h-[100px] focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-inset"
                  >
                    <p className="font-medium text-stone-900 dark:text-foreground line-clamp-2">
                      {p.topic}
                    </p>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-2">
                      {p.slideCount} diapositivas
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
                    {cloudSyncAvailable && (
                      <button
                        type="button"
                        onClick={() => handleSyncPresentationToCloud(p.id)}
                        disabled={syncingToCloudId === p.id}
                        className="p-2.5 text-stone-500 hover:text-emerald-600 border-l border-stone-200 dark:border-border disabled:opacity-50"
                        title="Sincronizar con la nube"
                      >
                        {syncingToCloudId === p.id ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <CloudUpload size={18} />
                        )}
                      </button>
                    )}
                    {cloudSyncAvailable && p.cloudId && (
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
                      onClick={() => handleDeleteSaved(p.id)}
                      className="p-2.5 text-stone-400 dark:text-stone-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 border-l border-stone-200 dark:border-border"
                      title="Eliminar"
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
