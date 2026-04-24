import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";

const DEFAULT_MS = 450;

/**
 * Emite un data URL del canvas WebGL a intervalos (mientras el visor 3D está montado) para
 * mostrar una vista estática al deseleccionar el bloque y desmontar el R3F.
 */
export function R3fWebglThrottledSnapshot({
  onSnapshot,
  intervalMs = DEFAULT_MS,
}: {
  onSnapshot: (dataUrl: string) => void;
  intervalMs?: number;
}) {
  const { gl } = useThree();
  const lastTRef = useRef(0);

  useFrame(() => {
    const t = performance.now();
    if (t - lastTRef.current < intervalMs) return;
    lastTRef.current = t;
    try {
      onSnapshot(gl.domElement.toDataURL("image/png"));
    } catch {
      // tainted, política, etc.
    }
  });
  return null;
}
