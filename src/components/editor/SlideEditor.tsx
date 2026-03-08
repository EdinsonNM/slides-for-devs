import { motion, AnimatePresence } from "motion/react";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";
import { SlideContentChapter } from "./SlideContentChapter";
import { SlideContentDefault } from "./SlideContentDefault";
import { SlideContentDiagram } from "./SlideContentDiagram";
import { NavigationControls } from "./NavigationControls";

export function SlideEditor() {
  const { currentSlide, currentIndex } = usePresentation();

  if (!currentSlide) return null;

  return (
    <section className="flex-1 flex flex-col p-6 min-w-0 relative overflow-hidden items-center justify-center bg-stone-200/50">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          id="slide-container"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          className={cn(
            "slide-content w-full max-w-5xl aspect-video bg-white shadow-2xl rounded-xl overflow-hidden flex relative border border-stone-200",
            currentSlide.type === "chapter" ? "justify-center items-center" : ""
          )}
        >
          {currentSlide.type === "chapter" ? (
            <SlideContentChapter />
          ) : currentSlide.type === "diagram" ? (
            <SlideContentDiagram />
          ) : (
            <SlideContentDefault />
          )}
        </motion.div>
      </AnimatePresence>

      <NavigationControls />
    </section>
  );
}
