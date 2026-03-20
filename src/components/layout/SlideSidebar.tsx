import { useState, useEffect, useRef } from "react";
import { ChevronLeft, PanelLeftOpen, Trash2, Plus, Image as ImageIcon } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";
import { IconButton } from "../shared/IconButton";

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
      <aside className="w-12 bg-stone-100 dark:bg-surface border-r border-stone-300 dark:border-border shrink-0 flex flex-col items-center py-3 hidden md:flex">
        <IconButton
          variant="default"
          icon={<PanelLeftOpen size={20} />}
          aria-label="Mostrar diapositivas"
          title="Mostrar diapositivas"
          onClick={() => setIsSidebarOpen(true)}
          className="hover:bg-stone-200 dark:hover:bg-surface-elevated"
        />
      </aside>
    );
  }

  return (
    <aside
      className="bg-stone-100 dark:bg-surface border-r border-stone-300 dark:border-border overflow-y-auto shrink-0 hidden md:flex flex-col"
      style={{ width: SIDEBAR_WIDTH }}
    >
      <div className="p-2 flex items-center justify-between border-b border-stone-200 dark:border-border shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 dark:text-muted-foreground px-1">
          Diapositivas
        </span>
        <IconButton
          variant="default"
          icon={<ChevronLeft size={16} />}
          aria-label="Ocultar listado"
          title="Ocultar listado"
          onClick={() => setIsSidebarOpen(false)}
          className="p-1.5 hover:bg-stone-200 dark:hover:bg-surface-elevated text-stone-400 hover:text-stone-600 dark:hover:text-foreground"
        />
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
                ? "border-emerald-600 dark:border-emerald-500 ring-2 ring-emerald-500/20 dark:ring-emerald-500/30"
                : "border-stone-300 dark:border-stone-600 hover:border-stone-400 dark:hover:border-stone-500"
            )}
          >
            <div className="absolute inset-0 bg-white dark:bg-surface-elevated p-1.5 flex flex-col">
              <span className="text-[8px] uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-0.5">
                {index + 1}
              </span>
              {slide.type === "chapter" ? (
                <>
                  <span className="text-[10px] font-medium text-stone-900 dark:text-foreground line-clamp-2 text-center leading-tight flex-1 flex items-center justify-center px-0.5">
                    {slide.title}
                  </span>
                  <div className="flex justify-center gap-1">
                    <div className="h-0.5 w-3 bg-stone-200 dark:bg-stone-600 rounded-full animate-pulse" />
                    <div className="h-0.5 w-8 bg-stone-200 dark:bg-stone-600 rounded-full animate-pulse" />
                  </div>
                </>
              ) : slide.type === "diagram" ? (
                <div className="flex-1 flex flex-col gap-1 min-h-0">
                  <span className="text-[9px] font-medium text-stone-900 dark:text-foreground line-clamp-1 text-left leading-tight shrink-0">
                    {slide.title || "Diagrama"}
                  </span>
                  <div className="flex-1 min-h-0 flex items-center justify-center p-1 bg-stone-50 dark:bg-stone-800 rounded border border-dashed border-stone-200 dark:border-stone-600">
                    <div className="flex items-center gap-0.5 w-full justify-center">
                      <div className="w-3 h-2.5 rounded-sm bg-stone-200/80 dark:bg-stone-600 shrink-0" />
                      <div className="w-1 h-0.5 bg-stone-300 dark:bg-stone-500 rounded-full shrink-0" />
                      <div className="w-2.5 h-2.5 rounded-full border border-stone-300 dark:border-stone-500 shrink-0" />
                      <div className="w-1 h-0.5 bg-stone-300 dark:bg-stone-500 rounded-full shrink-0" />
                      <div className="w-3 h-2 rounded-sm bg-stone-200/80 dark:bg-stone-600 shrink-0" />
                    </div>
                  </div>
                  <span className="text-[7px] text-stone-400 dark:text-stone-500 uppercase tracking-wider shrink-0">Diagrama</span>
                </div>
              ) : slide.contentLayout === "panel-full" ? (
                <div className="flex-1 flex flex-col gap-0.5 min-h-0">
                  <span className="text-[9px] font-medium text-stone-900 dark:text-foreground line-clamp-1 text-left leading-tight shrink-0">
                    {slide.title || "Título + panel"}
                  </span>
                  <div className="h-0.5 w-3/4 bg-stone-300 dark:bg-stone-600 rounded shrink-0" />
                  <div className="flex-1 min-h-0 rounded border border-dashed border-stone-300 dark:border-stone-600 flex items-center justify-center bg-stone-50 dark:bg-stone-800 p-0.5">
                    {slide.imageUrl ? (
                      <img
                        src={slide.imageUrl}
                        alt=""
                        className="w-full h-full object-cover rounded"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-stone-400 dark:text-stone-500" strokeWidth={1.5} />
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex gap-1 min-h-0">
                  <div className="flex-1 flex flex-col gap-0.5 min-w-0 min-h-0">
                    <span className="text-[10px] font-medium text-stone-900 dark:text-foreground line-clamp-2 text-left leading-tight">
                      {slide.title}
                    </span>
                    <div className="h-0.5 w-full max-w-[70%] bg-stone-100 dark:bg-stone-700 rounded animate-pulse" />
                    <div className="h-0.5 w-full max-w-[85%] bg-stone-100 dark:bg-stone-700 rounded animate-pulse" />
                    <div className="h-0.5 w-full max-w-[60%] bg-stone-100 dark:bg-stone-700 rounded animate-pulse" />
                    <div className="h-0.5 w-full max-w-[75%] bg-stone-100 dark:bg-stone-700 rounded animate-pulse" />
                    <div className="h-0.5 w-full max-w-[90%] bg-stone-100 dark:bg-stone-700 rounded animate-pulse" />
                    <div className="h-0.5 w-10 bg-stone-100 dark:bg-stone-700 rounded animate-pulse mt-auto" />
                  </div>
                  <div
                    className={cn(
                      "rounded shrink-0 overflow-hidden",
                      !slide.imageUrl && "bg-stone-100 dark:bg-stone-700 animate-pulse",
                      !slide.imageUrl && slide.contentType === "code" && "bg-amber-100/80 dark:bg-amber-900/40",
                      !slide.imageUrl && slide.contentType === "video" && "bg-sky-100/80 dark:bg-sky-900/40",
                      !slide.imageUrl &&
                        slide.contentType === "presenter3d" &&
                        "bg-violet-100/80 dark:bg-violet-900/40"
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
          className="fixed z-50 min-w-[180px] py-1 bg-white dark:bg-surface-elevated border border-stone-200 dark:border-border rounded-lg shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            type="button"
            onClick={() => {
              insertSlideAfter(contextMenu.index);
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left text-sm text-stone-700 dark:text-foreground hover:bg-stone-100 dark:hover:bg-surface flex items-center gap-2"
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
                ? "text-stone-400 dark:text-stone-500 cursor-not-allowed"
                : "text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
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
