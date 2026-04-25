import { FaceLandmarker, type NormalizedLandmark } from "@mediapipe/tasks-vision";

type Pt = { x: number; y: number };

let maskCanvas: HTMLCanvasElement | null = null;

function getMaskContext(w: number, h: number): CanvasRenderingContext2D {
  if (!maskCanvas) {
    maskCanvas = document.createElement("canvas");
  }
  maskCanvas.width = w;
  maskCanvas.height = h;
  const ctx = maskCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("2D context no disponible");
  }
  return ctx;
}

function buildFaceOvalPolygon(
  landmarks: NormalizedLandmark[] | undefined,
  w: number,
  h: number,
): Pt[] | null {
  if (!landmarks?.length) {
    return null;
  }
  const s = new Set<number>();
  for (const c of FaceLandmarker.FACE_LANDMARKS_FACE_OVAL) {
    s.add(c.start);
    s.add(c.end);
  }
  const raw: Pt[] = [];
  for (const i of s) {
    const lm = landmarks[i];
    if (lm) {
      raw.push({ x: lm.x * w, y: lm.y * h });
    }
  }
  if (raw.length < 3) {
    return null;
  }
  let cx = 0;
  let cy = 0;
  for (const p of raw) {
    cx += p.x;
    cy += p.y;
  }
  cx /= raw.length;
  cy /= raw.length;
  return [...raw].sort(
    (a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx),
  );
}

/**
 * 0 = fuera del rostro, 1 = interior del óvalo (suavidad solo ahí; el resto del cuerpo queda nítido).
 */
export function fillFaceOvalInfluenceMap(
  landmarks: NormalizedLandmark[] | undefined,
  w: number,
  h: number,
  out: Float32Array,
): void {
  out.fill(0);
  const poly = buildFaceOvalPolygon(landmarks, w, h);
  if (!poly?.length) {
    return;
  }
  const ctx = getMaskContext(w, h);
  ctx.clearRect(0, 0, w, h);
  ctx.beginPath();
  ctx.moveTo(poly[0]!.x, poly[0]!.y);
  for (let i = 1; i < poly.length; i++) {
    ctx.lineTo(poly[i]!.x, poly[i]!.y);
  }
  ctx.closePath();
  ctx.fillStyle = "#fff";
  ctx.fill();
  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;
  for (let i = 0, n = w * h; i < n; i++) {
    out[i] = d[i * 4]! / 255;
  }
  featherOvalMapInPlace(out, w, h, 1);
}

function featherOvalMapInPlace(map: Float32Array, w: number, h: number, r: number): void {
  if (r <= 0) {
    return;
  }
  const copy = new Float32Array(map);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      let c = 0;
      for (let dy = -r; dy <= r; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) {
          continue;
        }
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) {
            continue;
          }
          s += copy[yy * w + xx]!;
          c += 1;
        }
      }
      if (c > 0) {
        map[y * w + x] = s / c;
      }
    }
  }
}
