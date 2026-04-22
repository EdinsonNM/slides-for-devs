/** Permite al panel de propiedades pedir a la vista del mapa que persista la cámara actual. */

type CaptureFn = () => void;

let registered: CaptureFn | null = null;

export function registerMapSlideViewportCapture(fn: CaptureFn | null): void {
  registered = fn;
}

export function requestMapSlideViewportCapture(): void {
  registered?.();
}
