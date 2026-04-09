import { motion, AnimatePresence } from "motion/react";
import { X, Image as ImageIcon, Code2, Video, Smartphone } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";
import { ContentPanelProperties } from "./ContentPanelProperties";
import { SLIDE_LAYOUT_TEMPLATE_REGISTRY } from "../../domain/slideTemplates/slideLayoutTemplates.registry";
import { inferSlideLayoutTemplateId } from "../../domain/slideTemplates/inferSlideLayoutTemplateId";
import { applySlideLayoutTemplate } from "../../domain/slideTemplates/slideLayoutTemplateApply";
import { SLIDE_TYPE } from "../../domain/entities";

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

  const isContentSplit =
    currentSlide.type === SLIDE_TYPE.CONTENT &&
    (currentSlide.contentLayout ?? "split") === "split";
  const isContentFull =
    currentSlide.type === SLIDE_TYPE.CONTENT && currentSlide.contentLayout === "full";
  const isContentPanelFull =
    currentSlide.type === SLIDE_TYPE.CONTENT && currentSlide.contentLayout === "panel-full";
  const contentType = currentSlide.contentType ?? "image";

  const selectedId = inferSlideLayoutTemplateId(currentSlide);

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

  const applyApi = {
    setCurrentSlideType,
    setCurrentSlideContentLayout,
  };

  const templatesRow = (
    <div
      className={cn(
        "flex gap-3 overflow-x-auto px-3 py-3 scroll-smooth snap-x snap-mandatory carousel-no-scrollbar",
        variant === "inspector" && "flex-wrap",
      )}
    >
      {SLIDE_LAYOUT_TEMPLATE_REGISTRY.map(({ id, label, Preview }) => (
        <button
          key={id}
          type="button"
          onClick={() => applySlideLayoutTemplate(id, applyApi)}
          className={cn(
            "shrink-0 w-28 snap-start flex flex-col rounded-xl border-2 overflow-hidden transition-all",
            selectedId === id
              ? "border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-900/30"
              : "border-stone-200 dark:border-border bg-stone-50/30 dark:bg-stone-800/50 hover:border-stone-300 dark:hover:border-stone-600 hover:shadow-sm",
          )}
        >
          <div className="p-1.5 min-h-0">
            <Preview />
          </div>
          <div className="px-2 py-2 border-t border-stone-100 dark:border-border bg-white dark:bg-surface">
            <span
              className={cn(
                "text-xs font-medium block text-center truncate",
                selectedId === id
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-stone-600 dark:text-stone-300",
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
