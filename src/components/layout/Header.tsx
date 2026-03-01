import {
  ChevronLeft,
  FolderOpen,
  Maximize2,
  Save,
  Loader2,
  Mic,
  StickyNote,
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
    setShowSpeechModal,
    isNotesPanelOpen,
    setIsNotesPanelOpen,
  } = usePresentation();

  return (
    <header className="h-14 bg-white border-b border-stone-200 px-4 flex items-center justify-between z-10 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={goHome}
          className="p-2 rounded-md text-stone-500 hover:bg-stone-100 hover:text-stone-700 transition-colors shrink-0"
          title="Inicio"
        >
          <ChevronLeft size={18} />
        </button>
        <h2 className="font-serif italic text-lg text-stone-900 truncate">
          {topic || "Nueva presentación"}
        </h2>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => setIsNotesPanelOpen(!isNotesPanelOpen)}
          className={cn(
            "p-2 rounded-md transition-colors",
            isNotesPanelOpen
              ? "bg-amber-100 text-amber-700"
              : "text-stone-500 hover:bg-stone-100 hover:text-amber-600"
          )}
          title={isNotesPanelOpen ? "Ocultar notas" : "Mostrar notas"}
        >
          <StickyNote size={18} />
        </button>
        <button
          type="button"
          onClick={() => setShowSpeechModal(true)}
          className="p-2 rounded-md text-stone-500 hover:bg-violet-100 hover:text-violet-600 transition-colors"
          title="Prompt general (generar speech para toda la presentación)"
        >
          <Mic size={18} />
        </button>
        <button
          type="button"
          onClick={openSavedListModal}
          className="p-2 rounded-md text-stone-500 hover:bg-stone-100 hover:text-stone-700 transition-colors hidden sm:inline-flex"
          title="Mis presentaciones"
        >
          <FolderOpen size={18} />
        </button>
        {slides.length > 0 && (
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="p-2 rounded-md text-emerald-600 hover:bg-emerald-50 disabled:opacity-60 transition-colors"
            title={currentSavedId ? "Guardar cambios" : "Guardar"}
          >
            {isSaving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}
          </button>
        )}
        {slides.length > 0 && (
          <button
            onClick={() => setIsPreviewMode(true)}
            className="p-2 rounded-md bg-stone-800 text-white hover:bg-stone-700 transition-colors"
            title="Vista previa"
          >
            <Maximize2 size={18} />
          </button>
        )}
        {saveMessage && (
          <span className="text-[10px] text-stone-500 font-medium px-1">
            {saveMessage}
          </span>
        )}
      </div>
    </header>
  );
}
