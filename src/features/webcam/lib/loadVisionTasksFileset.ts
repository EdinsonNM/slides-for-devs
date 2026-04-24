import { FilesetResolver } from "@mediapipe/tasks-vision";
import { mediapipeWasmBasePath } from "../constants";

type VisionWasmFileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;

let filesetPromise: Promise<VisionWasmFileset> | null = null;

/** Un solo wasm compartido entre ImageSegmenter, FaceLandmarker, etc. */
export function loadVisionTasksFileset(): Promise<VisionWasmFileset> {
  if (filesetPromise) {
    return filesetPromise;
  }
  const wasmPath = mediapipeWasmBasePath();
  filesetPromise = FilesetResolver.forVisionTasks(wasmPath, false);
  return filesetPromise;
}
