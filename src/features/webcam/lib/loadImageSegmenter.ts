import { ImageSegmenter } from "@mediapipe/tasks-vision";
import { selfieSegmenterModelUrl } from "../constants";
import { resetSegmenterFrameTimestampClock } from "../mediapipeFrameTimestamp";
import { loadVisionTasksFileset } from "./loadVisionTasksFileset";

let segmenterPromise: Promise<ImageSegmenter> | null = null;
let lastError: Error | null = null;

export function getImageSegmenterLoadError(): Error | null {
  return lastError;
}

/**
 * Carga perezosa y singleton del segmentador (~ selfie) para reutilizar entre instancias de cámara.
 */
export function loadSelfieImageSegmenter(): Promise<ImageSegmenter> {
  if (segmenterPromise) {
    return segmenterPromise;
  }
  lastError = null;
  segmenterPromise = (async () => {
    resetSegmenterFrameTimestampClock();
    const wasm = await loadVisionTasksFileset();
    return await ImageSegmenter.createFromOptions(wasm, {
      baseOptions: {
        modelAssetPath: selfieSegmenterModelUrl(),
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      outputConfidenceMasks: true,
    });
  })().catch((e: unknown) => {
    const err = e instanceof Error ? e : new Error(String(e));
    lastError = err;
    segmenterPromise = null;
    throw err;
  });
  return segmenterPromise;
}

export function resetImageSegmenterSingletonForTests(): void {
  segmenterPromise = null;
  lastError = null;
  resetSegmenterFrameTimestampClock();
}
