/** Presentador: permite centrar el mapa por geocodificación sin tocar el estado persistido del slide. */

type FlyToCenter = { lng: number; lat: number };

type FlyToFn = (center: FlyToCenter, zoom?: number) => void;

let registered: FlyToFn | null = null;
let registeredOwnerId = 0;

let nextOwnerId = 1;

/** Un id estable por instancia de `SlideMapboxCanvas` para no pisar el registro global con varios mapas montados. */
export function createPresenterMapFlyToOwnerId(): number {
  return nextOwnerId++;
}

/**
 * Registra el fly-to del mapa activo. `fn === null` solo quita el registro si `ownerId`
 * es el dueño actual (así las instancias sin buscador no borran el mapa de la diapositiva actual).
 */
export function registerPresenterMapFlyTo(ownerId: number, fn: FlyToFn | null): void {
  if (fn) {
    registered = fn;
    registeredOwnerId = ownerId;
    return;
  }
  if (registeredOwnerId === ownerId) {
    registered = null;
    registeredOwnerId = 0;
  }
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
