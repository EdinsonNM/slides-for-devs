import { ChevronLeft, PanelLeftOpen } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";

const SIDEBAR_WIDTH = 256;

export function SlideSidebar() {
  const {
    slides,
    currentIndex,
    setCurrentIndex,
    isSidebarOpen,
    setIsSidebarOpen,
  } = usePresentation();

  if (!isSidebarOpen) {
    return (
      <aside className="w-12 bg-stone-100 border-r border-stone-300 shrink-0 flex flex-col items-center py-3 hidden md:flex">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 rounded-md text-stone-500 hover:bg-stone-200 hover:text-stone-700 transition-colors"
          title="Mostrar diapositivas"
        >
          <PanelLeftOpen size={20} />
        </button>
      </aside>
    );
  }

  return (
    <aside
      className="bg-stone-100 border-r border-stone-300 overflow-y-auto shrink-0 hidden md:flex flex-col"
      style={{ width: SIDEBAR_WIDTH }}
    >
      <div className="p-2 flex items-center justify-between border-b border-stone-200 shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 px-1">
          Diapositivas
        </span>
        <button
          onClick={() => setIsSidebarOpen(false)}
          className="p-1.5 rounded-md text-stone-400 hover:bg-stone-200 hover:text-stone-600 transition-colors"
          title="Ocultar listado"
        >
          <ChevronLeft size={16} />
        </button>
      </div>
      <div className="p-2 space-y-2 overflow-y-auto">
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
            <div className="absolute inset-0 bg-white p-1.5 flex flex-col">
              <span className="text-[8px] uppercase tracking-widest text-stone-400 mb-0.5">
                {index + 1}
              </span>
              <span className="text-[10px] font-medium text-stone-900 line-clamp-2 text-left leading-tight">
                {slide.title}
              </span>
              <div className="mt-auto flex gap-1">
                <div className="h-0.5 w-6 bg-stone-200 rounded-full" />
                <div className="h-0.5 w-3 bg-stone-200 rounded-full" />
              </div>
            </div>
            {slide.imageUrl && (
              <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors" />
            )}
          </button>
        ))}
      </div>
    </aside>
  );
}
