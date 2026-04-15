import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";
import { SLIDE_LAYOUT_TEMPLATE_REGISTRY } from "../../domain/slideTemplates/slideLayoutTemplates.registry";
import { inferSlideLayoutTemplateId } from "../../domain/slideTemplates/inferSlideLayoutTemplateId";
import { applySlideLayoutTemplate } from "../../domain/slideTemplates/slideLayoutTemplateApply";
import { DECK_THEME_PRESETS } from "../../constants/deckVisualThemes";

interface SlideStylePanelProps {
  variant?: "toolbar" | "inspector";
}

export function SlideStylePanel({ variant = "toolbar" }: SlideStylePanelProps) {
  const {
    currentSlide,
    slides,
    deckVisualTheme,
    applyDeckVisualTheme,
    showSlideStylePanel,
    setShowSlideStylePanel,
    setCurrentSlideType,
    setCurrentSlideContentLayout,
  } = usePresentation();

  const visible = variant === "inspector" || showSlideStylePanel;
  if (!visible || !currentSlide || slides.length === 0) return null;

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

  const deckPresetSwatch = (tid: string) => {
    const p = DECK_THEME_PRESETS.find((x) => x.id === tid)?.theme;
    if (!p) return <div className="h-7 w-10 rounded-md bg-stone-200 dark:bg-stone-600" />;
    if (p.backgroundKind === "solid") {
      return (
        <div
          className="h-7 w-10 rounded-md border border-stone-200 dark:border-stone-600"
          style={{ backgroundColor: p.solidColor ?? "#fff" }}
        />
      );
    }
    if (p.backgroundKind === "gradient") {
      return (
        <div
          className="h-7 w-10 rounded-md border border-stone-200/80 dark:border-stone-600"
          style={{
            backgroundImage: `linear-gradient(135deg, ${p.gradientFrom}, ${p.gradientTo})`,
          }}
        />
      );
    }
    return (
      <div
        className="h-7 w-10 rounded-md border border-stone-300 dark:border-stone-600"
        style={{
          backgroundImage: `linear-gradient(135deg, #020617, #0e7490, #312e81)`,
        }}
      />
    );
  };

  const deckThemesRow = (
    <div
      className={cn(
        "flex flex-col gap-2 border-b px-3 py-3",
        variant === "inspector"
          ? "border-stone-100 dark:border-border"
          : "border-stone-100 dark:border-border",
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
        Fondo del deck
      </span>
      <div className="flex flex-wrap gap-2">
        {DECK_THEME_PRESETS.map((p) => {
          const active = deckVisualTheme.presetId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => void applyDeckVisualTheme(p.theme)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs font-medium transition-all",
                active
                  ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/25 dark:bg-emerald-950/40 dark:ring-emerald-400/20"
                  : "border-stone-200 bg-stone-50/80 hover:border-stone-300 dark:border-border dark:bg-stone-800/50 dark:hover:border-stone-500",
              )}
            >
              {deckPresetSwatch(p.id)}
              <span
                className={cn(
                  active
                    ? "text-emerald-800 dark:text-emerald-200"
                    : "text-stone-700 dark:text-stone-200",
                )}
              >
                {p.label}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] leading-snug text-stone-500 dark:text-muted-foreground">
        El vídeo exportado usa un fondo estático equivalente (sin animación WebGL).
      </p>
    </div>
  );

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

  if (variant === "inspector") {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-white dark:bg-surface-elevated">
        {header}
        {deckThemesRow}
        {templatesRow}
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
        {deckThemesRow}
        {templatesRow}
      </motion.div>
    </AnimatePresence>
  );
}
