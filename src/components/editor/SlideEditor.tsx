import { motion, AnimatePresence } from "motion/react";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";
import { SlideCanvasSlide } from "../canvas/SlideCanvasSlide";

export function SlideEditor() {
  const { currentSlide, currentIndex } = usePresentation();

  if (!currentSlide) return null;

  return (
    <section 
      className="relative flex min-w-0 flex-1 flex-col items-center justify-center overflow-hidden bg-stone-200/50 p-3 pb-24 md:p-4 lg:p-6 dark:bg-stone-900/60"
      onPointerDown={(e) => {
        const t = e.target as HTMLElement;
        if (!t.closest(".slide-content")) {
          document.dispatchEvent(new CustomEvent("slide:dismissCanvasSelection"));
        }
      }}
    >
      <div className="slide-editor-canvas-wrap flex w-full max-w-5xl flex-col items-stretch gap-1">
        <div className="shrink-0 self-start px-0.5">
          <span
            className="font-bold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400"
            style={{ fontSize: "var(--slide-section-out-label)" }}
          >
            Sección {currentIndex + 1}
          </span>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            className={cn(
              /* `overflow-visible`: la barra del cromo Canva (`bottom-full` / `top-full`) y
               * overlays del lienzo no deben recortarse por el borde de la tarjeta del slide. */
              "slide-content relative flex aspect-video w-full overflow-visible rounded-lg border border-stone-200/90 bg-white dark:border-border dark:bg-surface-elevated",
            )}
          >
            <SlideCanvasSlide />
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
