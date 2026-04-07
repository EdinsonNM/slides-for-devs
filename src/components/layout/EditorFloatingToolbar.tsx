import { flushSync } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  Save,
  Maximize2,
  Loader2,
  Sparkles,
  StickyNote,
  Mic,
} from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";

interface EditorFloatingToolbarProps {
  onOpenConfig?: () => void;
}

export function EditorFloatingToolbar({
  onOpenConfig: _onOpenConfig,
}: EditorFloatingToolbarProps) {
  void _onOpenConfig;
  const {
    currentIndex,
    slides,
    prevSlide,
    nextSlide,
    handleSave,
    isSaving,
    saveMessage,
    flushDiagramPending,
    setIsPreviewMode,
    openGenerateFullDeckModal,
    isNotesPanelOpen,
    setIsNotesPanelOpen,
    setInspectorSection,
    setShowSlideStylePanel,
    setShowCharactersPanel,
    setShowSpeechModal,
  } = usePresentation();

  if (slides.length === 0) return null;

  const barClass =
    "pointer-events-auto flex items-center gap-0.5 rounded-xl border border-stone-200/90 bg-white px-1.5 py-1.5 shadow-md shadow-stone-900/8 dark:border-border dark:bg-surface-elevated dark:shadow-lg dark:shadow-black/40";

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-5 z-30 flex justify-center px-4"
      aria-label="Herramientas flotantes del editor"
    >
      <div className="flex flex-wrap items-center justify-center gap-3">
        <div className={barClass}>
          <button
            type="button"
            onClick={prevSlide}
            disabled={currentIndex === 0}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-35 dark:hover:bg-white/10"
            aria-label="Diapositiva anterior"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="min-w-[4.5rem] px-2 text-center text-[12px] font-medium tabular-nums text-muted-foreground">
            {currentIndex + 1} / {slides.length}
          </div>
          <button
            type="button"
            onClick={nextSlide}
            disabled={currentIndex === slides.length - 1}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-35 dark:hover:bg-white/10"
            aria-label="Diapositiva siguiente"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className={barClass}>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-primary dark:hover:bg-white/10"
            aria-label="Generar toda la presentación"
            title="Generar con IA"
            onClick={() => openGenerateFullDeckModal()}
          >
            <Sparkles size={18} />
          </button>
          <button
            type="button"
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-primary dark:hover:bg-white/10",
              isNotesPanelOpen && "bg-primary/15 text-primary",
            )}
            aria-label={isNotesPanelOpen ? "Ocultar notas" : "Notas"}
            title="Notas del presentador"
            onClick={() => {
              const next = !isNotesPanelOpen;
              setIsNotesPanelOpen(next);
              if (next) {
                setInspectorSection("notes");
                setShowSlideStylePanel(false);
                setShowCharactersPanel(false);
              } else {
                setInspectorSection("slide");
                setShowSlideStylePanel(true);
                setShowCharactersPanel(false);
              }
            }}
          >
            <StickyNote size={18} />
          </button>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-primary dark:hover:bg-white/10"
            aria-label="Speech general"
            title="Speech para toda la presentación"
            onClick={() => setShowSpeechModal(true)}
          >
            <Mic size={18} />
          </button>
        </div>

        <div className={cn(barClass, "gap-1")}>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-medium text-white outline-none hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:opacity-60 dark:focus-visible:ring-offset-surface-elevated"
          >
            {isSaving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            Guardar
          </button>
          <button
            type="button"
            onClick={() => {
              flushSync(() => {
                flushDiagramPending();
              });
              setIsPreviewMode(true);
            }}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-stone-200/90 bg-transparent px-3 text-[13px] font-medium text-foreground outline-none hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-primary dark:border-border dark:hover:bg-white/8"
          >
            <Maximize2 size={16} />
            Presentar
          </button>
          {saveMessage ? (
            <span className="max-w-[120px] truncate px-1 text-[10px] text-muted-foreground">
              {saveMessage}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
