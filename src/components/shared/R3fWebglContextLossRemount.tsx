import { useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";

const MAX_AUTO_REMOUNTS = 4;

/**
 * Cuando el navegador pierde el contexto WebGL (memoria GPU, demasiados canvas, driver…),
 * el lienzo deja de pintar; en Chromium a veces aparece un icono de “recurso roto” / error.
 * `preventDefault` en `webglcontextlost` permite reintentar; forzamos remount del `<Canvas>`
 * padre cambiando su `key` (hasta `MAX_AUTO_REMOUNTS` veces por montaje del host).
 */
export function R3fWebglContextLossRemount({
  onRemountRequest,
}: {
  onRemountRequest: () => void;
}) {
  const gl = useThree((s) => s.gl);
  const attempts = useRef(0);

  useEffect(() => {
    const canvas = gl.domElement;
    const onLost = (e: Event) => {
      e.preventDefault();
      if (attempts.current >= MAX_AUTO_REMOUNTS) return;
      attempts.current += 1;
      queueMicrotask(() => {
        onRemountRequest();
      });
    };
    canvas.addEventListener("webglcontextlost", onLost, false);
    return () => {
      canvas.removeEventListener("webglcontextlost", onLost, false);
    };
  }, [gl, onRemountRequest]);

  return null;
}
