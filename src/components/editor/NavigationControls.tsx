import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePresentation } from "../../presentation/contexts/PresentationContext";

export function NavigationControls() {
  const { currentIndex, slides, prevSlide, nextSlide } = usePresentation();

  return (
    <div className="mt-8 flex items-center gap-6">
      <button
        onClick={prevSlide}
        disabled={currentIndex === 0}
        className="w-12 h-12 rounded-full bg-white dark:bg-surface-elevated border border-stone-300 dark:border-border flex items-center justify-center text-stone-600 dark:text-foreground hover:bg-stone-50 dark:hover:bg-stone-700 disabled:opacity-30 transition-all shadow-sm"
      >
        <ChevronLeft size={24} />
      </button>
      <div className="px-4 py-2 bg-white dark:bg-surface-elevated border border-stone-300 dark:border-border rounded-full text-sm font-medium text-stone-600 dark:text-foreground shadow-sm">
        {currentIndex + 1} / {slides.length}
      </div>
      <button
        onClick={nextSlide}
        disabled={currentIndex === slides.length - 1}
        className="w-12 h-12 rounded-full bg-white dark:bg-surface-elevated border border-stone-300 dark:border-border flex items-center justify-center text-stone-600 dark:text-foreground hover:bg-stone-50 dark:hover:bg-stone-700 disabled:opacity-30 transition-all shadow-sm"
      >
        <ChevronRight size={24} />
      </button>
    </div>
  );
}
