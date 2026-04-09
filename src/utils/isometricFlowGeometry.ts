/** Proyección isométrica 2:1 (sin librerías externas). */

const COS30 = 0.8660254037844387;

export const ISOMETRIC_VIEWBOX = { w: 960, h: 540 } as const;

export function isoGridToCanvas(
  gx: number,
  gy: number,
  cell: number,
  originX: number,
  originY: number,
): { x: number; y: number } {
  const x = originX + (gx - gy) * cell * COS30;
  const y = originY + (gx + gy) * cell * 0.5;
  return { x, y };
}

/** Punto en espacio de lienzo SVG → celda isométrica aproximada. */
export function canvasToIsoGrid(
  x: number,
  y: number,
  cell: number,
  originX: number,
  originY: number,
): { gx: number; gy: number } {
  const a = cell * COS30;
  const b = cell * 0.5;
  const dx = (x - originX) / a;
  const dy = (y - originY) / b;
  const gx = (dx + dy) / 2;
  const gy = (dy - dx) / 2;
  return { gx: Math.round(gx), gy: Math.round(gy) };
}

/** Centro visual del rombo superior del bloque (para conectores). */
export function nodeAnchor(
  gx: number,
  gy: number,
  cell: number,
  originX: number,
  originY: number,
): { x: number; y: number } {
  const { x, y } = isoGridToCanvas(gx, gy, cell, originX, originY);
  return { x, y: y - 22 };
}
