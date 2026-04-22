import type { CSSProperties, ReactNode, RefObject } from "react";
import { cn } from "../../utils/cn";

type CanvaSelectionFrameProps = {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  /** Si es false, solo dimensiones sin marco (salvo handle de resize si aplica). */
  showChrome?: boolean;
  showResizeHandle?: boolean;
  widthPercent?: number;
  minHeightPx?: number;
  measureElRef?: RefObject<HTMLElement | null>;
  onResize?: (next: { widthPercent: number; minHeightPx: number }) => void;
  onResizePointerDown?: () => void;
  /** Acciones flotantes (p. ej. IA) debajo del marco, alineadas a la izquierda. */
  floatingActions?: ReactNode;
  /** `below`: bajo el marco. `bottom-left`: esquina inferior izquierda dentro del marco. */
  floatingActionsPlacement?: "below" | "bottom-left";
  /**
   * Ancho máximo en % respecto al elemento de `measureElRef` (por defecto 100).
   * Valores >100 permiten ensanchar hacia el panel derecho u espacio libre del slide.
   */
  resizeMaxWidthPercent?: number;
};

/** Altura máx. del marco al arrastrar (evita valores absurdos; antes 900px cortaba con espacio libre en la diapositiva). */
const MAX_MIN_HEIGHT_PX = 4000;

/** Handles circulares blancos estilo PowerPoint (vista sólo lectura visual). */
const handleDot =
  "pointer-events-none absolute z-10 h-2 w-2 rounded-full border border-stone-500 bg-white shadow-sm dark:border-stone-400 dark:bg-stone-100";

/**
 * Marco de selección estilo PowerPoint: borde discontinuo y anclas circulares.
 */
export function CanvaSelectionFrame({
  children,
  className,
  innerClassName,
  showChrome = true,
  showResizeHandle = false,
  widthPercent = 100,
  minHeightPx,
  measureElRef,
  onResize,
  onResizePointerDown,
  floatingActions,
  floatingActionsPlacement = "below",
  resizeMaxWidthPercent = 100,
}: CanvaSelectionFrameProps) {
  const resizeCapPct = Math.max(30, resizeMaxWidthPercent);
  const w = Math.min(resizeCapPct, Math.max(30, widthPercent));
  const style: CSSProperties = {
    width: `${w}%`,
    minWidth: 0,
    ...(minHeightPx != null && minHeightPx > 0
      ? { minHeight: minHeightPx }
      : {}),
  };

  const onResizeMouseDown = (e: React.MouseEvent) => {
    if (!onResize || !measureElRef?.current) return;
    onResizePointerDown?.();
    e.preventDefault();
    e.stopPropagation();
    const parent = measureElRef.current;
    const parentW = parent.getBoundingClientRect().width || 1;
    const startWpct = w;
    const startH = minHeightPx ?? 120;
    const startWpx = (startWpct / 100) * parentW;
    const startX = e.clientX;
    const startY = e.clientY;

    const maxWpx = parentW * (resizeCapPct / 100);
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const newWpx = Math.max(parentW * 0.3, Math.min(maxWpx, startWpx + dx));
      const newPct =
        Math.round((newWpx / parentW) * 1000) / 10;
      const newH = Math.round(
        Math.max(48, Math.min(MAX_MIN_HEIGHT_PX, startH + dy)),
      );
      onResize({ widthPercent: newPct, minHeightPx: newH });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const onVerticalResizeMouseDown = (e: React.MouseEvent) => {
    if (!onResize || !measureElRef?.current) return;
    onResizePointerDown?.();
    e.preventDefault();
    e.stopPropagation();
    const startWpct = w;
    const startH = minHeightPx ?? 120;
    const startY = e.clientY;

    const onMove = (ev: MouseEvent) => {
      const dy = ev.clientY - startY;
      const newH = Math.round(
        Math.max(48, Math.min(MAX_MIN_HEIGHT_PX, startH + dy)),
      );
      onResize({ widthPercent: startWpct, minHeightPx: newH });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const showDragHandle = Boolean(onResize && (showChrome || showResizeHandle));

  const floatingWrapClass =
    floatingActionsPlacement === "bottom-left"
      ? "pointer-events-none absolute left-2 bottom-2 z-40 flex justify-start"
      : "pointer-events-none absolute left-0 top-full z-40 mt-1.5 flex justify-start";

  const resizeHandleEl = showDragHandle ? (
    <button
      type="button"
      aria-label="Redimensionar bloque (ancho y alto)"
      className={cn(
        "absolute z-30 h-2.5 w-2.5 cursor-nwse-resize rounded-full border border-stone-600 bg-white shadow-md",
        "right-[-5px] bottom-[-5px] hover:border-stone-900 dark:border-stone-300 dark:bg-stone-100 dark:hover:border-white",
      )}
      onMouseDown={onResizeMouseDown}
    />
  ) : null;

  /** El punto central inferior es el que los usuarios esperan para «estirar» solo la altura; los demás vértices son decorativos. */
  const bottomCenterResizeEl = showDragHandle ? (
    <button
      type="button"
      aria-label="Redimensionar altura del bloque"
      className={cn(
        "absolute z-30 left-1/2 bottom-[-5px] h-2.5 w-2.5 -translate-x-1/2 cursor-ns-resize rounded-full border border-stone-600 bg-white shadow-md",
        "hover:border-stone-900 dark:border-stone-300 dark:bg-stone-100 dark:hover:border-white",
      )}
      onMouseDown={onVerticalResizeMouseDown}
    />
  ) : (
    <span
      className={cn(handleDot, "left-1/2 bottom-[-5px] -translate-x-1/2")}
      aria-hidden
    />
  );

  if (!showChrome) {
    return (
      <div
        className={cn("relative min-w-0 overflow-visible", className)}
        style={style}
        data-slide-selection-frame
      >
        <div className={cn("relative z-1 min-w-0", innerClassName)}>{children}</div>
        {resizeHandleEl}
        {floatingActions ? (
          <div className={floatingWrapClass}>
            <div className="pointer-events-auto">{floatingActions}</div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn("relative min-w-0 overflow-visible", className)}
      style={style}
      data-slide-selection-frame
    >
      {/* Borde discontinuo tipo PowerPoint */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-0 rounded-md",
          "border-2 border-dashed border-stone-600 dark:border-stone-400",
        )}
        aria-hidden
      />
      {/* Esquinas */}
      <span className={cn(handleDot, "left-[-5px] top-[-5px]")} aria-hidden />
      <span className={cn(handleDot, "right-[-5px] top-[-5px]")} aria-hidden />
      <span className={cn(handleDot, "left-[-5px] bottom-[-5px]")} aria-hidden />
      {!showDragHandle ? (
        <span className={cn(handleDot, "right-[-5px] bottom-[-5px]")} aria-hidden />
      ) : null}
      {/* Puntos medios de aristas */}
      <span
        className={cn(handleDot, "left-1/2 top-[-5px] -translate-x-1/2")}
        aria-hidden
      />
      {bottomCenterResizeEl}
      <span
        className={cn(handleDot, "left-[-5px] top-1/2 -translate-y-1/2")}
        aria-hidden
      />
      <span
        className={cn(handleDot, "right-[-5px] top-1/2 -translate-y-1/2")}
        aria-hidden
      />
      {resizeHandleEl}
      <div className={cn("relative z-1 min-w-0", innerClassName)}>
        {children}
      </div>
      {floatingActions ? (
        <div className={floatingWrapClass}>
          <div className="pointer-events-auto">{floatingActions}</div>
        </div>
      ) : null}
    </div>
  );
}
