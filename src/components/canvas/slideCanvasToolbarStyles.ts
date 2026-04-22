import { cn } from "../../utils/cn";

/** Fila tipo píldora de la barra del lienzo (Canva) — reutilizable en toolbars flotantes. */
export const slideCanvasToolbarPillRowClass = cn(
  "flex items-center gap-0.5 rounded-full border border-stone-200/90 bg-white/95 px-1.5 py-1 shadow-lg backdrop-blur-sm",
  "dark:border-stone-600 dark:bg-stone-900/95",
);

/** Botón icono redondo de la barra del lienzo. */
export const slideCanvasToolbarIconBtnClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-stone-600 transition-colors hover:bg-emerald-50 hover:text-emerald-700 dark:text-stone-300 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300";
