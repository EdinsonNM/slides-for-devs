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
        className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-stone-200 flex items-center justify-between">
          <h3 className="font-semibold text-stone-900">Mis presentaciones</h3>
          <button
            onClick={() => setShowSavedListModal(false)}
            className="p-2 hover:bg-stone-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          {savedList.length === 0 ? (
            <p className="text-stone-500 text-center py-8">
              No hay presentaciones guardadas.
            </p>
          ) : (
            <ul className="space-y-2">
              {savedList.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-4 p-3 rounded-lg bg-stone-50 border border-stone-200"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-stone-900 truncate">
                      {p.topic}
                    </p>
                    <p className="text-xs text-stone-500">
                      {p.slideCount} diapositivas ·{" "}
                      {new Date(p.savedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleOpenSaved(p.id)}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700"
                    >
                      Abrir
                    </button>
                    <button
                      onClick={() => handleDeleteSaved(p.id)}
                      className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
