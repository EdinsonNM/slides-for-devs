import type { SlideCanvasElement } from "../entities/SlideCanvas";

/** Reasigna z a 0..n-1 según el orden actual (menor z primero). */
export function normalizeCanvasElementsZOrder(
  elements: SlideCanvasElement[],
): SlideCanvasElement[] {
  const withIdx = elements.map((e, i) => ({ e, i }));
  withIdx.sort((a, b) => {
    if (a.e.z !== b.e.z) return a.e.z - b.e.z;
    return a.i - b.i;
  });
  return withIdx.map(({ e }, rank) => ({ ...e, z: rank }));
}
