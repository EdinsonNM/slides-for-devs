/** Query en el hash (`#/editor/...?slide=N`) — índice 0-based, alineado con `currentIndex`. */
export const EDITOR_SLIDE_QUERY_PARAM = "slide";

export function clampEditorSlideIndex(index: number, slideCount: number): number {
  if (slideCount <= 0) return 0;
  return Math.max(0, Math.min(slideCount - 1, Math.floor(index)));
}

/**
 * Lee `slide` del fragmento con HashRouter (`#/ruta?slide=2`).
 * Devuelve `null` si falta o no es un entero finito.
 */
export function readEditorSlideIndexFromHash(): number | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.replace(/^#/, "");
  const q = hash.indexOf("?");
  if (q === -1) return null;
  const raw = new URLSearchParams(hash.slice(q + 1)).get(EDITOR_SLIDE_QUERY_PARAM);
  if (raw === null || raw.trim() === "") return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return null;
  return n;
}
