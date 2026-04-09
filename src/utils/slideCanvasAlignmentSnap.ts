import type { SlideCanvasElement, SlideCanvasRect } from "../domain/entities";

/** Márgenes guía (%) respecto al borde del lienzo, estilo “zona segura”. */
export const SLIDE_CANVAS_MARGIN_GUIDE_PCT = 5;

const SNAP_PX = 6;
/** Tolerancia para considerar que una guía sigue activa visualmente. */
const GUIDE_MATCH_EPS_PCT = 0.35;

function nearly(a: number, b: number, eps = GUIDE_MATCH_EPS_PCT): boolean {
  return Math.abs(a - b) < eps;
}

function snapThresholdPct(axisPx: number): number {
  if (axisPx <= 0) return 0;
  return (SNAP_PX / axisPx) * 100;
}

function isSolidVerticalLine(posPct: number): boolean {
  const m = SLIDE_CANVAS_MARGIN_GUIDE_PCT;
  return (
    nearly(posPct, 0) ||
    nearly(posPct, 100) ||
    nearly(posPct, 50) ||
    nearly(posPct, m) ||
    nearly(posPct, 100 - m)
  );
}

function isSolidHorizontalLine(posPct: number): boolean {
  return isSolidVerticalLine(posPct);
}

function collectXTargets(
  elements: SlideCanvasElement[],
  excludeId: string,
): number[] {
  const s = new Set<number>();
  const m = SLIDE_CANVAS_MARGIN_GUIDE_PCT;
  s.add(0);
  s.add(50);
  s.add(100);
  s.add(m);
  s.add(100 - m);
  for (const e of elements) {
    if (e.id === excludeId) continue;
    const r = e.rect;
    s.add(r.x);
    s.add(r.x + r.w / 2);
    s.add(r.x + r.w);
  }
  return [...s];
}

function collectYTargets(
  elements: SlideCanvasElement[],
  excludeId: string,
): number[] {
  const s = new Set<number>();
  const m = SLIDE_CANVAS_MARGIN_GUIDE_PCT;
  s.add(0);
  s.add(50);
  s.add(100);
  s.add(m);
  s.add(100 - m);
  for (const e of elements) {
    if (e.id === excludeId) continue;
    const r = e.rect;
    s.add(r.y);
    s.add(r.y + r.h / 2);
    s.add(r.y + r.h);
  }
  return [...s];
}

function bestXSnap(
  r: SlideCanvasRect,
  targets: number[],
  threshPct: number,
): SlideCanvasRect | null {
  let best: { dx: number; dist: number } | null = null;
  const w = r.w;
  for (const t of targets) {
    const candidates: [number, number][] = [
      [t - r.x, Math.abs(r.x - t)],
      [t - w / 2 - r.x, Math.abs(r.x + w / 2 - t)],
      [t - w - r.x, Math.abs(r.x + w - t)],
    ];
    for (const [dx, dist] of candidates) {
      if (dist <= threshPct && (best === null || dist < best.dist - 1e-9)) {
        best = { dx, dist };
      }
    }
  }
  if (!best) return null;
  return { ...r, x: r.x + best.dx };
}

function bestYSnap(
  r: SlideCanvasRect,
  targets: number[],
  threshPct: number,
): SlideCanvasRect | null {
  let best: { dy: number; dist: number } | null = null;
  const h = r.h;
  for (const t of targets) {
    const candidates: [number, number][] = [
      [t - r.y, Math.abs(r.y - t)],
      [t - h / 2 - r.y, Math.abs(r.y + h / 2 - t)],
      [t - h - r.y, Math.abs(r.y + h - t)],
    ];
    for (const [dy, dist] of candidates) {
      if (dist <= threshPct && (best === null || dist < best.dist - 1e-9)) {
        best = { dy, dist };
      }
    }
  }
  if (!best) return null;
  return { ...r, y: r.y + best.dy };
}

export type AlignmentGuideStroke = "solid" | "dashed";

export interface AlignmentGuideLine {
  posPct: number;
  stroke: AlignmentGuideStroke;
}

export interface CanvasDragSnapResult {
  rect: SlideCanvasRect;
  guides: {
    vertical: AlignmentGuideLine[];
    horizontal: AlignmentGuideLine[];
  };
}

function verticalGuidesForRect(
  r: SlideCanvasRect,
  targets: number[],
): AlignmentGuideLine[] {
  const lines: AlignmentGuideLine[] = [];
  const seen = new Set<string>();
  for (const t of targets) {
    const hit =
      nearly(r.x, t) ||
      nearly(r.x + r.w / 2, t) ||
      nearly(r.x + r.w, t);
    if (!hit) continue;
    const key = t.toFixed(2);
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push({
      posPct: t,
      stroke: isSolidVerticalLine(t) ? "solid" : "dashed",
    });
  }
  return lines;
}

function horizontalGuidesForRect(
  r: SlideCanvasRect,
  targets: number[],
): AlignmentGuideLine[] {
  const lines: AlignmentGuideLine[] = [];
  const seen = new Set<string>();
  for (const t of targets) {
    const hit =
      nearly(r.y, t) ||
      nearly(r.y + r.h / 2, t) ||
      nearly(r.y + r.h, t);
    if (!hit) continue;
    const key = t.toFixed(2);
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push({
      posPct: t,
      stroke: isSolidHorizontalLine(t) ? "solid" : "dashed",
    });
  }
  return lines;
}

/**
 * Ajusta la posición del rect en X/Y al acercarse a ejes del lienzo, márgenes u otros bloques.
 * Coordenadas en % del mismo sistema que `SlideCanvasRect`.
 */
export function snapCanvasRectWhileDragging(
  proposed: SlideCanvasRect,
  draggedElementId: string,
  elements: SlideCanvasElement[],
  containerWidthPx: number,
  containerHeightPx: number,
): CanvasDragSnapResult {
  const targetsX = collectXTargets(elements, draggedElementId);
  const targetsY = collectYTargets(elements, draggedElementId);
  const thX = snapThresholdPct(containerWidthPx);
  const thY = snapThresholdPct(containerHeightPx);

  let r = { ...proposed };
  const sx = bestXSnap(r, targetsX, thX);
  if (sx) r = sx;
  const sy = bestYSnap(r, targetsY, thY);
  if (sy) r = sy;

  return {
    rect: r,
    guides: {
      vertical: verticalGuidesForRect(r, targetsX),
      horizontal: horizontalGuidesForRect(r, targetsY),
    },
  };
}

/** Guías visuales para un rect concreto (p. ej. durante resize) sin alterar posición/tamaño. */
export function getCanvasAlignmentGuidesForRect(
  r: SlideCanvasRect,
  draggedElementId: string,
  elements: SlideCanvasElement[],
): CanvasDragSnapResult["guides"] {
  const targetsX = collectXTargets(elements, draggedElementId);
  const targetsY = collectYTargets(elements, draggedElementId);
  return {
    vertical: verticalGuidesForRect(r, targetsX),
    horizontal: horizontalGuidesForRect(r, targetsY),
  };
}
