import type { LucideIcon } from "lucide-react";
import { cn } from "../../utils/cn";

const SKEW = "skewX(-16deg)";

function threeBars(compact: boolean) {
  const left = compact
    ? "h-1.5 w-2 rounded-[0.5px] bg-sky-400/80 dark:bg-sky-600"
    : "h-2 w-2.5 rounded-[1px] bg-sky-400/80 dark:bg-sky-600";
  const mid = compact
    ? "z-[1] h-2 w-2 rounded-[0.5px] bg-emerald-500/90 dark:bg-emerald-600"
    : "z-[1] h-2.5 w-2.5 rounded-[1px] bg-emerald-500/90 dark:bg-emerald-600";
  const right = compact
    ? "h-1.5 w-2 rounded-[0.5px] bg-amber-400/80 dark:bg-amber-600"
    : "h-2 w-2.5 rounded-[1px] bg-amber-400/80 dark:bg-amber-600";
  return (
    <>
      <div className={left} style={{ transform: SKEW }} />
      <div className={mid} style={{ transform: SKEW }} />
      <div className={right} style={{ transform: SKEW }} />
    </>
  );
}

export interface IsoStyleThreeDBadgeProps {
  /** Si se pasa, se superpone al centro sobre las tres barras (p. ej. Smartphone, Cuboid). */
  Icon?: LucideIcon;
  compact?: boolean;
  /** Sin borde punteado (p. ej. bloque isométrico dentro del lienzo en miniatura). */
  borderless?: boolean;
  className?: string;
  iconClassName?: string;
}

/**
 * Fondo tipo “infra isométrica”: tres paralelogramos (cielo / esmeralda / ámbar) como en el listado de isométricas.
 * Opcionalmente un icono centrado (Presentador 3D, Canvas 3D, etc.).
 */
export function IsoStyleThreeDBadge({
  Icon,
  compact = false,
  borderless = false,
  className,
  iconClassName,
}: IsoStyleThreeDBadgeProps) {
  const shell = cn(
    "h-full w-full min-h-0 min-w-0 overflow-hidden bg-linear-to-br from-sky-50 to-stone-50 dark:from-sky-950/40 dark:to-stone-800",
    borderless ? "rounded-sm" : "rounded border border-dashed border-stone-200 dark:border-stone-600",
    className,
  );

  const row = threeBars(compact);

  if (!Icon) {
    return (
      <div
        className={cn(
          shell,
          "flex items-center justify-center",
          compact ? "gap-px p-0.5" : "gap-0.5 p-1",
        )}
      >
        {row}
      </div>
    );
  }

  return (
    <div className={cn(shell, "relative flex items-center justify-center")}>
      <div
        className={cn(
          "pointer-events-none absolute inset-0 flex items-center justify-center",
          compact ? "gap-px p-0.5" : "gap-0.5 p-1",
        )}
        aria-hidden
      >
        {row}
      </div>
      <Icon
        className={cn(
          "relative z-10 shrink-0 text-stone-800/95 drop-shadow-sm dark:text-stone-100/95",
          compact ? "h-2 w-2" : "h-4 w-4",
          iconClassName,
        )}
        strokeWidth={compact ? 1.5 : 1.75}
        aria-hidden
      />
    </div>
  );
}
