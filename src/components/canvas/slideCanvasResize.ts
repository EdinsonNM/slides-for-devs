import { clampCanvasRect, type SlideCanvasRect } from "../../domain/entities";

export type ResizeCorner = "nw" | "ne" | "sw" | "se";

/** Esquina opuesta fija (en %) mientras se arrastra la esquina activa. */
export function oppositeCornerPercent(
  corner: ResizeCorner,
  rect: SlideCanvasRect,
): { x: number; y: number } {
  switch (corner) {
    case "se":
      return { x: rect.x, y: rect.y };
    case "sw":
      return { x: rect.x + rect.w, y: rect.y };
    case "ne":
      return { x: rect.x, y: rect.y + rect.h };
    case "nw":
    default:
      return { x: rect.x + rect.w, y: rect.y + rect.h };
  }
}

export function rectResizeFromCorner(
  oppX: number,
  oppY: number,
  cornerX: number,
  cornerY: number,
): SlideCanvasRect {
  const x = Math.min(oppX, cornerX);
  const y = Math.min(oppY, cornerY);
  const w = Math.max(4, Math.abs(cornerX - oppX));
  const h = Math.max(3, Math.abs(cornerY - oppY));
  return clampCanvasRect({ x, y, w, h });
}
