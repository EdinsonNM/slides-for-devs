import type { Canvas3dTransformGizmoMode } from "./canvas3dModelTransform";

/** Sincroniza UI del inspector con el visor 3D sin acoplar estado al dominio. */
export const CANVAS3D_TRANSFORM_MODE_EVENT = "slide:canvas3dSetTransformMode" as const;

export type Canvas3dTransformModeEventDetail = {
  mode: Canvas3dTransformGizmoMode;
};

export function dispatchCanvas3dTransformMode(mode: Canvas3dTransformGizmoMode) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<Canvas3dTransformModeEventDetail>(
      CANVAS3D_TRANSFORM_MODE_EVENT,
      { detail: { mode } },
    ),
  );
}
