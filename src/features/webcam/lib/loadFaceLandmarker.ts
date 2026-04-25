import { FaceLandmarker } from "@mediapipe/tasks-vision";
import { faceLandmarkerModelUrl } from "../constants";
import { loadVisionTasksFileset } from "./loadVisionTasksFileset";

let landmarkerPromise: Promise<FaceLandmarker> | null = null;
let lastError: Error | null = null;

export function getFaceLandmarkerLoadError(): Error | null {
  return lastError;
}

export function loadFaceLandmarker(): Promise<FaceLandmarker> {
  if (landmarkerPromise) {
    return landmarkerPromise;
  }
  lastError = null;
  landmarkerPromise = (async () => {
    const wasm = await loadVisionTasksFileset();
    return await FaceLandmarker.createFromOptions(wasm, {
      baseOptions: {
        modelAssetPath: faceLandmarkerModelUrl(),
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      numFaces: 1,
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
    });
  })().catch((e: unknown) => {
    const err = e instanceof Error ? e : new Error(String(e));
    lastError = err;
    landmarkerPromise = null;
    throw err;
  });
  return landmarkerPromise;
}

/**
 * Cierra el `FaceLandmarker` y libera recursos. Idempotente.
 */
export function disposeFaceLandmarker(): Promise<void> {
  const pending = landmarkerPromise;
  landmarkerPromise = null;
  lastError = null;
  if (!pending) {
    return Promise.resolve();
  }
  return pending
    .then((lm) => {
      try {
        lm.close();
      } catch {
        /* ya cerrado */
      }
    })
    .catch(() => undefined);
}
