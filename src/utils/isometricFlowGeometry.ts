/** Proyección isométrica 2:1 (sin librerías externas). */

const COS30 = 0.8660254037844387;

export const ISOMETRIC_VIEWBOX = { w: 960, h: 540 } as const;

/** Paso en canvas al incrementar solo `gx` (en la rejilla lógica). */
export function isoStepGx(cell: number): { x: number; y: number } {
  return { x: cell * COS30, y: cell * 0.5 };
}

/** Paso en canvas al incrementar solo `gy`. */
export function isoStepGy(cell: number): { x: number; y: number } {
  return { x: -cell * COS30, y: cell * 0.5 };
}

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

/** Pie del bloque en el suelo de la rejilla (ancla del elemento). */
export function nodeFoot(
  gx: number,
  gy: number,
  cell: number,
  originX: number,
  originY: number,
): { x: number; y: number } {
  return isoGridToCanvas(gx, gy, cell, originX, originY);
}

/**
 * Rombo alineado con la celda isométrica: vértices en los puntos medios hacia
 * vecinos de rejilla (intersección de líneas de cuadrícula).
 * `halfScale = 0.5` → rombo de una celda exacta centrado en (cx, cy).
 */
export function isoDiamondAroundPoint(
  cx: number,
  cy: number,
  cell: number,
  halfScale: number,
): { x: number; y: number }[] {
  const Gx = isoStepGx(cell);
  const Gy = isoStepGy(cell);
  const f = halfScale;
  return [
    { x: cx + f * Gx.x, y: cy + f * Gx.y },
    { x: cx + f * Gy.x, y: cy + f * Gy.y },
    { x: cx - f * Gx.x, y: cy - f * Gx.y },
    { x: cx - f * Gy.x, y: cy - f * Gy.y },
  ];
}

export function polygonPath(verts: { x: number; y: number }[]): string {
  if (verts.length === 0) return "";
  const [f, ...r] = verts;
  return `M ${f!.x} ${f!.y} ${r.map((v) => `L ${v.x} ${v.y}`).join(" ")} Z`;
}

/**
 * Centro de la cara superior de la losa (conectores / tallo de etiqueta).
 */
export function nodeSlabTopCenter(
  gx: number,
  gy: number,
  cell: number,
  originX: number,
  originY: number,
  rise: number,
): { x: number; y: number } {
  const { x, y } = nodeFoot(gx, gy, cell, originX, originY);
  return { x, y: y - rise };
}

/** @deprecated usar `nodeSlabTopCenter`. */
export function nodeSlabTop(
  gx: number,
  gy: number,
  cell: number,
  originX: number,
  originY: number,
  rise: number,
): { x: number; y: number } {
  return nodeSlabTopCenter(gx, gy, cell, originX, originY, rise);
}

/** @deprecated usar `nodeSlabTopCenter`. */
export function nodeAnchor(
  gx: number,
  gy: number,
  cell: number,
  originX: number,
  originY: number,
): { x: number; y: number } {
  return nodeSlabTopCenter(gx, gy, cell, originX, originY, 22);
}

/** Polilínea ortogonal en ejes isométricos (0, 1 o 2 segmentos). */
export function isoOrthogonalLinkPoints(
  p0: { x: number; y: number },
  p2: { x: number; y: number },
  dgx: number,
  dgy: number,
  cell: number,
): { x: number; y: number }[] {
  const Gx = isoStepGx(cell);
  const Gy = isoStepGy(cell);
  if (dgx === 0 && dgy === 0) {
    return [p0, p2];
  }
  if (dgx === 0 || dgy === 0) {
    return [p0, p2];
  }
  const elbow = {
    x: p0.x + dgx * Gx.x,
    y: p0.y + dgx * Gx.y,
  };
  return [p0, elbow, p2];
}

export function isoOrthogonalLinkPath(
  p0: { x: number; y: number },
  p2: { x: number; y: number },
  dgx: number,
  dgy: number,
  cell: number,
): string {
  const pts = isoOrthogonalLinkPoints(p0, p2, dgx, dgy, cell);
  if (pts.length < 2) return "";
  return `M ${pts.map((p) => `${p.x} ${p.y}`).join(" L ")}`;
}

function distPointSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-8) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const qx = x1 + t * dx;
  const qy = y1 + t * dy;
  return Math.hypot(px - qx, py - qy);
}

export function distancePointToPolyline(
  px: number,
  py: number,
  pts: { x: number; y: number }[],
): number {
  if (pts.length < 2) return Infinity;
  let min = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const d = distPointSegment(px, py, a.x, a.y, b.x, b.y);
    if (d < min) min = d;
  }
  return min;
}

/** Acorta el último segmento para dejar hueco a la punta de flecha. */
export function shortenPolylineEnd(
  pts: { x: number; y: number }[],
  trim: number,
): { x: number; y: number }[] {
  if (pts.length < 2 || trim <= 0) return pts;
  const out = [...pts];
  const n = out.length;
  const last = out[n - 1]!;
  const prev = out[n - 2]!;
  const dx = last.x - prev.x;
  const dy = last.y - prev.y;
  const len = Math.hypot(dx, dy);
  if (len < trim + 1) return pts;
  const u = dx / len;
  const v = dy / len;
  out[n - 1] = { x: last.x - u * trim, y: last.y - v * trim };
  return out;
}

/** Triángulo de flecha en el extremo (último punto = punta). */
export function arrowHeadPath(
  pts: { x: number; y: number }[],
  size: number,
): string | null {
  if (pts.length < 2) return null;
  const tip = pts[pts.length - 1]!;
  const prev = pts[pts.length - 2]!;
  const dx = tip.x - prev.x;
  const dy = tip.y - prev.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return null;
  const ux = dx / len;
  const uy = dy / len;
  const bx = -uy;
  const by = ux;
  const backX = tip.x - ux * size * 1.15;
  const backY = tip.y - uy * size * 1.15;
  const w = size * 0.55;
  return `M ${backX + bx * w} ${backY + by * w} L ${tip.x} ${tip.y} L ${backX - bx * w} ${backY - by * w} Z`;
}
