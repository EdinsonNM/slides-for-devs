import { motion, AnimatePresence } from "motion/react";
import { X, Image as ImageIcon, Code2, Video, PencilRuler } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";

/** Miniatura: solo título centrado */
function PreviewTitle() {
  return (
    <div className="w-full aspect-video bg-white border border-stone-200 rounded-lg overflow-hidden flex items-center justify-center p-1">
      <div className="w-3/4 h-2 bg-stone-300 rounded" />
    </div>
  );
}

/** Miniatura: contenido con panel (split) */
function PreviewContentSplit() {
  return (
    <div className="w-full aspect-video bg-white border border-stone-200 rounded-lg overflow-hidden flex p-0.5 gap-0.5">
      <div className="flex-1 flex flex-col gap-0.5">
        <div className="h-1.5 w-2/3 bg-stone-300 rounded" />
        <div className="h-1 w-full bg-stone-100 rounded" />
        <div className="h-1 w-full bg-stone-100 rounded" />
        <div className="h-1 w-4/5 bg-stone-100 rounded" />
      </div>
      <div className="w-1/3 bg-stone-100 rounded flex items-center justify-center">
        <div className="w-full aspect-square max-w-[80%] bg-stone-200 rounded" />
      </div>
    </div>
  );
}

/** Miniatura: contenido solo texto (título + zona de contenido visible) */
function PreviewContentFull() {
  return (
    <div className="w-full aspect-video bg-white border border-stone-200 rounded-lg overflow-hidden flex flex-col p-0.5 gap-1">
      <div className="h-1.5 w-2/3 bg-stone-300 rounded shrink-0" />
      <div className="h-1.5 w-full bg-stone-100 rounded shrink-0" />
      <div className="h-1.5 w-full bg-stone-100 rounded shrink-0" />
      <div className="h-1.5 w-4/5 bg-stone-100 rounded shrink-0" />
      <div className="h-1.5 w-3/4 bg-stone-100 rounded shrink-0" />
    </div>
  );
}

/** Miniatura: diagrama Excalidraw */
function PreviewDiagram() {
  return (
    <div className="w-full aspect-video bg-white border border-stone-200 rounded-lg overflow-hidden flex items-center justify-center p-1">
      <div className="w-full h-full border border-dashed border-stone-300 rounded flex items-center justify-center">
        <PencilRuler className="w-6 h-6 text-stone-400" />
      </div>
    </div>
  );
}

const TEMPLATES: {
  id: "title" | "content-split" | "content-full" | "diagram";
  label: string;
  Preview: () => JSX.Element;
}[] = [
  { id: "title", label: "Título", Preview: PreviewTitle },
  { id: "content-split", label: "Contenido (con panel)", Preview: PreviewContentSplit },
  { id: "content-full", label: "Contenido (solo texto)", Preview: PreviewContentFull },
  { id: "diagram", label: "Diagrama", Preview: PreviewDiagram },
];

export function SlideStylePanel() {
  const {
    currentSlide,
    slides,
    showSlideStylePanel,
    setShowSlideStylePanel,
    setCurrentSlideType,
    setCurrentSlideContentLayout,
    setCurrentSlideContentType,
  } = usePresentation();

  if (!showSlideStylePanel || !currentSlide || slides.length === 0) return null;

  const isTitle = currentSlide.type === "chapter";
  const isDiagram = currentSlide.type === "diagram";
  const isContentSplit =
    currentSlide.type === "content" && (currentSlide.contentLayout ?? "split") === "split";
  const isContentFull =
    currentSlide.type === "content" && currentSlide.contentLayout === "full";
  const contentType = currentSlide.contentType ?? "image";

  const getSelectedId = (): (typeof TEMPLATES)[number]["id"] => {
    if (isTitle) return "title";
    if (isDiagram) return "diagram";
    if (isContentFull) return "content-full";
    return "content-split";
  };
  const selectedId = getSelectedId();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-white border-b border-stone-200 shrink-0 overflow-hidden"
      >
        <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-stone-100">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Plantilla de la diapositiva
          </span>
          <button
            type="button"
            onClick={() => setShowSlideStylePanel(false)}
            className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
            title="Cerrar panel"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex gap-4 overflow-x-auto px-4 py-4 scroll-smooth snap-x snap-mandatory carousel-no-scrollbar">
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
                } else {
                  setCurrentSlideType("content");
                  setCurrentSlideContentLayout("full");
                }
              }}
              className={cn(
                "shrink-0 w-28 snap-start flex flex-col rounded-xl border-2 overflow-hidden transition-all",
                selectedId === id
                  ? "border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-50/50"
                  : "border-stone-200 bg-stone-50/30 hover:border-stone-300 hover:shadow-sm"
              )}
            >
              <div className="p-1.5 min-h-0">
                <Preview />
              </div>
              <div className="px-2 py-2 border-t border-stone-100 bg-white">
                <span
                  className={cn(
                    "text-xs font-medium block text-center truncate",
                    selectedId === id ? "text-emerald-700" : "text-stone-600"
                  )}
                >
                  {label}
                </span>
              </div>
            </button>
          ))}
        </div>
        {isContentSplit && (
          <div className="px-4 pb-3 pt-3 flex items-center gap-2 flex-wrap border-t border-stone-100">
            <span className="text-xs font-medium text-stone-500">Panel derecho:</span>
            {[
              { id: "image" as const, label: "Imagen", icon: ImageIcon },
              { id: "code" as const, label: "Código", icon: Code2 },
              { id: "video" as const, label: "Video", icon: Video },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setCurrentSlideContentType(id)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all",
                  contentType === id
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-stone-200 bg-white text-stone-500 hover:border-stone-300"
                )}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
