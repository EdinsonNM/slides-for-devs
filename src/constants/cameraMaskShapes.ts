/**
 * Formas de máscara para la vista previa de cámara en el inspector.
 * Los valores se usan como claves de estilo, no strings mágicos sueltos en la UI.
 */
export const CAMERA_MASK_SHAPE = {
  ROUNDED_RECT: "rounded-rect",
  CIRCLE: "circle",
  PILL: "pill",
  HEXAGON: "hexagon",
  DIAMOND: "diamond",
} as const;

export type CameraMaskShape = (typeof CAMERA_MASK_SHAPE)[keyof typeof CAMERA_MASK_SHAPE];

export const CAMERA_MASK_OPTIONS: { id: CameraMaskShape; label: string }[] = [
  { id: CAMERA_MASK_SHAPE.ROUNDED_RECT, label: "Rectángulo redondeado" },
  { id: CAMERA_MASK_SHAPE.CIRCLE, label: "Círculo" },
  { id: CAMERA_MASK_SHAPE.PILL, label: "Píldora" },
  { id: CAMERA_MASK_SHAPE.HEXAGON, label: "Hexágono" },
  { id: CAMERA_MASK_SHAPE.DIAMOND, label: "Rombo" },
];
