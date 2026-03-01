import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";

export function SlideSidebar() {
  const { slides, currentIndex, setCurrentIndex } = usePresentation();

  return (
    <aside className="w-64 bg-stone-100 border-r border-stone-300 overflow-y-auto p-4 space-y-4 hidden md:block shrink-0">
      {slides.map((slide, index) => (
        <button
          key={slide.id}
          onClick={() => setCurrentIndex(index)}
          className={cn(
            "w-full aspect-video rounded-lg border-2 transition-all overflow-hidden relative group shrink-0",
            currentIndex === index
              ? "border-emerald-600 ring-2 ring-emerald-500/20"
              : "border-stone-300 hover:border-stone-400"
          )}
        >
          <div className="absolute inset-0 bg-white p-2 flex flex-col">
            <span className="text-[8px] uppercase tracking-widest text-stone-400 mb-1">
              Slide {index + 1}
            </span>
            <span className="text-[10px] font-medium text-stone-900 line-clamp-2 text-left leading-tight">
              {slide.title}
            </span>
            <div className="mt-auto flex gap-1">
              <div className="h-1 w-8 bg-stone-200 rounded-full" />
              <div className="h-1 w-4 bg-stone-200 rounded-full" />
            </div>
          </div>
          {slide.imageUrl && (
            <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors" />
          )}
        </button>
      ))}
    </aside>
  );
}
