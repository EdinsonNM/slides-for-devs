import { useState, useEffect, useRef, useLayoutEffect } from "react";
import {
  ChevronLeft,
  PanelLeftOpen,
  Trash2,
  Plus,
  Table2,
  GripVertical,
  Map,
  Network,
  Box,
} from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { SLIDE_TYPE } from "../../domain/entities";
import { cn } from "../../utils/cn";
import { IconButton } from "../shared/IconButton";
import { IsoStyleThreeDBadge } from "../shared/IsoStyleThreeDBadge";
import { SidebarSlideCanvasMiniPreview } from "./SidebarSlideCanvasMiniPreview";

const SIDEBAR_WIDTH = 256;

/** Índice de fila bajo clientY; compatible con huecos entre miniaturas (lista con gap). */
function slideRowIndexAtY(
  clientY: number,
  rowElements: (HTMLDivElement | null)[],
): number {
  const rects: { index: number; top: number; bottom: number }[] = [];
  for (let i = 0; i < rowElements.length; i++) {
    const el = rowElements[i];
    if (!el) continue;
    const r = el.getBoundingClientRect();
    rects.push({ index: i, top: r.top, bottom: r.bottom });
  }
  if (rects.length === 0) return 0;
  for (const row of rects) {
    if (clientY >= row.top && clientY < row.bottom) return row.index;
  }
  if (clientY < rects[0].top) return rects[0].index;
  return rects[rects.length - 1].index;
}

export function SlideSidebar() {
  const {
    slides,
    currentIndex,
    setCurrentIndex,
    isSidebarOpen,
    setIsSidebarOpen,
    deleteSlideAt,
    insertSlideAfter,
    moveSlide,
  } = usePresentation();

  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    index: number;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    rowRefs.current = rowRefs.current.slice(0, slides.length);
  }, [slides.length]);

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
      <aside className="hidden w-12 shrink-0 flex-col items-center border-r border-stone-200/90 bg-white py-3 md:flex dark:border-border dark:bg-surface-elevated">
        <IconButton
          variant="default"
          icon={<PanelLeftOpen size={20} />}
          aria-label="Mostrar diapositivas"
          title="Mostrar diapositivas"
          onClick={() => setIsSidebarOpen(true)}
          className="border-transparent text-muted-foreground hover:bg-stone-100 dark:hover:bg-white/10"
        />
      </aside>
    );
  }

  return (
    <aside
      className="hidden shrink-0 flex-col overflow-y-auto border-r border-stone-200/90 bg-white text-foreground md:flex dark:border-border dark:bg-surface-elevated"
      style={{ width: SIDEBAR_WIDTH }}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-stone-100 p-2 dark:border-border">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
          Diapositivas
        </span>
        <IconButton
          variant="default"
          icon={<ChevronLeft size={16} />}
          aria-label="Ocultar listado"
          title="Ocultar listado"
          onClick={() => setIsSidebarOpen(false)}
          className="border-transparent p-1.5 text-muted-foreground hover:bg-stone-100 hover:text-foreground dark:hover:bg-white/10"
        />
      </div>
      <div className="p-2 space-y-2 overflow-y-auto relative">
        {slides.map((slide, index) => {
          const isSelected = currentIndex === index;
          return (
            <div
              key={slide.id}
              ref={(el) => {
                rowRefs.current[index] = el;
              }}
              className={cn(
                "flex items-stretch shrink-0 rounded-md transition-[box-shadow,background-color,border-color,gap]",
                isSelected
                  ? "gap-0 overflow-hidden border-2 border-primary bg-primary/10 shadow-md shadow-primary/25 dark:bg-primary/16 dark:shadow-primary/30"
                  : "gap-0.5",
                dragOverIndex === index &&
                  dragSourceIndex !== null &&
                  dragSourceIndex !== index &&
                  "ring-2 ring-primary/40 ring-offset-1 ring-offset-white dark:ring-offset-surface-elevated",
                dragSourceIndex === index && "opacity-75",
              )}
            >
              <div
                className={cn(
                  "flex w-5 shrink-0 cursor-grab touch-none select-none items-center justify-center active:cursor-grabbing",
                  isSelected
                    ? "border-0 border-r border-primary/40 bg-primary/14 text-primary hover:bg-primary/18 hover:text-primary dark:bg-primary/25 dark:hover:bg-primary/30"
                    : "rounded-l-md border border-r-0 border-border bg-stone-50 text-stone-400 hover:bg-stone-100 hover:text-stone-600 dark:bg-stone-800/80 dark:text-stone-500 dark:hover:bg-stone-800 dark:hover:text-stone-300",
                )}
                aria-label="Arrastrar para reordenar"
                title="Arrastrar para reordenar"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  e.preventDefault();
                  e.stopPropagation();
                  const fromIndex = index;
                  const gripEl = e.currentTarget;
                  const pointerId = e.pointerId;
                  setDragSourceIndex(fromIndex);
                  setDragOverIndex(fromIndex);
                  try {
                    gripEl.setPointerCapture(pointerId);
                  } catch {
                    /* ignore */
                  }
                  const prevCursor = document.body.style.cursor;
                  document.body.style.cursor = "grabbing";

                  const onMove = (ev: PointerEvent) => {
                    ev.preventDefault();
                    const over = slideRowIndexAtY(ev.clientY, rowRefs.current);
                    setDragOverIndex((prev) => (prev === over ? prev : over));
                  };
                  const end = (ev: PointerEvent) => {
                    window.removeEventListener("pointermove", onMove);
                    window.removeEventListener("pointerup", end);
                    window.removeEventListener("pointercancel", end);
                    document.body.style.cursor = prevCursor;
                    try {
                      if (
                        ev.pointerId === pointerId &&
                        gripEl.hasPointerCapture(pointerId)
                      ) {
                        gripEl.releasePointerCapture(pointerId);
                      }
                    } catch {
                      /* ignore */
                    }
                    const toIndex = slideRowIndexAtY(
                      ev.clientY,
                      rowRefs.current,
                    );
                    setDragSourceIndex(null);
                    setDragOverIndex(null);
                    if (fromIndex !== toIndex) {
                      moveSlide(fromIndex, toIndex);
                    }
                  };

                  window.addEventListener("pointermove", onMove, {
                    passive: false,
                  });
                  window.addEventListener("pointerup", end);
                  window.addEventListener("pointercancel", end);
                }}
              >
                <GripVertical className="h-4 w-4" strokeWidth={2} aria-hidden />
              </div>
              <button
                type="button"
                onClick={() => {
                  setContextMenu(null);
                  setCurrentIndex(index);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ x: e.clientX, y: e.clientY, index });
                }}
                aria-current={isSelected ? "true" : undefined}
                className={cn(
                  "min-w-0 flex-1 aspect-video overflow-hidden relative group transition-all",
                  isSelected
                    ? "rounded-none border-0"
                    : "rounded-r-md border border-l-0 border-border hover:border-stone-400 dark:hover:border-stone-500",
                )}
              >
                <div className="absolute inset-0 bg-white dark:bg-surface-elevated p-1.5 flex flex-col">
                  <span className="text-[8px] uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-0.5">
                    {index + 1}
                  </span>
                  {slide.type === SLIDE_TYPE.CHAPTER ? (
                    <>
                      <span className="text-[10px] font-medium text-stone-900 dark:text-foreground line-clamp-2 text-center leading-tight flex-1 flex items-center justify-center px-0.5">
                        {slide.title}
                      </span>
                      <div className="flex justify-center gap-1">
                        <div className="h-0.5 w-3 bg-stone-200 dark:bg-stone-600 rounded-full animate-pulse" />
                        <div className="h-0.5 w-8 bg-stone-200 dark:bg-stone-600 rounded-full animate-pulse" />
                      </div>
                    </>
                  ) : slide.type === SLIDE_TYPE.DIAGRAM ? (
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
                      <span className="text-[7px] text-stone-400 dark:text-stone-500 uppercase tracking-wider shrink-0">
                        Diagrama
                      </span>
                    </div>
                  ) : slide.type === SLIDE_TYPE.ISOMETRIC ? (
                    <div className="flex-1 flex flex-col gap-1 min-h-0">
                      <span className="text-[9px] font-medium text-stone-900 dark:text-foreground line-clamp-1 text-left leading-tight shrink-0">
                        {slide.title || "Isométrico"}
                      </span>
                      <div className="flex-1 min-h-0 min-w-0">
                        <IsoStyleThreeDBadge compact />
                      </div>
                      <span className="text-[7px] text-stone-400 dark:text-stone-500 uppercase tracking-wider shrink-0">
                        Isométrico
                      </span>
                    </div>
                  ) : slide.type === SLIDE_TYPE.MATRIX ? (
                    <div className="flex-1 flex flex-col gap-1 min-h-0">
                      <span className="text-[9px] font-medium text-stone-900 dark:text-foreground line-clamp-1 text-left leading-tight shrink-0">
                        {slide.title || "Tabla"}
                      </span>
                      <div className="flex-1 min-h-0 grid grid-cols-3 gap-px rounded border border-stone-200 dark:border-stone-600 overflow-hidden bg-stone-200 dark:bg-stone-600">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div
                            key={i}
                            className="bg-stone-50 dark:bg-stone-800 min-h-[6px]"
                          />
                        ))}
                      </div>
                      <span className="text-[7px] text-stone-400 dark:text-stone-500 uppercase tracking-wider shrink-0 flex items-center gap-0.5">
                        <Table2 className="w-2.5 h-2.5" strokeWidth={2} />
                        Matriz
                      </span>
                    </div>
                  ) : slide.type === SLIDE_TYPE.MIND_MAP ? (
                    <div className="flex-1 flex flex-col gap-1 min-h-0">
                      <span className="text-[9px] font-medium text-stone-900 dark:text-foreground line-clamp-1 text-left leading-tight shrink-0">
                        {slide.title || "Mapa mental"}
                      </span>
                      <div className="flex-1 min-h-0 flex items-center justify-center rounded border border-dashed border-stone-200 bg-stone-100 dark:border-stone-600 dark:bg-background">
                        <Network className="w-5 h-5 text-emerald-600 dark:text-emerald-400" strokeWidth={1.5} />
                      </div>
                      <span className="text-[7px] text-stone-400 dark:text-stone-500 uppercase tracking-wider shrink-0">
                        Mapa mental
                      </span>
                    </div>
                  ) : slide.type === SLIDE_TYPE.MAPS ? (
                    <div className="flex-1 flex flex-col gap-1 min-h-0">
                      <span className="text-[9px] font-medium text-stone-900 dark:text-foreground line-clamp-1 text-left leading-tight shrink-0">
                        {slide.title || "Mapa"}
                      </span>
                      <div className="flex-1 min-h-0 flex items-center justify-center rounded border border-stone-200 bg-linear-to-br from-stone-100 to-stone-50 dark:border-stone-600 dark:from-surface dark:to-background">
                        <Map className="w-5 h-5 text-emerald-700 dark:text-emerald-400" strokeWidth={1.5} />
                      </div>
                      <span className="text-[7px] text-stone-400 dark:text-stone-500 uppercase tracking-wider shrink-0">
                        Mapas
                      </span>
                    </div>
                  ) : slide.type === SLIDE_TYPE.CANVAS_3D ? (
                    <div className="flex min-h-0 flex-1 flex-col gap-1">
                      <span className="shrink-0 text-left text-[9px] font-medium leading-tight text-stone-900 line-clamp-1 dark:text-foreground">
                        {slide.title || "Canvas 3D"}
                      </span>
                      <div className="flex min-h-0 flex-1 items-center justify-center rounded border border-stone-200 bg-linear-to-br from-slate-900 to-violet-950 dark:border-stone-600">
                        <Box
                          className="size-5 text-violet-200"
                          strokeWidth={1.5}
                          aria-hidden
                        />
                      </div>
                      <span className="shrink-0 text-[7px] uppercase tracking-wider text-stone-400 dark:text-stone-500">
                        Canvas 3D
                      </span>
                    </div>
                  ) : slide.type === SLIDE_TYPE.CONTENT ? (
                    <div className="flex-1 min-h-0 min-w-0">
                      <SidebarSlideCanvasMiniPreview slide={slide} />
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center px-1">
                      <span className="text-[9px] font-medium text-stone-500 dark:text-stone-400 line-clamp-3 text-center leading-tight">
                        {slide.title || "—"}
                      </span>
                    </div>
                  )}
                </div>
              </button>
            </div>
          );
        })}
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
                : "text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30",
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
