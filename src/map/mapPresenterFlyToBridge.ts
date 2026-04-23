/** Presentador: permite centrar el mapa por geocodificación sin tocar el estado persistido del slide. */

type FlyToCenter = { lng: number; lat: number };

type FlyToFn = (center: FlyToCenter, zoom?: number) => void;

let registered: FlyToFn | null = null;

export function registerPresenterMapFlyTo(fn: FlyToFn | null): void {
  registered = fn;
}

/**
 * Mueve la cámara del mapa en la ventana de presentación. No persiste nada.
 * @returns true si el mapa de la diapositiva estaba conectado.
 */
export function requestPresenterMapFlyTo(center: FlyToCenter, zoom?: number): boolean {
  if (!registered) return false;
  registered(center, zoom);
  return true;
}
