import type { SlideCanvasElement } from "../entities/SlideCanvas";

/** Orden estable por `z`, desempate por índice original (igual que `normalizeCanvasElementsZOrder`). */
function stableSortedByZ(elements: SlideCanvasElement[]): SlideCanvasElement[] {
  return elements
    .map((e, i) => ({ e, i }))
    .sort((a, b) => {
      if (a.e.z !== b.e.z) return a.e.z - b.e.z;
      return a.i - b.i;
    })
    .map(({ e }) => e);
}

function withDenseZ(order: SlideCanvasElement[]): SlideCanvasElement[] {
  return order.map((e, rank) => ({ ...e, z: rank }));
}

export type CanvasLayerReorderMove =
  | "forwardOne"
  | "backwardOne"
  | "toFront"
  | "toBack";

/**
 * Reordena un elemento en el apilamiento (`z` denso 0..n-1).
 * @returns `null` si el id no existe o el movimiento no aplica (p. ej. ya al frente).
 */
export function reorderCanvasElementLayer(
  elements: SlideCanvasElement[],
  elementId: string,
  move: CanvasLayerReorderMove,
): SlideCanvasElement[] | null {
  const sorted = stableSortedByZ(elements);
  const idx = sorted.findIndex((e) => e.id === elementId);
  if (idx < 0) return null;

  let next = [...sorted];
  switch (move) {
    case "forwardOne":
      if (idx >= sorted.length - 1) return null;
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      break;
    case "backwardOne":
      if (idx <= 0) return null;
      [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
      break;
    case "toFront": {
      if (idx >= sorted.length - 1) return null;
      const [el] = next.splice(idx, 1);
      next.push(el);
      break;
    }
    case "toBack": {
      if (idx <= 0) return null;
      const [el] = next.splice(idx, 1);
      next.unshift(el);
      break;
    }
  }
  return withDenseZ(next);
}
