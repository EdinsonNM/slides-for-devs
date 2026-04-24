import type { CSSProperties } from "react";
import {
  WEBCAM_MASK_SHAPE,
  type WebcamMaskShape,
} from "../../domain/webcam/webcamPanelModel";

const HEX_CLIP =
  "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)";
const DIAMOND_CLIP = "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)";

/**
 * Clases y estilo inline para enmarcar la vista de cámara con la forma de máscara elegida.
 */
export function getWebcamMaskBoxProps(shape: WebcamMaskShape): {
  className: string;
  style?: CSSProperties;
} {
  switch (shape) {
    case WEBCAM_MASK_SHAPE.ROUNDED_RECT:
      return {
        className:
          "h-full w-full max-h-full max-w-full overflow-hidden rounded-2xl bg-stone-900/25 ring-1 ring-stone-200/50 dark:ring-stone-700/50",
      };
    case WEBCAM_MASK_SHAPE.CIRCLE:
      return {
        className:
          "h-full w-full max-h-full max-w-full overflow-hidden rounded-full bg-stone-900/25 ring-1 ring-stone-200/50 dark:ring-stone-700/50",
      };
    case WEBCAM_MASK_SHAPE.PILL:
      return {
        className:
          "h-full w-full max-h-full max-w-full overflow-hidden rounded-[9999px] bg-stone-900/25 ring-1 ring-stone-200/50 dark:ring-stone-700/50",
      };
    case WEBCAM_MASK_SHAPE.HEXAGON:
      return {
        className: "h-full w-full max-h-full max-w-full overflow-hidden bg-stone-900/30",
        style: { WebkitClipPath: HEX_CLIP, clipPath: HEX_CLIP },
      };
    case WEBCAM_MASK_SHAPE.DIAMOND:
      return {
        className: "h-full w-full max-h-full max-w-full overflow-hidden bg-stone-900/30",
        style: { WebkitClipPath: DIAMOND_CLIP, clipPath: DIAMOND_CLIP },
      };
  }
}
