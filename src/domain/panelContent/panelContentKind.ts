/**
 * Valores persistidos del panel de media (`Slide.contentType` / payload del lienzo).
 * Única fuente de verdad: no comparar strings sueltos fuera de este módulo.
 */
export const PANEL_CONTENT_KIND = {
  IMAGE: "image",
  CODE: "code",
  VIDEO: "video",
  PRESENTER_3D: "presenter3d",
  CANVAS_3D: "canvas3d",
} as const;

export type PanelContentKind =
  (typeof PANEL_CONTENT_KIND)[keyof typeof PANEL_CONTENT_KIND];

const KIND_SET = new Set<string>(Object.values(PANEL_CONTENT_KIND));

/** Orden del atajo de ciclo de tipo de panel (editor). */
export const PANEL_CONTENT_TOGGLE_ORDER: readonly PanelContentKind[] = [
  PANEL_CONTENT_KIND.CODE,
  PANEL_CONTENT_KIND.VIDEO,
  PANEL_CONTENT_KIND.IMAGE,
  PANEL_CONTENT_KIND.PRESENTER_3D,
  PANEL_CONTENT_KIND.CANVAS_3D,
] as const;

export function isPanelContentKind(v: unknown): v is PanelContentKind {
  return typeof v === "string" && KIND_SET.has(v);
}

export function normalizePanelContentKind(
  raw: string | undefined | null,
): PanelContentKind {
  if (raw != null && isPanelContentKind(raw)) return raw;
  return PANEL_CONTENT_KIND.IMAGE;
}
