/**
 * MediaPipe `segmentForVideo` requiere timestamps en ms estrictamente crecientes durante la vida
 * del grafo. Reiniciar `performance.now() - t0` al cambiar sliders/re-renders rompe el singleton
 * (p. ej. "received -12899" frente a mínimo ~2e6) y deja el frame en negro.
 */
let lastMonotonicFrameMs = 0;

export function nextSegmenterFrameTimestampMs(): number {
  const t = performance.now();
  if (lastMonotonicFrameMs === 0) {
    lastMonotonicFrameMs = t;
  } else {
    lastMonotonicFrameMs = Math.max(lastMonotonicFrameMs + 1, t);
  }
  return lastMonotonicFrameMs;
}

/** Llamar al crear un `ImageSegmenter` nuevo o en tests, no al cambiar solo UI. */
export function resetSegmenterFrameTimestampClock(): void {
  lastMonotonicFrameMs = 0;
}
