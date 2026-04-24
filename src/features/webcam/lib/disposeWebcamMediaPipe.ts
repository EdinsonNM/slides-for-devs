import { resetSegmenterFrameTimestampClock } from "../mediapipeFrameTimestamp";
import { disposeSelfieImageSegmenter } from "./loadImageSegmenter";
import { disposeFaceLandmarker } from "./loadFaceLandmarker";
import { resetVisionTasksFileset } from "./loadVisionTasksFileset";

/**
 * Libera modelos de MediaPipe (segmentador + landmarker) y el fileset wasm compartido.
 * Llamar cuando el modo retrato (desenfoque / suavidad) queda en 0 o el panel se desmonta.
 */
export async function disposeAllWebcamMediaPipe(): Promise<void> {
  await Promise.all([disposeSelfieImageSegmenter(), disposeFaceLandmarker()]);
  resetVisionTasksFileset();
  resetSegmenterFrameTimestampClock();
}
