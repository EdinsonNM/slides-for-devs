/**
 * Estado del panel de cámara en vivo (máscara y espejo). Persistido en el slide y en el payload del lienzo.
 */
export const WEBCAM_MASK_SHAPE = {
  ROUNDED_RECT: "rounded-rect",
  CIRCLE: "circle",
  PILL: "pill",
  HEXAGON: "hexagon",
  DIAMOND: "diamond",
} as const;

export type WebcamMaskShape = (typeof WEBCAM_MASK_SHAPE)[keyof typeof WEBCAM_MASK_SHAPE];

/** Intensidad 0–100 (desenfoque del fondo vía segmentación). */
export const WEBCAM_INTENSITY_MIN = 0;
export const WEBCAM_INTENSITY_MAX = 100;

export interface WebcamPanelState {
  maskShape: WebcamMaskShape;
  mirrored: boolean;
  /** 0 = sin blur de fondo; 100 = máximo. */
  backgroundBlurStrength: number;
  /** 0 = sin suavizado; 100 = máximo en primer plano (silueta segmentada). */
  faceSmoothStrength: number;
}

const ALL_SHAPES = new Set<string>(Object.values(WEBCAM_MASK_SHAPE));

function clampIntensity(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return WEBCAM_INTENSITY_MIN;
  return Math.min(
    WEBCAM_INTENSITY_MAX,
    Math.max(WEBCAM_INTENSITY_MIN, Math.round(v)),
  );
}

export function createDefaultWebcamPanelState(): WebcamPanelState {
  return {
    maskShape: WEBCAM_MASK_SHAPE.ROUNDED_RECT,
    mirrored: true,
    backgroundBlurStrength: WEBCAM_INTENSITY_MIN,
    faceSmoothStrength: WEBCAM_INTENSITY_MIN,
  };
}

export function normalizeWebcamPanelState(
  raw: WebcamPanelState | undefined | null,
): WebcamPanelState {
  const d = createDefaultWebcamPanelState();
  if (!raw || typeof raw !== "object") return d;
  const shape = (raw as { maskShape?: string }).maskShape;
  const maskShape =
    typeof shape === "string" && ALL_SHAPES.has(shape)
      ? (shape as WebcamMaskShape)
      : d.maskShape;
  const r = raw as {
    backgroundBlurStrength?: unknown;
    faceSmoothStrength?: unknown;
  };
  return {
    maskShape,
    mirrored: typeof raw.mirrored === "boolean" ? raw.mirrored : d.mirrored,
    backgroundBlurStrength:
      r.backgroundBlurStrength !== undefined
        ? clampIntensity(r.backgroundBlurStrength)
        : d.backgroundBlurStrength,
    faceSmoothStrength:
      r.faceSmoothStrength !== undefined
        ? clampIntensity(r.faceSmoothStrength)
        : d.faceSmoothStrength,
  };
}
