import { clampCanvasRect, type SlideCanvasRect } from "../../domain/entities";

export type ResizeCorner = "nw" | "ne" | "sw" | "se";

/** Lado del rectángulo desde el que se arrastra (borde opuesto fijo). */
export type ResizeEdge = "n" | "s" | "e" | "w";

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

const MIN_W = 4;
const MIN_H = 3;

export function rectResizeFromEdge(
  edge: ResizeEdge,
  rect: SlideCanvasRect,
  px: number,
  py: number,
): SlideCanvasRect {
  switch (edge) {
    case "n": {
      const bottom = rect.y + rect.h;
      const y = Math.min(py, bottom - MIN_H);
      const h = Math.max(MIN_H, bottom - y);
      return clampCanvasRect({ ...rect, y, h });
    }
    case "s": {
      const h = Math.max(MIN_H, py - rect.y);
      return clampCanvasRect({ ...rect, h });
    }
    case "e": {
      const w = Math.max(MIN_W, px - rect.x);
      return clampCanvasRect({ ...rect, w });
    }
    case "w": {
      const right = rect.x + rect.w;
      const x = Math.min(px, right - MIN_W);
      const w = Math.max(MIN_W, right - x);
      return clampCanvasRect({ ...rect, x, w });
    }
  }
}
