/**
 * Modelo `selfie_segmenter` (MediaPipe Image Segmenter, float16) servido desde `public/mediapipe/selfie_segmenter.tflite`.
 * Misma versión que `.../selfie_segmenter/float16/latest/selfie_segmenter.tflite` en GCS; se empaqueta con el build (Vite/Tauri, sin CDN).
 */
export function selfieSegmenterModelUrl(): string {
  const base = import.meta.env.BASE_URL;
  const join = base.endsWith("/") ? base : `${base}/`;
  return `${join}mediapipe/selfie_segmenter.tflite`;
}

export function faceLandmarkerModelUrl(): string {
  const base = import.meta.env.BASE_URL;
  const join = base.endsWith("/") ? base : `${base}/`;
  return `${join}mediapipe/face_landmarker.task`;
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

/** Ancho máximo de trabajo para compuesta (menos píxeles = menos ML + bilateral). */
export const WEBCAM_PORTRAIT_MAX_WIDTH = 360;

/** Cadencia mínima entre pasadas del pipeline con efectos (~11 fps en el canvas de retrato). */
export const WEBCAM_PORTRAIT_MIN_FRAME_MS = 90;

/** Ejecutar segmentación solo 1 de cada N pasadas (reutilizar máscara el resto). */
export const WEBCAM_SEGMENT_EVERY_N_FRAMES = 2;

/** Ejecutar Face Landmarker solo 1 de cada N pasadas (reutilizar mapas ojo/óvalo). */
export const WEBCAM_FACE_LM_EVERY_N_FRAMES = 3;

/** Radio máx. del kernel bilateral (vecinos ≈ (2r+1)²). */
export const WEBCAM_BILATERAL_MAX_RADIUS = 2;
