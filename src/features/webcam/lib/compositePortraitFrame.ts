import type { ImageSegmenterResult } from "@mediapipe/tasks-vision";
import { WEBCAM_INTENSITY_MAX } from "../../../domain/webcam/webcamPanelModel";

/**
 * Convierte intensidad 0–100 a radio de desenfoque de fondo (píxeles aproximados a escala de trabajo).
 */
export function backgroundStrengthToBlurPx(strength: number): number {
  const s = Math.min(WEBCAM_INTENSITY_MAX, Math.max(0, strength));
  return (s / WEBCAM_INTENSITY_MAX) * 24;
}

/**
 * Pasa bajo frecuencia (blur muy pequeño) para separar “textura” de bordes grandes.
 * Radio acotado: Meet/Zoom no aplica un desenfoque fuerte a toda la cara, atenúan piel.
 */
function lowPassBlurPxForTouchUp(strength: number): number {
  const t = Math.min(1, Math.max(0, strength / WEBCAM_INTENSITY_MAX));
  return 0.85 + t * 0.95;
}

/**
 * “Retoque” / suavidad tipo cámara: baja frecuencia + detalle = original;
 * se atenúa solo el término de detalle (frec. altas) → menos poros/textura, sin apariencia de desenfocado.
 */
function buildAppearanceTouchUpLayer(
  sharp: ImageData,
  low: ImageData,
  w: number,
  h: number,
  strength: number,
): ImageData {
  const u = Math.min(1, Math.max(0, strength / WEBCAM_INTENSITY_MAX));
  const uEff = u * u * (3 - 2 * u);
  const k = uEff * 0.56;
  const out = new Uint8ClampedArray(w * h * 4);
  const sd = sharp.data;
  const ld = low.data;
  for (let i = 0, n = w * h; i < n; i++) {
    const p = i * 4;
    for (const c of [0, 1, 2] as const) {
      const s = sd[p + c]!;
      const l = ld[p + c]!;
      const hi = s - l;
      out[p + c] = Math.max(0, Math.min(255, Math.round(l + hi * (1 - k))));
    }
    out[p + 3] = 255;
  }
  return new ImageData(out, w, h);
}

function sampleBilinear(
  data: Float32Array,
  mw: number,
  mh: number,
  u: number,
  v: number,
): number {
  const x = u * (mw - 1);
  const y = v * (mh - 1);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(mw - 1, x0 + 1);
  const y1 = Math.min(mh - 1, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;
  const a = data[y0 * mw + x0]! * (1 - tx) + data[y0 * mw + x1]! * tx;
  const b = data[y1 * mw + x0]! * (1 - tx) + data[y1 * mw + x1]! * tx;
  return a * (1 - ty) + b * ty;
}

/**
 * Toma un resultado de `segmentForVideo` y devuelve una copia del tensor de la primera máscara de confianza.
 * Llama a `result.close()` tras leer. Si no hay máscara, devuelve null.
 */
export function copyFirstConfidenceMask(
  result: ImageSegmenterResult,
): { data: Float32Array; width: number; height: number } | null {
  const masks = result.confidenceMasks;
  if (!masks?.length) {
    result.close();
    return null;
  }
  /** Con modelos multicapa, la máscara [1] suele ser la persona. */
  const m = masks.length >= 2 ? masks[1]! : masks[0]!;
  const arr = m.getAsFloat32Array();
  const copy = new Float32Array(arr);
  const w = m.width;
  const h = m.height;
  result.close();
  return { data: copy, width: w, height: h };
}

/**
 * Pinta en `outCtx` el retrato: fondo con blur y figura nítida o suavizada según máscara.
 * `eyePreserveMap`: por píxel, 1 = nítido (ojos, Face Landmarker), 0 = suavidad plena.
 */
export function compositePortraitOntoContext(
  outCtx: CanvasRenderingContext2D,
  w: number,
  h: number,
  imageSharp: ImageData,
  imageBlurred: ImageData,
  imageSmooth: ImageData,
  mask: Float32Array,
  mw: number,
  mh: number,
  faceSmoothStrength: number,
  eyePreserveMap: Float32Array | null,
): void {
  const sFlat = new Uint8ClampedArray(w * h * 4);
  const tBase = faceSmoothStrength / WEBCAM_INTENSITY_MAX;
  for (let y = 0; y < h; y++) {
    const v = (y + 0.5) / h;
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w;
      const m = sampleBilinear(mask, mw, mh, u, v);
      const mClamped = Math.min(1, Math.max(0, m));
      const pIdx = y * w + x;
      const eyeW =
        eyePreserveMap !== null && pIdx < eyePreserveMap.length
          ? Math.max(0, Math.min(1, eyePreserveMap[pIdx]!))
          : 0;
      const t = tBase * (1 - eyeW * 0.98);
      const i = pIdx * 4;
      for (const c of [0, 1, 2] as const) {
        const sh = imageSharp.data[i + c]!;
        const sm = imageSmooth.data[i + c]!;
        const bl = imageBlurred.data[i + c]!;
        const fg = sh * (1 - t) + sm * t;
        sFlat[i + c] = Math.round(fg * mClamped + bl * (1 - mClamped));
      }
      sFlat[i + 3] = 255;
    }
  }
  outCtx.putImageData(new ImageData(sFlat, w, h), 0, 0);
}

type Scratch = {
  sharp: HTMLCanvasElement;
  blurred: HTMLCanvasElement;
  smooth: HTMLCanvasElement;
};

function ensureCanvas(
  c: HTMLCanvasElement,
  w: number,
  h: number,
): CanvasRenderingContext2D {
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("2D context no disponible");
  }
  return ctx;
}

/**
 * Rellena búferes de imagen a partir de un fotograma de vídeo: blur de fondo y capa de suavidad (smoothness) en primer plano.
 */
export function renderVideoBuffers(
  video: HTMLVideoElement,
  w: number,
  h: number,
  bgBlurPx: number,
  foregroundSmoothness: number,
  scratch: Scratch,
): { imageSharp: ImageData; imageBlurred: ImageData; imageSmooth: ImageData } {
  const ctxS = ensureCanvas(scratch.sharp, w, h);
  const ctxB = ensureCanvas(scratch.blurred, w, h);
  const ctxF = ensureCanvas(scratch.smooth, w, h);

  ctxS.filter = "none";
  ctxS.clearRect(0, 0, w, h);
  ctxS.drawImage(video, 0, 0, w, h);
  const imageSharp = ctxS.getImageData(0, 0, w, h);

  ctxB.clearRect(0, 0, w, h);
  if (bgBlurPx < 0.15) {
    ctxB.filter = "none";
    ctxB.drawImage(video, 0, 0, w, h);
  } else {
    ctxB.filter = `blur(${bgBlurPx.toFixed(2)}px)`;
    ctxB.drawImage(video, 0, 0, w, h);
  }
  const imageBlurred = ctxB.getImageData(0, 0, w, h);
  ctxB.filter = "none";

  let imageSmooth: ImageData;
  if (foregroundSmoothness <= 0) {
    imageSmooth = imageSharp;
  } else {
    const sigma = lowPassBlurPxForTouchUp(foregroundSmoothness);
    ctxF.filter = "none";
    ctxF.clearRect(0, 0, w, h);
    ctxF.filter = `blur(${sigma.toFixed(2)}px)`;
    ctxF.drawImage(video, 0, 0, w, h);
    const imageLow = ctxF.getImageData(0, 0, w, h);
    ctxF.filter = "none";
    imageSmooth = buildAppearanceTouchUpLayer(
      imageSharp,
      imageLow,
      w,
      h,
      foregroundSmoothness,
    );
  }

  return { imageSharp, imageBlurred, imageSmooth };
}
