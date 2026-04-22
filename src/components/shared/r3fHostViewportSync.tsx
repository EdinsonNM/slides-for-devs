import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { useThree } from "@react-three/fiber";

export type HostElementSize = { width: number; height: number };

/**
 * Mide el rect real de un elemento host (px enteros) y se actualiza con ResizeObserver.
 * Útil cuando el `Canvas` de R3F vive bajo transforms/animaciones y la medición inicial falla.
 */
export function useHostElementSize(
  observeKey: string,
): [RefObject<HTMLDivElement | null>, HostElementSize] {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [hostSize, setHostSize] = useState<HostElementSize>({
    width: 0,
    height: 0,
  });

  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      const nextW = Math.max(0, Math.round(rect.width));
      const nextH = Math.max(0, Math.round(rect.height));
      setHostSize((prev) =>
        prev.width === nextW && prev.height === nextH ? prev : { width: nextW, height: nextH },
      );
    };

    measure();
    // Tras cambios de layout por transform (p. ej. cámara continua), un frame extra
    // suele alinear el rect con el compositor antes de inicializar WebGL.
    const postLayoutId = requestAnimationFrame(() => measure());

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => {
        cancelAnimationFrame(postLayoutId);
        window.removeEventListener("resize", measure);
      };
    }

    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => {
      cancelAnimationFrame(postLayoutId);
      ro.disconnect();
    };
  }, [observeKey]);

  return [hostRef, hostSize];
}

/**
 * Fuerza el tamaño interno del renderer R3F al rect medido del host DOM.
 *
 * Nota: en R3F v9 `CanvasProps` omite `size`; el camino soportado es `RootState.setSize`.
 */
export function R3fViewportResizeToHost({
  width,
  height,
  /** Cuando cambia (p. ej. slide activo en cámara continua), fuerza otro `setSize` aunque w/h sean iguales. */
  syncKey,
}: {
  width: number;
  height: number;
  syncKey?: string;
}) {
  const setSize = useThree((s) => s.setSize);
  const invalidate = useThree((s) => s.invalidate);

  useLayoutEffect(() => {
    if (width <= 0 || height <= 0) return;
    setSize(width, height);
    invalidate();
    const id0 = requestAnimationFrame(() => {
      setSize(width, height);
      invalidate();
    });
    const id1 = requestAnimationFrame(() => {
      setSize(width, height);
      invalidate();
    });
    return () => {
      cancelAnimationFrame(id0);
      cancelAnimationFrame(id1);
    };
  }, [height, invalidate, setSize, syncKey, width]);

  return null;
}
