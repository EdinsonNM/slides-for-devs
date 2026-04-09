import { motion, AnimatePresence } from "motion/react";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";
import { SlideContentChapter } from "./SlideContentChapter";
import { SlideContentDefault } from "./SlideContentDefault";
import { SlideContentDiagram } from "./SlideContentDiagram";
import { SlideContentMatrix } from "./SlideContentMatrix";
import { SLIDE_TYPE } from "../../domain/entities";

export function SlideEditor() {
  const { currentSlide, currentIndex, diagramRemountToken } = usePresentation();

  if (!currentSlide) return null;

  return (
    <section className="relative flex min-w-0 flex-1 flex-col items-center justify-center overflow-hidden bg-stone-200/50 p-3 pb-24 md:p-4 lg:p-6 dark:bg-stone-900/60">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          id="slide-container"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          className={cn(
            "slide-content relative flex aspect-video w-full max-w-5xl overflow-hidden rounded-lg border border-stone-200/90 bg-white shadow-md shadow-stone-900/5 ring-1 ring-stone-900/[0.04] dark:border-border dark:bg-surface-elevated dark:shadow-xl dark:ring-white/10",
            currentSlide.type === SLIDE_TYPE.CHAPTER
              ? "justify-center items-center"
              : "",
          )}
        >
          {currentSlide.type === SLIDE_TYPE.CHAPTER ? (
            <SlideContentChapter />
          ) : currentSlide.type === SLIDE_TYPE.DIAGRAM ? (
            <SlideContentDiagram
              key={`${currentSlide.id}-${diagramRemountToken}`}
            />
          ) : currentSlide.type === SLIDE_TYPE.MATRIX ? (
            <SlideContentMatrix />
          ) : (
            <SlideContentDefault />
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
