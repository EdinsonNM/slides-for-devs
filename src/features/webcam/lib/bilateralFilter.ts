import { WEBCAM_INTENSITY_MAX } from "../../../domain/webcam/webcamPanelModel";
import { WEBCAM_BILATERAL_MAX_RADIUS } from "../constants";

/**
 * Filtro bilateral: suaviza preservando bordes (diferencia de luminancia baja el peso del vecino).
 * Pesos de rango en luma; acumulación de color conjunta (edge-preserving smoothing).
 */
export function bilateralFilterRGB(
  src: ImageData,
  w: number,
  h: number,
  strength: number,
): ImageData {
  const t = Math.min(1, Math.max(0, strength / WEBCAM_INTENSITY_MAX));
  if (t < 0.004) {
    return new ImageData(new Uint8ClampedArray(src.data), w, h);
  }
  const sigmaS = 0.7 + 1.35 * t;
  const sigmaR = 5.5 + 20 * t;
  const inv2sigmaS2 = 1 / (2 * sigmaS * sigmaS);
  const inv2sigmaR2 = 1 / (2 * sigmaR * sigmaR);
  const r = Math.min(WEBCAM_BILATERAL_MAX_RADIUS, Math.max(1, Math.ceil(sigmaS * 0.85)));
  const n = w * h;
  const luma = new Float32Array(n);
  const d = src.data;
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    luma[i] = 0.299 * d[p]! + 0.587 * d[p + 1]! + 0.114 * d[p + 2]!;
  }
  const out = new Uint8ClampedArray(n * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = y * w + x;
      const l0 = luma[c]!;
      let wSum = 0;
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      for (let dy = -r; dy <= r; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const nc = ny * w + nx;
          const sp = (dx * dx + dy * dy) * inv2sigmaS2;
          const dl = l0 - luma[nc]!;
          const spW = Math.exp(-sp);
          const rgW = Math.exp(-(dl * dl) * inv2sigmaR2);
          const wij = spW * rgW;
          wSum += wij;
          const p = nc * 4;
          rSum += wij * d[p]!;
          gSum += wij * d[p + 1]!;
          bSum += wij * d[p + 2]!;
        }
      }
      if (wSum < 1e-8) {
        const p = c * 4;
        out[p] = d[p]!;
        out[p + 1] = d[p + 1]!;
        out[p + 2] = d[p + 2]!;
        out[p + 3] = 255;
        continue;
      }
      const invW = 1 / wSum;
      const p = c * 4;
      out[p] = Math.max(0, Math.min(255, Math.round(rSum * invW)));
      out[p + 1] = Math.max(0, Math.min(255, Math.round(gSum * invW)));
      out[p + 2] = Math.max(0, Math.min(255, Math.round(bSum * invW)));
      out[p + 3] = 255;
    }
  }
  return new ImageData(out, w, h);
}
