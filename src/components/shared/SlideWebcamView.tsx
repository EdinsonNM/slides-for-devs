import { useCallback, useEffect, useId, useRef, useState } from "react";
import { VideoOff, RefreshCw } from "lucide-react";
import { cn } from "../../utils/cn";
import { getWebcamMaskBoxProps } from "./webcamMaskBox";
import {
  type WebcamPanelState,
} from "../../domain/webcam/webcamPanelModel";

export interface SlideWebcamViewProps {
  state: WebcamPanelState;
  className?: string;
}

export function SlideWebcamView({ state, className }: SlideWebcamViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<"idle" | "active" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const labelId = useId();
  const mask = getWebcamMaskBoxProps(state.maskShape);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startStream = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setErrorMessage("Cámara no disponible en este entorno.");
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
      setStatus("active");
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : "No se pudo acceder a la cámara. Revisa permisos.";
      setErrorMessage(msg);
      setStatus("error");
    }
  }, [stopStream]);

  // El <video> solo existe cuando `status === "active"`, así que el stream se obtuvo mientras
  // aún no había ref. Tras el cambio a "active" el video se monta; aquí enlazamos y reproducimos.
  useEffect(() => {
    if (status !== "active") return;
    const stream = streamRef.current;
    const el = videoRef.current;
    if (!stream || !el) return;
    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }
    void el.play().catch(() => {
      // Autoplay a veces falla; el usuario sigue pudiendo usar Reintentar.
    });
  }, [status]);

  useEffect(() => {
    void startStream();
    return () => {
      stopStream();
    };
  }, [startStream, stopStream]);

  return (
    <div
      className={cn(
        "flex min-h-0 w-full min-w-0 flex-1 items-center justify-center",
        className,
      )}
    >
      <p id={labelId} className="sr-only">
        Vista cámara en vivo
      </p>
      <div
        className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-col items-stretch"
        aria-labelledby={labelId}
      >
        {status === "error" ? (
          <div className="flex h-full min-h-[120px] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300/80 bg-stone-100/40 px-3 py-4 text-center dark:border-stone-600 dark:bg-stone-900/30">
            <VideoOff className="size-8 text-stone-400" strokeWidth={1.5} />
            <p className="text-[11px] text-stone-600 dark:text-stone-400">{errorMessage}</p>
            <button
              type="button"
              onClick={() => void startStream()}
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
          <div
            className={cn("mx-auto h-full w-full min-h-0", mask.className)}
            style={mask.style}
          >
            <video
              ref={videoRef}
              className={cn("h-full w-full object-cover", state.mirrored && "scale-x-[-1]")}
              playsInline
              muted
              autoPlay
            />
          </div>
        )}
      </div>
    </div>
  );
}
