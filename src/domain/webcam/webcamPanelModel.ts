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

export interface WebcamPanelState {
  maskShape: WebcamMaskShape;
  mirrored: boolean;
}

const ALL_SHAPES = new Set<string>(Object.values(WEBCAM_MASK_SHAPE));

export function createDefaultWebcamPanelState(): WebcamPanelState {
  return { maskShape: WEBCAM_MASK_SHAPE.ROUNDED_RECT, mirrored: true };
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
  return {
    maskShape,
    mirrored: typeof raw.mirrored === "boolean" ? raw.mirrored : d.mirrored,
  };
}
