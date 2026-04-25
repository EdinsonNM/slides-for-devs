import { FaceLandmarker, type NormalizedLandmark } from "@mediapipe/tasks-vision";

/** Índices de contorno ojo + iris (Face Landmarker). */
function collectEyeLandmarkIndices(): Set<number> {
  const s = new Set<number>();
  for (const arr of [
    FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
    FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
    FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS,
    FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS,
  ]) {
    for (const c of arr) {
      s.add(c.start);
      s.add(c.end);
    }
  }
  return s;
}

let cachedEyeIndexSet: Set<number> | null = null;

function getEyeIndexSet(): Set<number> {
  cachedEyeIndexSet ??= collectEyeLandmarkIndices();
  return cachedEyeIndexSet;
}

type Pt = { x: number; y: number };

function splitLeftRightEyes(pts: Pt[]): [Pt[], Pt[]] {
  if (pts.length < 3) {
    return [pts, []];
  }
  const sorted = [...pts].sort((a, b) => a.x - b.x);
  let bestGap = -1;
  let split = 1;
  for (let i = 1; i < sorted.length; i++) {
    const g = sorted[i]!.x - sorted[i - 1]!.x;
    if (g > bestGap) {
      bestGap = g;
      split = i;
    }
  }
  return [sorted.slice(0, split), sorted.slice(split)];
}

function centroid(pts: Pt[]): Pt {
  let sx = 0;
  let sy = 0;
  for (const p of pts) {
    sx += p.x;
    sy += p.y;
  }
  const n = pts.length;
  return { x: sx / n, y: sy / n };
}

function maxRadius(pts: Pt[], c: Pt, pad: number): number {
  let r = 0;
  for (const p of pts) {
    r = Math.max(r, Math.hypot(p.x - c.x, p.y - c.y));
  }
  return r * pad;
}

/**
 * Escribe en `out` (w×h) pesos 0–1: 1 = conservar nitidez (ojos/iris), 0 = permitir suavidad.
 * Se rellenan elipses suaves alrededor de cada ojo.
 */
export function fillEyeRegionPreserveMap(
  landmarks: NormalizedLandmark[] | undefined,
  w: number,
  h: number,
  out: Float32Array,
): void {
  out.fill(0);
  if (!landmarks?.length) {
    return;
  }
  const idx = getEyeIndexSet();
  const pts: Pt[] = [];
  for (const i of idx) {
    const lm = landmarks[i];
    if (!lm) continue;
    pts.push({ x: lm.x * w, y: lm.y * h });
  }
  if (pts.length < 3) {
    return;
  }
  const [leftPts, rightPts] = splitLeftRightEyes(pts);
  const pad = 1.35;
  const groups = [leftPts, rightPts].filter((g) => g.length >= 2);
  for (const g of groups) {
    const c = centroid(g);
    const rMax = Math.max(8, maxRadius(g, c, pad));
    const rInner = rMax * 0.5;
    const rOuter = rMax * 1.15;
    const x0 = Math.max(0, Math.floor(c.x - rOuter - 2));
    const x1 = Math.min(w - 1, Math.ceil(c.x + rOuter + 2));
    const y0 = Math.max(0, Math.floor(c.y - rOuter - 2));
    const y1 = Math.min(h - 1, Math.ceil(c.y + rOuter + 2));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - c.x, y - c.y);
        if (d > rOuter) {
          continue;
        }
        let a = 1;
        if (d > rInner && rOuter > rInner) {
          a = 1 - (d - rInner) / (rOuter - rInner);
        }
        const p = y * w + x;
        out[p] = Math.max(out[p]!, Math.max(0, Math.min(1, a)));
      }
    }
  }
}
