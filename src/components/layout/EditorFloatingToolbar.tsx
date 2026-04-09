import { flushSync } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  Save,
  Maximize2,
  Loader2,
  Sparkles,
  Mic,
  Columns3,
  Rows3,
  Minus,
} from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";
import {
  SLIDE_TYPE,
  applyMatrixAddColumn,
  applyMatrixRemoveColumn,
  applyMatrixAddRow,
  applyMatrixRemoveRow,
  createEmptySlideMatrixData,
  normalizeSlideMatrixData,
  SLIDE_MATRIX_MAX_COLUMNS,
  SLIDE_MATRIX_MAX_DATA_ROWS,
  SLIDE_MATRIX_MIN_COLUMNS,
  SLIDE_MATRIX_MIN_DATA_ROWS,
} from "../../domain/entities";

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
    currentSlide,
    prevSlide,
    nextSlide,
    handleSave,
    isSaving,
    flushDiagramPending,
    setIsPreviewMode,
    openGenerateFullDeckModal,
    setShowSpeechModal,
    patchCurrentSlideMatrix,
    setShowGenerateSlideContentModal,
    setGenerateSlideContentPrompt,
  } = usePresentation();

  if (slides.length === 0) return null;

  const matrixData = normalizeSlideMatrixData(
    currentSlide?.matrixData ?? createEmptySlideMatrixData(),
  );
  const showMatrixToolbar = currentSlide?.type === SLIDE_TYPE.MATRIX;

  const barClass =
    "pointer-events-auto flex items-center gap-0.5 rounded-xl border border-stone-200/90 bg-white px-1.5 py-1.5 shadow-md shadow-stone-900/8 dark:border-border dark:bg-surface-elevated dark:shadow-lg dark:shadow-black/40";

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-5 z-30 flex justify-center px-4"
      aria-label="Herramientas flotantes del editor"
    >
      <div className="flex flex-wrap items-center justify-center gap-3">
        {showMatrixToolbar && (
          <div className={cn(barClass, "gap-0.5")} role="toolbar" aria-label="Tabla / matriz">
            <button
              type="button"
              onClick={() => patchCurrentSlideMatrix(applyMatrixAddColumn)}
              disabled={matrixData.columnHeaders.length >= SLIDE_MATRIX_MAX_COLUMNS}
              title="Añadir columna"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-35 dark:hover:bg-white/10"
            >
              <Columns3 size={18} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => patchCurrentSlideMatrix(applyMatrixRemoveColumn)}
              disabled={matrixData.columnHeaders.length <= SLIDE_MATRIX_MIN_COLUMNS}
              title="Quitar última columna"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-35 dark:hover:bg-white/10"
            >
              <Minus size={18} aria-hidden />
            </button>
            <div
              className="mx-0.5 h-5 w-px shrink-0 bg-stone-200 dark:bg-stone-600"
              aria-hidden
            />
            <button
              type="button"
              onClick={() => patchCurrentSlideMatrix(applyMatrixAddRow)}
              disabled={matrixData.rows.length >= SLIDE_MATRIX_MAX_DATA_ROWS}
              title="Añadir fila"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-35 dark:hover:bg-white/10"
            >
              <Rows3 size={18} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => patchCurrentSlideMatrix(applyMatrixRemoveRow)}
              disabled={matrixData.rows.length <= SLIDE_MATRIX_MIN_DATA_ROWS}
              title="Quitar última fila"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-35 dark:hover:bg-white/10"
            >
              <Minus size={18} aria-hidden />
            </button>
            <div
              className="mx-0.5 h-5 w-px shrink-0 bg-stone-200 dark:bg-stone-600"
              aria-hidden
            />
            <button
              type="button"
              onClick={() => {
                setGenerateSlideContentPrompt("");
                setShowGenerateSlideContentModal(true);
              }}
              title="Generar tabla con IA"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-emerald-600 outline-none hover:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
            >
              <Sparkles size={18} aria-hidden />
            </button>
          </div>
        )}

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
            aria-busy={isSaving}
            title={isSaving ? "Guardando…" : "Guardar"}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-medium text-white outline-none hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:opacity-60 dark:focus-visible:ring-offset-surface-elevated"
          >
            {isSaving ? (
              <Loader2 size={16} className="shrink-0 animate-spin" aria-hidden />
            ) : (
              <Save size={16} className="shrink-0" aria-hidden />
            )}
            {isSaving ? "Guardando…" : "Guardar"}
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
        </div>
      </div>
    </div>
  );
}
