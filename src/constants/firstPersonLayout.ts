/**
 * Submodos de vista previa "First person": reparto cámara vs diapositiva.
 * Solo aplica cuando `presenterMode === PRESENTER_MODES.FIRST_PERSON`.
 */
export const FIRST_PERSON_LAYOUTS = {
  /** Cámara a pantalla completa; la diapositiva flota (arrastrable). */
  CAMERA_PRIMARY: "camera-primary",
  /** Diapositiva principal; cámara en picture-in-picture (arrastrable). */
  CONTENT_PRIMARY: "content-primary",
  /** 50% cámara / 50% contenido (división fija, responsive). */
  SPLIT_50: "split-50",
} as const;

export type FirstPersonLayout =
  (typeof FIRST_PERSON_LAYOUTS)[keyof typeof FIRST_PERSON_LAYOUTS];

export const FIRST_PERSON_LAYOUT_LABELS: Record<FirstPersonLayout, string> = {
  [FIRST_PERSON_LAYOUTS.CAMERA_PRIMARY]: "Cámara grande · slides flotante",
  [FIRST_PERSON_LAYOUTS.CONTENT_PRIMARY]: "Contenido grande · cámara pequeña",
  [FIRST_PERSON_LAYOUTS.SPLIT_50]: "Mitad y mitad",
};

export const FIRST_PERSON_LAYOUT_STORAGE_KEY = "slaim-first-person-layout";

const FIRST_PERSON_FLOAT_STORAGE_KEY = "slaim-first-person-float-v1";

/** Mín. ~25% del ancho base del panel flotante. */
export const FIRST_PERSON_FLOAT_SCALE_MIN = 0.25;
/**
 * Máx. relativo al ancho base (p. ej. 5 = 500% del panel por defecto).
 * El ancho en pantalla sigue pudiendo acotarse por CSS (viewport) en el componente.
 */
export const FIRST_PERSON_FLOAT_SCALE_MAX = 8;

function clampScale(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(
    FIRST_PERSON_FLOAT_SCALE_MAX,
    Math.max(FIRST_PERSON_FLOAT_SCALE_MIN, n),
  );
}

export type FirstPersonFloatState = {
  x: number;
  y: number;
  /** PIP slide (cámara grande) o escala unificada; ver `FIRST_PERSON_FLOAT_SCALE_*`. */
  scale: number;
  /**
   * Solo `content-primary` (cámara PiP): ancho y alto independientes respecto a las bases
   * del componente. Si faltan, se usa `scale` para ambos.
   */
  pipW?: number;
  pipH?: number;
};

const DEFAULT_FLOAT: Record<FirstPersonLayout, FirstPersonFloatState> = {
  [FIRST_PERSON_LAYOUTS.CAMERA_PRIMARY]: { x: 0.78, y: 0.26, scale: 1 },
  [FIRST_PERSON_LAYOUTS.CONTENT_PRIMARY]: { x: 0.22, y: 0.26, scale: 1 },
  [FIRST_PERSON_LAYOUTS.SPLIT_50]: { x: 0.5, y: 0.5, scale: 1 },
};

export function isFirstPersonLayout(value: unknown): value is FirstPersonLayout {
  return (
    value === FIRST_PERSON_LAYOUTS.CAMERA_PRIMARY ||
    value === FIRST_PERSON_LAYOUTS.CONTENT_PRIMARY ||
    value === FIRST_PERSON_LAYOUTS.SPLIT_50
  );
}

export function readFirstPersonFloat(
  layout: FirstPersonLayout,
): FirstPersonFloatState {
  if (typeof window === "undefined") return { ...DEFAULT_FLOAT[layout] };
  try {
    const raw = window.localStorage.getItem(FIRST_PERSON_FLOAT_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_FLOAT[layout] };
    const map = JSON.parse(raw) as Record<
      string,
      {
        x: number;
        y: number;
        scale?: number;
        pipW?: number;
        pipH?: number;
      }
    >;
    const hit = map[layout];
    if (
      hit &&
      typeof hit.x === "number" &&
      typeof hit.y === "number" &&
      Number.isFinite(hit.x) &&
      Number.isFinite(hit.y)
    ) {
      const sc = clampScale(
        hit.scale !== undefined && typeof hit.scale === "number"
          ? hit.scale
          : 1,
      );
      const out: FirstPersonFloatState = {
        x: clamp01(hit.x),
        y: clamp01(hit.y),
        scale: sc,
      };
      if (hit.pipW !== undefined && typeof hit.pipW === "number" && Number.isFinite(hit.pipW)) {
        out.pipW = clampScale(hit.pipW);
      }
      if (hit.pipH !== undefined && typeof hit.pipH === "number" && Number.isFinite(hit.pipH)) {
        out.pipH = clampScale(hit.pipH);
      }
      return out;
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_FLOAT[layout] };
}

export function writeFirstPersonFloat(
  layout: FirstPersonLayout,
  state: FirstPersonFloatState,
): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(FIRST_PERSON_FLOAT_STORAGE_KEY);
    const map: Record<string, FirstPersonFloatState> = raw
      ? (JSON.parse(raw) as Record<string, FirstPersonFloatState>)
      : {};
    const entry: FirstPersonFloatState = {
      x: clamp01(state.x),
      y: clamp01(state.y),
      scale: clampScale(state.scale),
    };
    if (state.pipW !== undefined) {
      entry.pipW = clampScale(state.pipW);
    }
    if (state.pipH !== undefined) {
      entry.pipH = clampScale(state.pipH);
    }
    map[layout] = entry;
    window.localStorage.setItem(
      FIRST_PERSON_FLOAT_STORAGE_KEY,
      JSON.stringify(map),
    );
  } catch {
    // ignore
  }
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
