import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { RefreshCw, Video, VideoOff, FlipHorizontal2 } from "lucide-react";
import { cn } from "../../utils/cn";
import {
  CAMERA_MASK_OPTIONS,
  CAMERA_MASK_SHAPE,
  type CameraMaskShape,
} from "../../constants/cameraMaskShapes";

const HEX_CLIP =
  "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)";
const DIAMOND_CLIP = "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)";

function maskWrapperClassAndStyle(shape: CameraMaskShape): {
  className: string;
  style?: CSSProperties;
} {
  switch (shape) {
    case CAMERA_MASK_SHAPE.ROUNDED_RECT:
      return {
        className: "aspect-video w-full max-w-[280px] overflow-hidden rounded-2xl bg-stone-900/20 ring-1 ring-stone-200/80 dark:ring-stone-700/60",
      };
    case CAMERA_MASK_SHAPE.CIRCLE:
      return {
        className:
          "aspect-square w-full max-w-[220px] overflow-hidden rounded-full bg-stone-900/20 ring-1 ring-stone-200/80 dark:ring-stone-700/60",
      };
    case CAMERA_MASK_SHAPE.PILL:
      return {
        className:
          "aspect-video w-full max-w-[280px] overflow-hidden rounded-[9999px] bg-stone-900/20 ring-1 ring-stone-200/80 dark:ring-stone-700/60",
      };
    case CAMERA_MASK_SHAPE.HEXAGON:
      return {
        className: "aspect-[1/0.86] w-full max-w-[220px] overflow-hidden bg-stone-900/20",
        style: {
          WebkitClipPath: HEX_CLIP,
          clipPath: HEX_CLIP,
        },
      };
    case CAMERA_MASK_SHAPE.DIAMOND:
      return {
        className: "aspect-square w-full max-w-[200px] overflow-hidden bg-stone-900/20",
        style: {
          WebkitClipPath: DIAMOND_CLIP,
          clipPath: DIAMOND_CLIP,
        },
      };
  }
}

export function CameraInspectorPanel() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [maskShape, setMaskShape] = useState<CameraMaskShape>(CAMERA_MASK_SHAPE.ROUNDED_RECT);
  const [mirrored, setMirrored] = useState(true);
  const [status, setStatus] = useState<"idle" | "active" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const labelId = useId();
  const mask = maskWrapperClassAndStyle(maskShape);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startStream = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setErrorMessage("Tu navegador no permite acceder a la cámara.");
      setStatus("error");
      return;
    }
    setStatus("idle");
    setErrorMessage(null);
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      const el = videoRef.current;
      if (el) {
        el.srcObject = stream;
        await el.play();
      }
      setStatus("active");
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : "No se pudo acceder a la cámara. Comprueba permisos y HTTPS o localhost.";
      setErrorMessage(msg);
      setStatus("error");
    }
  }, [stopStream]);

  useEffect(() => {
    void startStream();
    return () => {
      stopStream();
    };
  }, [startStream, stopStream]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-surface-elevated">
      <div className="shrink-0 border-b border-stone-100 px-3 py-2.5 dark:border-border">
        <div className="flex items-center gap-2">
          <Video className="size-4 text-violet-600 dark:text-violet-400" strokeWidth={2} />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Cámara
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-snug text-stone-500 dark:text-stone-400">
          Vista previa en directo. Elige la forma de recorte. Cierra otras pestañas del inspector
          para apagar el vídeo.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
        <div
          className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-stone-200 bg-stone-50/50 p-4 dark:border-stone-700/80 dark:bg-stone-950/30"
          aria-labelledby={labelId}
        >
          <p id={labelId} className="sr-only">
            Vista previa de la cámara
          </p>
          {status === "error" ? (
            <div className="flex max-w-sm flex-col items-center gap-3 text-center">
              <VideoOff className="size-10 text-stone-400" strokeWidth={1.5} />
              <p className="text-xs text-stone-600 dark:text-stone-400">{errorMessage}</p>
              <button
                type="button"
                onClick={() => void startStream()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition hover:opacity-90"
              >
                <RefreshCw className="size-3.5" />
                Reintentar
              </button>
            </div>
          ) : status === "idle" ? (
            <div className="flex flex-col items-center gap-3 py-10 text-xs text-muted-foreground">
              <span
                className="size-7 animate-spin rounded-full border-2 border-stone-200 border-t-violet-600 dark:border-stone-700 dark:border-t-violet-400"
                aria-hidden
              />
              Conectando con la cámara…
            </div>
          ) : (
            <div className={cn("mx-auto", mask.className)} style={mask.style}>
              <video
                ref={videoRef}
                className={cn("h-full w-full object-cover", mirrored && "scale-x-[-1]")}
                playsInline
                muted
                autoPlay
              />
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Forma de máscara
          </p>
          <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Forma de máscara">
            {CAMERA_MASK_OPTIONS.map(({ id, label }) => {
              const active = maskShape === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setMaskShape(id)}
                  className={cn(
                    "w-full rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition",
                    active
                      ? "border-violet-500/70 bg-violet-50/90 text-violet-950 dark:border-violet-500/50 dark:bg-violet-950/40 dark:text-violet-100"
                      : "border-stone-200/90 bg-white text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:bg-surface-elevated dark:text-stone-200 dark:hover:bg-stone-900/50",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-lg border border-stone-200/80 bg-stone-50/50 px-2.5 py-2 dark:border-stone-700/80 dark:bg-stone-900/20">
          <span className="text-xs text-stone-700 dark:text-stone-300">Espejo (selfie)</span>
          <button
            type="button"
            onClick={() => setMirrored((m) => !m)}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition",
              mirrored
                ? "bg-violet-100 text-violet-900 dark:bg-violet-900/50 dark:text-violet-100"
                : "bg-stone-200/60 text-stone-700 dark:bg-stone-800 dark:text-stone-300",
            )}
            aria-pressed={mirrored}
          >
            <FlipHorizontal2 className="size-3.5" />
            {mirrored ? "Sí" : "No"}
          </button>
        </div>
      </div>
    </div>
  );
}
