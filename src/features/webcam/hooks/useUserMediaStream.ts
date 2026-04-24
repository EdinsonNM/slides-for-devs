import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

export type UserMediaStatus = "idle" | "active" | "error";

export interface UseUserMediaStreamResult {
  videoRef: RefObject<HTMLVideoElement | null>;
  status: UserMediaStatus;
  errorMessage: string | null;
  retry: () => void;
}

/**
 * Ciclo de vida de `getUserMedia` (vídeo frontal) para vista de cámara.
 */
export function useUserMediaStream(): UseUserMediaStreamResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<UserMediaStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
          : "No se pudo acceder a la cámara. Revisa permisos.";
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

  const retry = useCallback(() => {
    void startStream();
  }, [startStream]);

  return { videoRef, status, errorMessage, retry };
}
