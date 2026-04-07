import type { ReactElement } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Image as ImageIcon, Code2, Video, PencilRuler, Smartphone } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";
import { ContentPanelProperties } from "./ContentPanelProperties";

/** Miniatura: solo título centrado */
function PreviewTitle() {
  return (
    <div className="w-full aspect-video bg-white dark:bg-surface-elevated border border-stone-200 dark:border-border rounded-lg overflow-hidden flex items-center justify-center p-1">
      <div className="w-3/4 h-2 bg-stone-300 dark:bg-stone-600 rounded" />
    </div>
  );
}

/** Miniatura: contenido con panel (split) */
function PreviewContentSplit() {
  return (
    <div className="w-full aspect-video bg-white dark:bg-surface-elevated border border-stone-200 dark:border-border rounded-lg overflow-hidden flex p-0.5 gap-0.5">
      <div className="flex-1 flex flex-col gap-0.5">
        <div className="h-1.5 w-2/3 bg-stone-300 dark:bg-stone-600 rounded" />
        <div className="h-1 w-full bg-stone-100 dark:bg-stone-700 rounded" />
        <div className="h-1 w-full bg-stone-100 dark:bg-stone-700 rounded" />
        <div className="h-1 w-4/5 bg-stone-100 dark:bg-stone-700 rounded" />
      </div>
      <div className="w-1/3 bg-stone-100 dark:bg-stone-700 rounded flex items-center justify-center">
        <div className="w-full aspect-square max-w-[80%] bg-stone-200 dark:bg-stone-600 rounded" />
      </div>
    </div>
  );
}

/** Miniatura: contenido solo texto (título + zona de contenido visible) */
function PreviewContentFull() {
  return (
    <div className="w-full aspect-video bg-white dark:bg-surface-elevated border border-stone-200 dark:border-border rounded-lg overflow-hidden flex flex-col p-0.5 gap-1">
      <div className="h-1.5 w-2/3 bg-stone-300 dark:bg-stone-600 rounded shrink-0" />
      <div className="h-1.5 w-full bg-stone-100 dark:bg-stone-700 rounded shrink-0" />
      <div className="h-1.5 w-full bg-stone-100 dark:bg-stone-700 rounded shrink-0" />
      <div className="h-1.5 w-4/5 bg-stone-100 dark:bg-stone-700 rounded shrink-0" />
      <div className="h-1.5 w-3/4 bg-stone-100 dark:bg-stone-700 rounded shrink-0" />
    </div>
  );
}

/** Miniatura: título arriba, debajo placeholder de imagen */
function PreviewContentPanelFull() {
  return (
    <div className="w-full aspect-video bg-white dark:bg-surface-elevated border border-stone-200 dark:border-border rounded-lg overflow-hidden flex flex-col p-0.5 gap-1">
      <div className="h-1.5 w-3/4 bg-stone-300 dark:bg-stone-600 rounded shrink-0" />
      <div className="flex-1 min-h-0 bg-stone-100 dark:bg-stone-700 rounded flex items-center justify-center p-1">
        <div className="w-full h-full rounded border border-dashed border-stone-300 dark:border-stone-600 flex items-center justify-center bg-stone-50 dark:bg-stone-800">
          <ImageIcon className="w-5 h-5 text-stone-400 dark:text-stone-500" strokeWidth={1.5} />
        </div>
      </div>
    </div>
  );
}

/** Miniatura: diagrama Excalidraw */
function PreviewDiagram() {
  return (
    <div className="w-full aspect-video bg-white dark:bg-surface-elevated border border-stone-200 dark:border-border rounded-lg overflow-hidden flex items-center justify-center p-1">
      <div className="w-full h-full border border-dashed border-stone-300 dark:border-stone-600 rounded flex items-center justify-center">
        <PencilRuler className="w-6 h-6 text-stone-400 dark:text-stone-500" />
      </div>
    </div>
  );
}

const TEMPLATES: {
  id: "title" | "content-split" | "content-full" | "content-panel-full" | "diagram";
  label: string;
  Preview: () => ReactElement;
}[] = [
  { id: "title", label: "Título", Preview: PreviewTitle },
  { id: "content-split", label: "Contenido (con panel)", Preview: PreviewContentSplit },
  { id: "content-full", label: "Contenido (solo texto)", Preview: PreviewContentFull },
  { id: "content-panel-full", label: "Título + panel", Preview: PreviewContentPanelFull },
  { id: "diagram", label: "Diagrama", Preview: PreviewDiagram },
];

interface SlideStylePanelProps {
  variant?: "toolbar" | "inspector";
}

export function SlideStylePanel({ variant = "toolbar" }: SlideStylePanelProps) {
  const {
    currentSlide,
    slides,
    showSlideStylePanel,
    setShowSlideStylePanel,
    setCurrentSlideType,
    setCurrentSlideContentLayout,
    setCurrentSlideContentType,
  } = usePresentation();

  const visible = variant === "inspector" || showSlideStylePanel;
  if (!visible || !currentSlide || slides.length === 0) return null;

  const isTitle = currentSlide.type === "chapter";
  const isDiagram = currentSlide.type === "diagram";
  const isContentSplit =
    currentSlide.type === "content" && (currentSlide.contentLayout ?? "split") === "split";
  const isContentFull =
    currentSlide.type === "content" && currentSlide.contentLayout === "full";
  const isContentPanelFull =
    currentSlide.type === "content" && currentSlide.contentLayout === "panel-full";
  const contentType = currentSlide.contentType ?? "image";

  const getSelectedId = (): (typeof TEMPLATES)[number]["id"] => {
    if (isTitle) return "title";
    if (isDiagram) return "diagram";
    if (isContentFull) return "content-full";
    if (isContentPanelFull) return "content-panel-full";
    return "content-split";
  };
  const selectedId = getSelectedId();

  const header = (
    <div
      className={cn(
        "px-3 py-2.5 flex items-center justify-between gap-3 border-b shrink-0",
        variant === "inspector"
          ? "border-stone-100 bg-stone-50/60 dark:border-border dark:bg-surface"
          : "border-stone-100 dark:border-border bg-white dark:bg-surface-elevated",
      )}
    >
      <span
        className={cn(
          "text-[10px] font-semibold uppercase tracking-wider",
          variant === "inspector"
            ? "text-muted-foreground"
            : "text-stone-500 dark:text-muted-foreground",
        )}
      >
        Plantilla de la diapositiva
      </span>
      {variant === "toolbar" && (
        <button
          type="button"
          onClick={() => setShowSlideStylePanel(false)}
          className="p-1.5 rounded-lg text-stone-400 dark:text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-700 hover:text-stone-600 dark:hover:text-foreground transition-colors"
          title="Cerrar panel"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );

  const templatesRow = (
    <div
      className={cn(
        "flex gap-3 overflow-x-auto px-3 py-3 scroll-smooth snap-x snap-mandatory carousel-no-scrollbar",
        variant === "inspector" && "flex-wrap",
      )}
    >
          {TEMPLATES.map(({ id, label, Preview }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                if (id === "title") setCurrentSlideType("chapter");
                else if (id === "diagram") setCurrentSlideType("diagram");
                else if (id === "content-split") {
                  setCurrentSlideType("content");
                  setCurrentSlideContentLayout("split");
                } else if (id === "content-panel-full") {
                  setCurrentSlideType("content");
                  setCurrentSlideContentLayout("panel-full");
                } else {
                  setCurrentSlideType("content");
                  setCurrentSlideContentLayout("full");
                }
              }}
              className={cn(
                "shrink-0 w-28 snap-start flex flex-col rounded-xl border-2 overflow-hidden transition-all",
                selectedId === id
                  ? "border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-900/30"
                  : "border-stone-200 dark:border-border bg-stone-50/30 dark:bg-stone-800/50 hover:border-stone-300 dark:hover:border-stone-600 hover:shadow-sm"
              )}
            >
              <div className="p-1.5 min-h-0">
                <Preview />
              </div>
              <div className="px-2 py-2 border-t border-stone-100 dark:border-border bg-white dark:bg-surface">
                <span
                  className={cn(
                    "text-xs font-medium block text-center truncate",
                    selectedId === id ? "text-emerald-700 dark:text-emerald-300" : "text-stone-600 dark:text-stone-300"
                  )}
                >
                  {label}
                </span>
              </div>
            </button>
          ))}
        </div>
  );

  const panelTypes =
    (isContentSplit || isContentPanelFull) && (
          <div className="flex flex-wrap items-center gap-2 border-t border-stone-100 px-3 pb-3 pt-2 dark:border-border">
            <span className="text-xs font-medium text-stone-500 dark:text-muted-foreground">Panel:</span>
            {[
              { id: "image" as const, label: "Imagen", icon: ImageIcon },
              { id: "code" as const, label: "Código", icon: Code2 },
              { id: "video" as const, label: "Video", icon: Video },
              { id: "presenter3d" as const, label: "Presentador 3D", icon: Smartphone },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setCurrentSlideContentType(id)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all",
                  contentType === id
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                    : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 dark:border-stone-500 dark:bg-stone-800/60 dark:text-stone-200 dark:hover:border-stone-400 dark:hover:bg-stone-800",
                )}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        );

  if (variant === "inspector") {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-white dark:bg-surface-elevated">
        {header}
        {templatesRow}
        {panelTypes}
        {(isContentSplit || isContentPanelFull) && <ContentPanelProperties />}
      </div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-white dark:bg-surface-elevated border-b border-stone-200 dark:border-border shrink-0 overflow-hidden"
      >
        {header}
        {templatesRow}
        {panelTypes}
        {(isContentSplit || isContentPanelFull) && <ContentPanelProperties />}
      </motion.div>
    </AnimatePresence>
  );
}
