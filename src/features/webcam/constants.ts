/**
 * Modelo `selfie_segmenter` (MediaPipe Image Segmenter, float16) servido desde `public/mediapipe/selfie_segmenter.tflite`.
 * Misma versión que `.../selfie_segmenter/float16/latest/selfie_segmenter.tflite` en GCS; se empaqueta con el build (Vite/Tauri, sin CDN).
 */
export function selfieSegmenterModelUrl(): string {
  const base = import.meta.env.BASE_URL;
  const join = base.endsWith("/") ? base : `${base}/`;
  return `${join}mediapipe/selfie_segmenter.tflite`;
}

/**
 * Ruta a los `.wasm` servidos bajo `public/mediapipe/wasm` (copiado desde `node_modules/@mediapipe/tasks-vision/wasm`).
 * `import.meta.env.BASE_URL` añade el prefijo en apps desplegadas bajo subpath.
 */
export function mediapipeWasmBasePath(): string {
  const base = import.meta.env.BASE_URL;
  if (!base.endsWith("/")) {
    return `${base}/mediapipe/wasm/`;
  }
  return `${base}mediapipe/wasm/`;
}

/** Ancho máximo de trabajo para compuesta (reduce CPU y memoria). */
export const WEBCAM_PORTRAIT_MAX_WIDTH = 480;

/** Cadencia mínima entre fotogramas con efecto (ms). */
export const WEBCAM_PORTRAIT_MIN_FRAME_MS = 45;
