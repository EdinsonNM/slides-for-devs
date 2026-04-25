import { useEffect, useRef, useState } from "react";
import type { FaceLandmarker, ImageSegmenter } from "@mediapipe/tasks-vision";
import { useUserMediaStream } from "../hooks/useUserMediaStream";
import { cn } from "../../../utils/cn";
import type { WebcamPanelState } from "../../../domain/webcam/webcamPanelModel";
import {
  WEBCAM_PORTRAIT_MAX_WIDTH,
  WEBCAM_PORTRAIT_MIN_FRAME_MS,
  WEBCAM_SEGMENT_EVERY_N_FRAMES,
  WEBCAM_FACE_LM_EVERY_N_FRAMES,
} from "../constants";
import {
  backgroundStrengthToBlurPx,
  compositePortraitOntoContext,
  renderVideoBuffers,
  copyFirstConfidenceMask,
} from "../lib/compositePortraitFrame";
import { fillFaceOvalInfluenceMap } from "../lib/faceOvalInfluenceMap";
import { fillEyeRegionPreserveMap } from "../lib/eyeRegionPreserveMap";
import { loadSelfieImageSegmenter } from "../lib/loadImageSegmenter";
import { loadFaceLandmarker } from "../lib/loadFaceLandmarker";
import { nextSegmenterFrameTimestampMs } from "../mediapipeFrameTimestamp";
import { disposeAllWebcamMediaPipe } from "../lib/disposeWebcamMediaPipe";
import { VideoOff, RefreshCw } from "lucide-react";

type Scratch = {
  sharp: HTMLCanvasElement;
  blurred: HTMLCanvasElement;
};

function makeScratch(): Scratch {
  return {
    sharp: document.createElement("canvas"),
    blurred: document.createElement("canvas"),
  };
}

export interface WebcamPipelineViewProps {
  state: WebcamPanelState;
  className?: string;
  mirrored?: boolean;
}

/**
 * Cámara: vídeo en directo, o compuesta (fondo desenfocado + suavidad / smoothness en primer plano).
 */
export function WebcamPipelineView({ state, className, mirrored = false }: WebcamPipelineViewProps) {
  const { videoRef, status, errorMessage, retry } = useUserMediaStream();
  const stateRef = useRef(state);
  stateRef.current = state;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scratchRef = useRef<Scratch | null>(null);
  const rafRef = useRef<number | null>(null);
  const segRef = useRef<ImageSegmenter | null>(null);
  const faceLmRef = useRef<FaceLandmarker | null>(null);
  const faceLmLoadRef = useRef<Promise<unknown> | null>(null);
  const eyeMapBufferRef = useRef<Float32Array | null>(null);
  const faceOvalMapBufferRef = useRef<Float32Array | null>(null);
  const lastFrRef = useRef(0);
  const workKeyRef = useRef<string>("");
  const effectFrameIndexRef = useRef(0);
  const lastPersonMaskRef = useRef<{
    data: Float32Array;
    width: number;
    height: number;
  } | null>(null);
  const faceLandmarkMapsReadyRef = useRef(false);
  const [portraitError, setPortraitError] = useState(false);
  const [portraitReady, setPortraitReady] = useState(false);

  const usePortrait = state.backgroundBlurStrength > 0 || state.faceSmoothStrength > 0;
  const showCanvas = usePortrait && !portraitError && portraitReady;

  useEffect(() => {
    if (!usePortrait) {
      setPortraitError(false);
      setPortraitReady(false);
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      segRef.current = null;
      faceLmRef.current = null;
      void disposeAllWebcamMediaPipe();
      return;
    }

    if (status !== "active") {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    if (!scratchRef.current) {
      scratchRef.current = makeScratch();
    }

    setPortraitError(false);
    setPortraitReady(false);
    lastFrRef.current = 0;
    workKeyRef.current = "";
    effectFrameIndexRef.current = 0;
    lastPersonMaskRef.current = null;
    faceLandmarkMapsReadyRef.current = false;
    let cancelled = false;

    void loadSelfieImageSegmenter()
      .then((s) => {
        if (cancelled) {
          return;
        }
        segRef.current = s;
        setPortraitReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setPortraitError(true);
        }
      });

    const runFrame = (now: number) => {
      if (cancelled) return;
      const st = stateRef.current;
      const v = videoRef.current;
      const c = canvasRef.current;
      if (!v || !c || !v.srcObject) {
        rafRef.current = requestAnimationFrame(runFrame);
        return;
      }
      if (st.backgroundBlurStrength <= 0 && st.faceSmoothStrength <= 0) {
        rafRef.current = requestAnimationFrame(runFrame);
        return;
      }
      if (now - lastFrRef.current < WEBCAM_PORTRAIT_MIN_FRAME_MS) {
        rafRef.current = requestAnimationFrame(runFrame);
        return;
      }
      lastFrRef.current = now;
      const seg = segRef.current;
      if (!seg) {
        rafRef.current = requestAnimationFrame(runFrame);
        return;
      }
      if (v.readyState < 2) {
        rafRef.current = requestAnimationFrame(runFrame);
        return;
      }
      const vw = v.videoWidth;
      const vh = v.videoHeight;
      if (vw < 2 || vh < 2) {
        rafRef.current = requestAnimationFrame(runFrame);
        return;
      }

      const workW = Math.min(WEBCAM_PORTRAIT_MAX_WIDTH, vw);
      const workH = Math.round((workW / vw) * vh);
      const wk = `${workW}x${workH}`;
      if (workKeyRef.current !== wk) {
        workKeyRef.current = wk;
        effectFrameIndexRef.current = 0;
        lastPersonMaskRef.current = null;
        faceLandmarkMapsReadyRef.current = false;
      }
      const frameIdx = effectFrameIndexRef.current;
      effectFrameIndexRef.current = frameIdx + 1;
      if (st.faceSmoothStrength === 0) {
        faceLandmarkMapsReadyRef.current = false;
      }
      const bgBlurPx = backgroundStrengthToBlurPx(st.backgroundBlurStrength);
      const scr = scratchRef.current;
      if (!scr) {
        rafRef.current = requestAnimationFrame(runFrame);
        return;
      }
      const { imageSharp, imageBlurred, imageSmooth } = renderVideoBuffers(
        v,
        workW,
        workH,
        bgBlurPx,
        st.faceSmoothStrength,
        scr,
      );
      const runSegment =
        lastPersonMaskRef.current === null || frameIdx % WEBCAM_SEGMENT_EVERY_N_FRAMES === 0;
      let mask: { data: Float32Array; width: number; height: number } | null = null;
      if (runSegment) {
        const timeMs = nextSegmenterFrameTimestampMs();
        const result = seg.segmentForVideo(v, timeMs);
        const m = copyFirstConfidenceMask(result);
        if (m) {
          lastPersonMaskRef.current = m;
        }
        mask = m;
      } else {
        mask = lastPersonMaskRef.current;
      }
      if (!mask) {
        rafRef.current = requestAnimationFrame(runFrame);
        return;
      }
      c.width = workW;
      c.height = workH;
      const octx = c.getContext("2d", { willReadFrequently: true });
      if (!octx) {
        rafRef.current = requestAnimationFrame(runFrame);
        return;
      }
      let eyeMap: Float32Array | null = null;
      let faceOvalMap: Float32Array | null = null;
      if (st.faceSmoothStrength > 0) {
        if (!faceLmRef.current && !faceLmLoadRef.current) {
          faceLmLoadRef.current = loadFaceLandmarker()
            .then((lm) => {
              faceLmRef.current = lm;
              return lm;
            })
            .catch(() => {
              faceLmRef.current = null;
              return null;
            })
            .finally(() => {
              faceLmLoadRef.current = null;
            });
        }
        if (faceLmRef.current) {
          const runFaceLandmarks =
            !faceLandmarkMapsReadyRef.current ||
            frameIdx % WEBCAM_FACE_LM_EVERY_N_FRAMES === 0;
          if (runFaceLandmarks) {
            const tsFace = nextSegmenterFrameTimestampMs();
            const fr = faceLmRef.current.detectForVideo(v, tsFace);
            if (!eyeMapBufferRef.current || eyeMapBufferRef.current.length !== workW * workH) {
              eyeMapBufferRef.current = new Float32Array(workW * workH);
            }
            if (!faceOvalMapBufferRef.current || faceOvalMapBufferRef.current.length !== workW * workH) {
              faceOvalMapBufferRef.current = new Float32Array(workW * workH);
            }
            const ebuf = eyeMapBufferRef.current;
            const fbuf = faceOvalMapBufferRef.current;
            fillEyeRegionPreserveMap(fr.faceLandmarks[0], workW, workH, ebuf);
            fillFaceOvalInfluenceMap(fr.faceLandmarks[0], workW, workH, fbuf);
            faceLandmarkMapsReadyRef.current = true;
          }
          eyeMap = eyeMapBufferRef.current;
          faceOvalMap = faceOvalMapBufferRef.current;
        }
      }
      compositePortraitOntoContext(
        octx,
        workW,
        workH,
        imageSharp,
        imageBlurred,
        imageSmooth,
        mask.data,
        mask.width,
        mask.height,
        st.faceSmoothStrength,
        eyeMap,
        faceOvalMap,
      );
      rafRef.current = requestAnimationFrame(runFrame);
    };

    rafRef.current = requestAnimationFrame(runFrame);
    return () => {
      cancelled = true;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      segRef.current = null;
      faceLmRef.current = null;
      void disposeAllWebcamMediaPipe();
    };
  }, [usePortrait, status, videoRef]);

  return (
    <div className={cn("relative h-full w-full min-h-0 min-w-0", className)}>
      {status === "error" ? (
        <div className="flex h-full min-h-[120px] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300/80 bg-stone-100/40 px-3 py-4 text-center dark:border-stone-600 dark:bg-stone-900/30">
          <VideoOff className="size-8 text-stone-400" strokeWidth={1.5} />
          <p className="text-[11px] text-stone-600 dark:text-stone-400">{errorMessage}</p>
          <button
            type="button"
            onClick={retry}
            className="inline-flex items-center gap-1 rounded-md bg-stone-800 px-2.5 py-1 text-[11px] font-medium text-white dark:bg-stone-200 dark:text-stone-900"
          >
            <RefreshCw className="size-3" />
            Reintentar
          </button>
        </div>
      ) : status === "idle" ? (
        <div className="flex h-full min-h-[120px] w-full items-center justify-center">
          <span
            className="size-6 animate-spin rounded-full border-2 border-stone-200 border-t-violet-600 dark:border-stone-600 dark:border-t-violet-400"
            aria-hidden
          />
        </div>
      ) : (
        <div className="relative h-full w-full min-h-0">
          <video
            ref={videoRef}
            className={cn(
              "absolute inset-0 h-full w-full object-cover",
              showCanvas && "pointer-events-none opacity-0",
              mirrored && "scale-x-[-1]",
            )}
            playsInline
            muted
            autoPlay
          />
          {usePortrait ? (
            <canvas
              ref={canvasRef}
              className={cn(
                "absolute inset-0 h-full w-full object-cover",
                !showCanvas && "invisible",
                mirrored && "scale-x-[-1]",
              )}
              aria-hidden
            />
          ) : null}
          {portraitError && usePortrait ? (
            <p className="sr-only" role="status">
              Efecto de fondo no disponible; se muestra la cámara sin procesar.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
