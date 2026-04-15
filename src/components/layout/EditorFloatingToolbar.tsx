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
  Heading,
  Heading2,
  FileText,
  ImagePlus,
  StickyNote,
  type LucideIcon,
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
  type SlideCanvasElementKind,
} from "../../domain/entities";
import { insertableCanvasElementKindsForSlide } from "../../domain/slideCanvas/insertCanvasElement";

interface EditorFloatingToolbarProps {
  onOpenConfig?: () => void;
}

const INSERT_BLOCK_UI: Record<
  SlideCanvasElementKind,
  { label: string; title: string; Icon: LucideIcon } | undefined
> = {
  title: { label: "Título", title: "Añadir bloque de título", Icon: Heading },
  subtitle: {
    label: "Subtítulo",
    title: "Añadir bloque de subtítulo",
    Icon: Heading2,
  },
  markdown: {
    label: "Texto",
    title: "Añadir bloque de texto (markdown)",
    Icon: FileText,
  },
  mediaPanel: {
    label: "Panel",
    title: "Añadir panel de imagen, código, vídeo o 3D",
    Icon: ImagePlus,
  },
  chapterTitle: {
    label: "Título",
    title: "Añadir título de capítulo",
    Icon: Heading,
  },
  chapterSubtitle: {
    label: "Subtítulo",
    title: "Añadir subtítulo de capítulo",
    Icon: Heading2,
  },
  matrixNotes: {
    label: "Notas",
    title: "Añadir bloque de notas",
    Icon: StickyNote,
  },
  sectionLabel: undefined,
  matrix: undefined,
  excalidraw: undefined,
  isometricFlow: undefined,
};

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
    flushIsometricFlowPending,
    setIsPreviewMode,
    openGenerateFullDeckModal,
    setShowSpeechModal,
    patchCurrentSlideMatrix,
    setShowGenerateSlideContentModal,
    setGenerateSlideContentPrompt,
    addCanvasElementToCurrentSlide,
  } = usePresentation();

  if (slides.length === 0) return null;

  const matrixData = normalizeSlideMatrixData(
    currentSlide?.matrixData ?? createEmptySlideMatrixData(),
  );
  const showMatrixToolbar = currentSlide?.type === SLIDE_TYPE.MATRIX;
  const showDiagramToolbar = currentSlide?.type === SLIDE_TYPE.DIAGRAM;
  const insertableCanvasKinds =
    currentSlide?.type === SLIDE_TYPE.ISOMETRIC
      ? []
      : currentSlide
        ? insertableCanvasElementKindsForSlide(currentSlide)
        : [];
  const showCanvasInsertToolbar = insertableCanvasKinds.length > 0;

  const barClass =
    "pointer-events-auto flex items-center gap-0.5 rounded-xl border border-stone-200/90 bg-white px-1.5 py-1.5 shadow-md shadow-stone-900/8 dark:border-border dark:bg-surface-elevated dark:shadow-lg dark:shadow-black/40";

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-5 z-30 flex justify-center px-4"
      aria-label="Herramientas flotantes del editor"
    >
      <div className="flex flex-wrap items-center justify-center gap-3">
        {showDiagramToolbar && (
          <div className={cn(barClass, "gap-0.5")} role="toolbar" aria-label="Diagrama">
            <button
              type="button"
              onClick={() => {
                setGenerateSlideContentPrompt("");
                setShowGenerateSlideContentModal(true);
              }}
              title="Generar diagrama con IA (Mermaid → Excalidraw)"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-emerald-600 outline-none hover:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
            >
              <Sparkles size={18} aria-hidden />
            </button>
          </div>
        )}

        {showCanvasInsertToolbar && (
          <div
            className={cn(barClass, "max-w-[min(100vw-2rem,36rem)] flex-wrap justify-center gap-0.5")}
            role="toolbar"
            aria-label="Añadir bloques al lienzo"
          >
            {insertableCanvasKinds.map((kind) => {
              const meta = INSERT_BLOCK_UI[kind];
              if (!meta) return null;
              const { Icon, label, title } = meta;
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => addCanvasElementToCurrentSlide(kind)}
                  title={title}
                  aria-label={title}
                  className="flex h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-[12px] font-medium text-muted-foreground outline-none hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-primary dark:hover:bg-white/10"
                >
                  <Icon size={16} className="shrink-0 opacity-90" aria-hidden />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              );
            })}
          </div>
        )}

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
                flushIsometricFlowPending();
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
