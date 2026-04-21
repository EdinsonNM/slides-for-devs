import { cn } from "./cn";
import type { DeckContentTone } from "../domain/entities";

/** Contenedor 16:9: color base y hints para descendientes. */
export function deckSlideContentWrapperClass(tone: DeckContentTone): string {
  if (tone === "light") {
    return cn(
      "text-slate-100",
      "[&_.prose]:text-slate-200",
      "[&_textarea]:text-slate-100 [&_textarea]:placeholder:text-slate-500",
      /* No pisar el editor de código del lienzo (`data-code-panel`). */
      "[&_[data-code-panel]_textarea]:text-inherit [&_[data-code-panel]_textarea]:placeholder:text-inherit",
      "[&_input]:text-slate-100 [&_input]:placeholder:text-slate-500",
    );
  }
  return cn(
    "text-stone-900",
    "[&_.prose]:text-stone-700",
    "[&_textarea]:text-stone-900 [&_textarea]:placeholder:text-stone-400",
    /* En app `dark`, el fondo del slide puede alinearse a `--color-surface` (DeckBackdrop).
     * `dark:text-stone-100` en el textarea pierde a veces frente a `[&_textarea]:text-stone-900`
     * del padre; repetimos el color en el selector del wrapper para igualar títulos (h2). */
    "dark:[&_textarea]:text-stone-100 dark:[&_textarea]:placeholder:text-stone-500",
    "[&_[data-code-panel]_textarea]:text-inherit [&_[data-code-panel]_textarea]:placeholder:text-inherit",
    "dark:[&_[data-code-panel]_textarea]:text-inherit dark:[&_[data-code-panel]_textarea]:placeholder:text-inherit",
    "[&_input]:text-stone-900 [&_input]:placeholder:text-stone-400",
    "dark:[&_input]:text-stone-100 dark:[&_input]:placeholder:text-stone-500",
  );
}

export function deckSectionLabelClass(tone: DeckContentTone): string {
  return tone === "light"
    ? "text-emerald-300"
    : "text-emerald-600 dark:text-emerald-400";
}

/** Títulos y cuerpo principal (alto contraste sobre el fondo del deck). */
export function deckPrimaryTextClass(tone: DeckContentTone): string {
  return tone === "light"
    ? "text-slate-50"
    : "text-stone-900 dark:text-stone-100";
}

export function deckMutedTextClass(tone: DeckContentTone): string {
  return tone === "light"
    ? "text-slate-400"
    : "text-stone-400 dark:text-stone-500";
}

/** Subtítulo capítulo (centrado, más apagado). */
export function deckChapterSubtitleHintClass(tone: DeckContentTone): string {
  return tone === "light"
    ? "text-slate-400"
    : "text-stone-400 dark:text-stone-400";
}

/** Título / subtítulo en modo edición (textarea). */
export function deckTitleTextareaClass(
  tone: DeckContentTone,
  opts?: { center?: boolean },
): string {
  return cn(
    "field-sizing-content box-border min-h-11 w-full min-w-0 resize-none overflow-hidden rounded-md border-0 bg-transparent font-serif italic leading-tight shadow-none focus:outline-none focus:ring-0 whitespace-pre-wrap wrap-break-word [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
    deckPrimaryTextClass(tone),
    tone === "light"
      ? "placeholder:text-slate-500"
      : "placeholder:text-stone-400 dark:placeholder:text-stone-500",
    opts?.center && "text-center",
  );
}

export function deckSubtitleTextareaClass(
  tone: DeckContentTone,
  opts?: { center?: boolean },
): string {
  return cn(
    "box-border min-h-18 w-full min-w-0 resize-y rounded-md border-0 bg-transparent shadow-none focus:outline-none focus:ring-0 whitespace-pre-wrap wrap-break-word",
    deckPrimaryTextClass(tone),
    tone === "light"
      ? "placeholder:text-slate-500"
      : "placeholder:text-stone-400 dark:placeholder:text-stone-500",
    opts?.center && "text-center font-light tracking-wide",
  );
}

export function deckMarkdownBodyTextareaClass(tone: DeckContentTone): string {
  return cn(
    "min-h-0 flex-1 resize-none rounded-lg border-0 bg-transparent font-sans text-base leading-relaxed focus:outline-none focus:ring-0 md:text-lg",
    deckPrimaryTextClass(tone),
    tone === "light"
      ? "placeholder:text-slate-500"
      : "placeholder:text-stone-400 dark:placeholder:text-stone-500",
  );
}

/** Botón flotante “replantear con IA” (markdown). */
export function deckRewriteActionBtnClass(tone: DeckContentTone): string {
  return tone === "light"
    ? "absolute bottom-2 left-3 z-10 flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-slate-900/80 text-slate-100 shadow-lg backdrop-blur-sm hover:bg-slate-800/90"
    : "absolute bottom-2 left-3 z-10 flex h-9 w-9 items-center justify-center rounded-lg border border-stone-700/30 bg-stone-900 text-white shadow-lg hover:bg-stone-800 dark:border-stone-300/40 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white";
}

/** Barra superior del panel de medios (arrastre). */
export function deckMediaPanelDragStripClass(tone: DeckContentTone): string {
  return tone === "light"
    ? "z-[25] flex h-9 shrink-0 cursor-grab touch-none items-center gap-2 border-b border-white/15 bg-slate-950/80 px-2 text-[11px] font-medium text-slate-200 shadow-inner backdrop-blur-md select-none active:cursor-grabbing"
    : "z-[25] flex h-9 shrink-0 cursor-grab touch-none items-center gap-2 border-b border-stone-200 bg-stone-100/95 px-2 text-[11px] font-medium text-stone-600 select-none active:cursor-grabbing dark:border-border dark:bg-stone-900/95 dark:text-stone-300";
}

export function deckMediaPanelShellClass(tone: DeckContentTone): string {
  return tone === "light"
    ? "bg-slate-950/45 backdrop-blur-md"
    : "bg-white dark:bg-surface-elevated";
}

/** Iconos de la barra IA (sparkles, dividir, vídeo). */
export function deckIaToolbarBtnClass(tone: DeckContentTone): string {
  return tone === "light"
    ? "p-1.5 rounded-md text-slate-300 transition-colors hover:bg-white/10 hover:text-slate-50"
    : "p-1.5 rounded-md text-stone-500 transition-colors hover:bg-stone-100 dark:text-stone-400 hover:text-stone-700 dark:hover:bg-stone-700 dark:hover:text-stone-200";
}

export function deckIaToolbarHoverClass(
  tone: DeckContentTone,
  variant: "emerald" | "amber" | "sky",
): string {
  if (tone === "light") {
    const map = {
      emerald: "hover:text-emerald-300",
      amber: "hover:text-amber-300",
      sky: "hover:text-sky-300",
    } as const;
    return map[variant];
  }
  const map = {
    emerald: "hover:text-emerald-600 dark:hover:text-emerald-400",
    amber: "hover:text-amber-600 dark:hover:text-amber-400",
    sky: "hover:text-sky-600 dark:hover:text-sky-400",
  } as const;
  return map[variant];
}

/** Notas matriz: textarea */
export function deckMatrixNotesTextareaClass(tone: DeckContentTone): string {
  return cn(
    "min-h-[80px] w-full resize-y rounded-md border p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30",
    tone === "light"
      ? "border-white/20 bg-slate-950/50 text-slate-100 placeholder:text-slate-500"
      : "border-stone-200 bg-white/80 text-stone-900 dark:border-border dark:bg-stone-900/60 dark:text-stone-100",
  );
}
