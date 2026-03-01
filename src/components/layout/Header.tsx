import {
  ChevronLeft,
  FolderOpen,
  Maximize2,
  Save,
  Loader2,
} from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";

export function Header() {
  const {
    topic,
    goHome,
    openSavedListModal,
    slides,
    handleSave,
    isSaving,
    saveMessage,
    currentSavedId,
    setIsPreviewMode,
  } = usePresentation();

  return (
    <header className="h-16 bg-white border-b border-stone-300 px-6 flex items-center justify-between z-10 shrink-0">
      <div className="flex items-center gap-4">
        <button
          onClick={goHome}
          className="p-2 hover:bg-stone-100 rounded-lg transition-colors text-stone-600"
        >
          <ChevronLeft size={20} />
        </button>
        <h2 className="font-serif italic text-xl text-stone-900">
          SlideAI: {topic || "Nueva presentación"}
        </h2>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={openSavedListModal}
          className="px-4 py-2 bg-stone-100 text-stone-700 rounded-lg flex items-center gap-2 hover:bg-stone-200 transition-colors"
        >
          <FolderOpen size={18} />
          Mis presentaciones
        </button>
        {slides.length > 0 && (
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg flex items-center gap-2 hover:bg-emerald-700 disabled:opacity-70 transition-colors"
          >
            {isSaving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}
            {saveMessage || (currentSavedId ? "Guardar cambios" : "Guardar")}
          </button>
        )}
        <button
          onClick={() => setIsPreviewMode(true)}
          className="px-4 py-2 bg-stone-900 text-white rounded-lg flex items-center gap-2 hover:bg-stone-800 transition-colors"
        >
          <Maximize2 size={18} />
          Vista Previa
        </button>
      </div>
    </header>
  );
}
