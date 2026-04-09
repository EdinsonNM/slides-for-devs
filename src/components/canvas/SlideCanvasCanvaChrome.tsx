import {
  Copy,
  MoreHorizontal,
  Pencil,
  RotateCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "../../utils/cn";
import type { ResizeCorner } from "./slideCanvasResize";

/** Marca el cromo flotante para ignorar clics en el lienzo del bloque. */
export const CANVAS_CHROME_DATA_ATTR = "data-slide-canvas-chrome";

const cornerCursor: Record<ResizeCorner, string> = {
  nw: "cursor-nwse-resize",
  ne: "cursor-nesw-resize",
  sw: "cursor-nesw-resize",
  se: "cursor-nwse-resize",
};

const toolbarIconBtn =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-stone-600 transition-colors hover:bg-emerald-50 hover:text-emerald-700 dark:text-stone-300 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300";

const transformCircle =
  "flex h-9 w-9 shrink-0 cursor-grab items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-md active:cursor-grabbing dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200";

export interface SlideCanvasCanvaChromeProps {
  /** Redimensionar desde una esquina (algoritmo esquina opuesta fija). */
  onResizeCorner: (corner: ResizeCorner, e: React.PointerEvent) => void;
  onRotatePointerDown: (e: React.PointerEvent) => void;
  showResize?: boolean;
  /** Cambia al mover/redimensionar el bloque para recolocar el toolbar (evita corte con `overflow-hidden` del slide). */
  layoutDigest?: string;
  toolbar?: {
    showAi?: boolean;
    onAi?: () => void;
    onEdit?: () => void;
    onDuplicate?: () => void;
    onDelete?: () => void;
    onBringForward?: () => void;
    onSendBackward?: () => void;
  };
}

/**
 * Marco de selección y acciones flotantes inspiradas en Canva (borde verde esmeralda, handles, barra tipo píldora).
 */
const APPROX_TOOLBAR_HEIGHT_PX = 46;
const TOOLBAR_EDGE_GAP_PX = 10;

type ToolbarPlacement = "above" | "below" | "inside";

export function SlideCanvasCanvaChrome({
  onResizeCorner,
  onRotatePointerDown,
  showResize = true,
  layoutDigest,
  toolbar,
}: SlideCanvasCanvaChromeProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [toolbarPlacement, setToolbarPlacement] =
    useState<ToolbarPlacement>("above");
  const moreRef = useRef<HTMLDivElement>(null);
  const chromeRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const close = (ev: MouseEvent) => {
      if (moreRef.current?.contains(ev.target as Node)) return;
      setMoreOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [moreOpen]);

  useLayoutEffect(() => {
    if (!toolbar) return;
    const root = chromeRootRef.current;
    if (!root) return;

    const measure = () => {
      const r = chromeRootRef.current;
      if (!r) return;
      const block = r.closest("[data-slide-canvas-el]") as HTMLElement | null;
      const slide = r.closest("#slide-container") as HTMLElement | null;
      if (!block || !slide) {
        setToolbarPlacement("inside");
        return;
      }
      const b = block.getBoundingClientRect();
      const s = slide.getBoundingClientRect();
      const h = APPROX_TOOLBAR_HEIGHT_PX + TOOLBAR_EDGE_GAP_PX;
      const spaceAbove = b.top - s.top;
      const spaceBelow = s.bottom - b.bottom;

      let next: ToolbarPlacement;
      if (spaceAbove >= h) {
        next = "above";
      } else if (spaceBelow >= h) {
        next = "below";
      } else {
        next = "inside";
      }
      setToolbarPlacement(next);
    };

    measure();
    const ro = new ResizeObserver(measure);
    const block = root.closest("[data-slide-canvas-el]") as HTMLElement | null;
    const slide = root.closest("#slide-container") as HTMLElement | null;
    if (block) ro.observe(block);
    if (slide) ro.observe(slide);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [toolbar, layoutDigest]);

  const stop = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const corners: ResizeCorner[] = ["nw", "ne", "sw", "se"];

  return (
    <div
      ref={chromeRootRef}
      className="pointer-events-none absolute inset-0 z-50"
      data-slide-canvas-chrome=""
    >
      {/* Borde de selección: más grueso que el hover (`SlideCanvasHoverOutline`). */}
      <div
        className="pointer-events-none absolute inset-0 rounded-sm ring-2 ring-emerald-600 ring-offset-0 dark:ring-emerald-500"
        aria-hidden
      />

      {/* Barra flotante superior */}
      {toolbar && (
        <div
          className={cn(
            "pointer-events-auto absolute left-1/2 z-[55] -translate-x-1/2",
            toolbarPlacement === "above" && "bottom-full mb-2",
            toolbarPlacement === "below" && "top-full mt-2",
            toolbarPlacement === "inside" && "top-2",
          )}
          data-slide-canvas-chrome=""
        >
          <div
            className={cn(
              "flex items-center gap-0.5 rounded-full border border-stone-200/90 bg-white/95 px-1.5 py-1 shadow-lg backdrop-blur-sm",
              "dark:border-stone-600 dark:bg-stone-900/95",
            )}
          >
            {toolbar.showAi && toolbar.onAi ? (
              <button
                type="button"
                className={cn(
                  toolbarIconBtn,
                  "gap-1 px-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-300",
                )}
                title="Pedir a la IA"
                onPointerDown={stop}
                onClick={() => toolbar.onAi?.()}
              >
                <Sparkles size={15} className="text-emerald-600 dark:text-emerald-400" />
                <span className="hidden sm:inline">IA</span>
              </button>
            ) : null}
            {toolbar.onEdit ? (
              <button
                type="button"
                className={toolbarIconBtn}
                title="Editar"
                onPointerDown={stop}
                onClick={() => toolbar.onEdit?.()}
              >
                <Pencil size={16} strokeWidth={2} />
              </button>
            ) : null}
            {toolbar.onDuplicate ? (
              <button
                type="button"
                className={toolbarIconBtn}
                title="Duplicar"
                onPointerDown={stop}
                onClick={() => toolbar.onDuplicate?.()}
              >
                <Copy size={16} strokeWidth={2} />
              </button>
            ) : null}
            {toolbar.onDelete ? (
              <button
                type="button"
                className={cn(toolbarIconBtn, "hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40")}
                title="Eliminar bloque"
                onPointerDown={stop}
                onClick={() => toolbar.onDelete?.()}
              >
                <Trash2 size={16} strokeWidth={2} />
              </button>
            ) : null}
            {(toolbar.onBringForward || toolbar.onSendBackward) && (
              <div className="relative" ref={moreRef}>
                <button
                  type="button"
                  className={toolbarIconBtn}
                  title="Más"
                  onPointerDown={stop}
                  onClick={() => setMoreOpen((o) => !o)}
                >
                  <MoreHorizontal size={16} strokeWidth={2} />
                </button>
                {moreOpen ? (
                  <div
                    className="absolute right-0 top-full z-40 mt-1 min-w-[160px] rounded-lg border border-stone-200 bg-white py-1 text-sm shadow-xl dark:border-stone-600 dark:bg-stone-900"
                    data-slide-canvas-chrome=""
                  >
                    {toolbar.onBringForward ? (
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left text-stone-700 hover:bg-stone-50 dark:text-stone-200 dark:hover:bg-stone-800"
                        onClick={() => {
                          toolbar.onBringForward?.();
                          setMoreOpen(false);
                        }}
                      >
                        Traer al frente
                      </button>
                    ) : null}
                    {toolbar.onSendBackward ? (
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left text-stone-700 hover:bg-stone-50 dark:text-stone-200 dark:hover:bg-stone-800"
                        onClick={() => {
                          toolbar.onSendBackward?.();
                          setMoreOpen(false);
                        }}
                      >
                        Enviar atrás
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Handles en las 4 esquinas */}
      {showResize
        ? corners.map((c) => (
            <button
              key={c}
              type="button"
              data-canvas-resize
              aria-label={`Redimensionar esquina ${c}`}
              className={cn(
                "pointer-events-auto absolute z-50 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-emerald-600 bg-white shadow-md dark:border-emerald-400 dark:bg-stone-100",
                cornerCursor[c],
                c === "nw" && "left-0 top-0",
                c === "ne" && "left-full top-0",
                c === "sw" && "left-0 top-full",
                c === "se" && "left-full top-full",
              )}
              data-slide-canvas-chrome=""
              onPointerDown={(e) => {
                stop(e);
                onResizeCorner(c, e);
              }}
            />
          ))
        : null}

      {/* Rotar debajo del bloque (mover = arrastrar el propio elemento) */}
      <div
        className={cn(
          "pointer-events-auto absolute left-1/2 top-full z-[60] flex -translate-x-1/2 justify-center",
          toolbar && toolbarPlacement === "below" ? "mt-[52px]" : "mt-2",
        )}
        data-slide-canvas-chrome=""
      >
        <button
          type="button"
          className={transformCircle}
          title="Rotar"
          aria-label="Rotar bloque"
          onPointerDown={(e) => {
            stop(e);
            onRotatePointerDown(e);
          }}
        >
          <RotateCw size={18} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
