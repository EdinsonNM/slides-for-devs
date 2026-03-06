import { useState, useEffect, useRef } from "react";
import { ChevronLeft, PanelLeftOpen, Trash2, Plus } from "lucide-react";
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
    deleteSlideAt,
    insertSlideAfter,
  } = usePresentation();

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    index: number;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      close();
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [contextMenu]);

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
      <div className="p-2 space-y-2 overflow-y-auto relative">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            onClick={() => {
              setContextMenu(null);
              setCurrentIndex(index);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY, index });
            }}
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
              {slide.type === "chapter" ? (
                <>
                  <span className="text-[10px] font-medium text-stone-900 line-clamp-2 text-center leading-tight flex-1 flex items-center justify-center px-0.5">
                    {slide.title}
                  </span>
                  <div className="flex justify-center gap-1">
                    <div className="h-0.5 w-3 bg-stone-200 rounded-full animate-pulse" />
                    <div className="h-0.5 w-8 bg-stone-200 rounded-full animate-pulse" />
                  </div>
                </>
              ) : (
                <div className="flex-1 flex gap-1 min-h-0">
                  <div className="flex-1 flex flex-col gap-0.5 min-w-0 min-h-0">
                    <span className="text-[10px] font-medium text-stone-900 line-clamp-2 text-left leading-tight">
                      {slide.title}
                    </span>
                    <div className="h-0.5 w-full max-w-[70%] bg-stone-100 rounded animate-pulse" />
                    <div className="h-0.5 w-full max-w-[85%] bg-stone-100 rounded animate-pulse" />
                    <div className="h-0.5 w-full max-w-[60%] bg-stone-100 rounded animate-pulse" />
                    <div className="h-0.5 w-full max-w-[75%] bg-stone-100 rounded animate-pulse" />
                    <div className="h-0.5 w-full max-w-[90%] bg-stone-100 rounded animate-pulse" />
                    <div className="h-0.5 w-10 bg-stone-100 rounded animate-pulse mt-auto" />
                  </div>
                  <div
                    className={cn(
                      "rounded shrink-0 overflow-hidden",
                      !slide.imageUrl && "bg-stone-100 animate-pulse",
                      !slide.imageUrl && slide.contentType === "code" && "bg-amber-100/80",
                      !slide.imageUrl && slide.contentType === "video" && "bg-sky-100/80"
                    )}
                    style={{ width: "36%" }}
                  >
                    {slide.imageUrl ? (
                      <img
                        src={slide.imageUrl}
                        alt=""
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {contextMenu !== null && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[180px] py-1 bg-white border border-stone-200 rounded-lg shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            type="button"
            onClick={() => {
              insertSlideAfter(contextMenu.index);
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-100 flex items-center gap-2"
          >
            <Plus size={14} />
            Añadir diapositiva después
          </button>
          <button
            type="button"
            onClick={() => {
              deleteSlideAt(contextMenu.index);
              setContextMenu(null);
            }}
            disabled={slides.length <= 1}
            className={cn(
              "w-full px-3 py-2 text-left text-sm flex items-center gap-2",
              slides.length <= 1
                ? "text-stone-400 cursor-not-allowed"
                : "text-red-700 hover:bg-red-50"
            )}
          >
            <Trash2 size={14} />
            Eliminar
          </button>
        </div>
      )}
    </aside>
  );
}
