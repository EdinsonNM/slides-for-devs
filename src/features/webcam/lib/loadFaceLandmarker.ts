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
