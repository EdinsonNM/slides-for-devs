import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
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
  const prevObserveKeyRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    const rebinds =
      prevObserveKeyRef.current != null && prevObserveKeyRef.current !== observeKey;
    prevObserveKeyRef.current = observeKey;

    if (rebinds) {
      setHostSize({ width: 0, height: 0 });
    }

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
  const gl = useThree((s) => s.gl);
  const setSize = useThree((s) => s.setSize);
  const invalidate = useThree((s) => s.invalidate);
  const wasSizeInvalidRef = useRef(true);

  useLayoutEffect(() => {
    const invalid = width <= 0 || height <= 0;
    if (invalid) {
      wasSizeInvalidRef.current = true;
      return;
    }

    const fromInvalid = wasSizeInvalidRef.current;
    wasSizeInvalidRef.current = false;

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
    const id2 = fromInvalid
      ? requestAnimationFrame(() => {
          setSize(width, height);
          invalidate();
        })
      : 0;
    return () => {
      cancelAnimationFrame(id0);
      cancelAnimationFrame(id1);
      if (fromInvalid && id2) cancelAnimationFrame(id2);
    };
  }, [height, invalidate, setSize, syncKey, width]);

  useEffect(() => {
    const canvas = gl.domElement;
    const onRestored = () => {
      if (width <= 0 || height <= 0) return;
      try {
        setSize(width, height);
        invalidate();
        requestAnimationFrame(() => {
          setSize(width, height);
          invalidate();
        });
      } catch {
        // Contexto aún inestable durante transición: evitar reventar el hilo si el driver tira
      }
    };
    canvas.addEventListener("webglcontextrestored", onRestored, false);
    return () => {
      canvas.removeEventListener("webglcontextrestored", onRestored, false);
    };
  }, [gl, height, invalidate, setSize, width]);

  return null;
}
