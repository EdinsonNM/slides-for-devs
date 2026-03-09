import { Trash2, X } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";

export function SavedListModal() {
  const {
    showSavedListModal,
    setShowSavedListModal,
    savedList,
    handleOpenSaved,
    handleDeleteSaved,
  } = usePresentation();

  if (!showSavedListModal) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={() => setShowSavedListModal(false)}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-stone-200 flex items-center justify-between shrink-0">
          <h3 className="font-semibold text-stone-900">Mis presentaciones</h3>
          <button
            onClick={() => setShowSavedListModal(false)}
            className="p-2 hover:bg-stone-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 min-h-0">
          {savedList.length === 0 ? (
            <p className="text-stone-500 text-center py-8">
              No hay presentaciones guardadas.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {savedList.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col rounded-xl border border-stone-200 bg-stone-50 overflow-hidden hover:border-stone-300 hover:shadow-md transition-all"
                >
                  <button
                    type="button"
                    onClick={() => handleOpenSaved(p.id)}
                    className="flex-1 p-4 text-left min-h-[100px] focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-inset"
                  >
                    <p className="font-medium text-stone-900 line-clamp-2">
                      {p.topic}
                    </p>
                    <p className="text-xs text-stone-500 mt-2">
                      {p.slideCount} diapositivas
                    </p>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {new Date(p.savedAt).toLocaleDateString()}
                    </p>
                  </button>
                  <div className="flex border-t border-stone-200 bg-white/80">
                    <button
                      onClick={() => handleOpenSaved(p.id)}
                      className="flex-1 py-2.5 text-sm font-medium text-emerald-600 hover:bg-emerald-50"
                    >
                      Abrir
                    </button>
                    <button
                      onClick={() => handleDeleteSaved(p.id)}
                      className="p-2.5 text-stone-400 hover:text-red-600 hover:bg-red-50 border-l border-stone-200"
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
