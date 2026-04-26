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
  /** ~65% diapositiva izq. · cámara estrecha dcha. (desktop en fila). */
  SPLIT_65_SLIDE_LEFT: "split-65-slide-left",
  /** Cámara estrecha izq. · ~65% diapositiva dcha. */
  SPLIT_65_SLIDE_RIGHT: "split-65-slide-right",
} as const;

export type FirstPersonLayout =
  (typeof FIRST_PERSON_LAYOUTS)[keyof typeof FIRST_PERSON_LAYOUTS];

export const FIRST_PERSON_LAYOUT_LABELS: Record<FirstPersonLayout, string> = {
  [FIRST_PERSON_LAYOUTS.CAMERA_PRIMARY]: "Cámara grande · slides flotante",
  [FIRST_PERSON_LAYOUTS.CONTENT_PRIMARY]: "Contenido grande · cámara pequeña",
  [FIRST_PERSON_LAYOUTS.SPLIT_50]: "Mitad y mitad",
  [FIRST_PERSON_LAYOUTS.SPLIT_65_SLIDE_LEFT]: "Contenido izq. · cámara estrecha dcha.",
  [FIRST_PERSON_LAYOUTS.SPLIT_65_SLIDE_RIGHT]: "Cámara estrecha izq. · contenido dcha.",
};

export const FIRST_PERSON_LAYOUT_STORAGE_KEY = "slaim-first-person-layout";

const FIRST_PERSON_KEY_ORDER_STORAGE_KEY = "slaim-first-person-key-order";

/** Todos los modos; el orden de teclas 1,2,…,0 se persiste y puede reordenarse (DnD). */
export const DEFAULT_FIRST_PERSON_KEY_ORDER: FirstPersonLayout[] = [
  FIRST_PERSON_LAYOUTS.CAMERA_PRIMARY,
  FIRST_PERSON_LAYOUTS.CONTENT_PRIMARY,
  FIRST_PERSON_LAYOUTS.SPLIT_50,
  FIRST_PERSON_LAYOUTS.SPLIT_65_SLIDE_LEFT,
  FIRST_PERSON_LAYOUTS.SPLIT_65_SLIDE_RIGHT,
];

const ALL_FIRST_PERSON_LAYOUTS_SET = new Set<string>(DEFAULT_FIRST_PERSON_KEY_ORDER);

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
  [FIRST_PERSON_LAYOUTS.SPLIT_65_SLIDE_LEFT]: { x: 0.5, y: 0.5, scale: 1 },
  [FIRST_PERSON_LAYOUTS.SPLIT_65_SLIDE_RIGHT]: { x: 0.5, y: 0.5, scale: 1 },
};

export function isFirstPersonLayout(value: unknown): value is FirstPersonLayout {
  return (
    typeof value === "string" && ALL_FIRST_PERSON_LAYOUTS_SET.has(value)
  );
}

export function isFirstPersonFixedSplitLayout(
  layout: FirstPersonLayout,
): boolean {
  return (
    layout === FIRST_PERSON_LAYOUTS.SPLIT_50 ||
    layout === FIRST_PERSON_LAYOUTS.SPLIT_65_SLIDE_LEFT ||
    layout === FIRST_PERSON_LAYOUTS.SPLIT_65_SLIDE_RIGHT
  );
}

export function normalizeFirstPersonKeyOrder(
  raw: FirstPersonLayout[] | undefined,
): FirstPersonLayout[] {
  const seen = new Set<FirstPersonLayout>();
  const out: FirstPersonLayout[] = [];
  for (const v of raw ?? []) {
    if (isFirstPersonLayout(v) && !seen.has(v)) {
      out.push(v);
      seen.add(v);
    }
  }
  for (const v of DEFAULT_FIRST_PERSON_KEY_ORDER) {
    if (!seen.has(v)) {
      out.push(v);
    }
  }
  return out;
}

export function readFirstPersonKeyOrder(): FirstPersonLayout[] {
  if (typeof window === "undefined") {
    return [...DEFAULT_FIRST_PERSON_KEY_ORDER];
  }
  try {
    const s = window.localStorage.getItem(FIRST_PERSON_KEY_ORDER_STORAGE_KEY);
    if (!s) return [...DEFAULT_FIRST_PERSON_KEY_ORDER];
    const parsed = JSON.parse(s) as unknown;
    if (!Array.isArray(parsed)) {
      return [...DEFAULT_FIRST_PERSON_KEY_ORDER];
    }
    return normalizeFirstPersonKeyOrder(
      parsed.filter(isFirstPersonLayout) as FirstPersonLayout[],
    );
  } catch {
    return [...DEFAULT_FIRST_PERSON_KEY_ORDER];
  }
}

export function writeFirstPersonKeyOrder(
  order: FirstPersonLayout[],
): void {
  if (typeof window === "undefined") return;
  try {
    const normalized = normalizeFirstPersonKeyOrder(order);
    window.localStorage.setItem(
      FIRST_PERSON_KEY_ORDER_STORAGE_KEY,
      JSON.stringify(normalized),
    );
  } catch {
    // ignore
  }
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
