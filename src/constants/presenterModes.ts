export const PRESENTER_MODE_STORAGE_KEY = "slaim-presenter-mode";

export const PRESENTER_MODES = {
  POWERPOINT: "powerpoint",
  /** Carrusel de diapositivas (nombre histórico "cámara continua"). */
  CAMERA: "camera",
  JARVIS: "jarvis",
  /** Cámara web prioritaria con diapositiva flotante o repartos fijos. */
  FIRST_PERSON: "first_person",
} as const;

export type PresenterMode =
  (typeof PRESENTER_MODES)[keyof typeof PRESENTER_MODES];

export function isPresenterMode(value: unknown): value is PresenterMode {
  return (
    value === PRESENTER_MODES.POWERPOINT ||
    value === PRESENTER_MODES.CAMERA ||
    value === PRESENTER_MODES.JARVIS ||
    value === PRESENTER_MODES.FIRST_PERSON
  );
}
