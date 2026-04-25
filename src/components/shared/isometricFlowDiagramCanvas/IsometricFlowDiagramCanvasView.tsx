import { cn } from "../../../utils/cn";
import { IsometricFlowCanvasIconPickerOverlay } from "./IsometricFlowCanvasIconPickerOverlay";
import { IsometricFlowCanvasSvg } from "./IsometricFlowCanvasSvg";
import { IsometricFlowCanvasToolbar } from "./IsometricFlowCanvasToolbar";
import { IsometricFlowCanvasViewportHud } from "./IsometricFlowCanvasViewportHud";
import type { IsometricFlowCanvasController } from "./useIsometricFlowCanvasController";

export function IsometricFlowDiagramCanvasView({
  ctrl,
}: {
  ctrl: IsometricFlowCanvasController;
}) {
  return (
    <div
      ref={ctrl.canvasRootRef}
      className={cn("relative h-full min-h-0 w-full", ctrl.className)}
      onPointerDown={(e) => {
        /* Block slide-canvas block drag / alignment overlay from this subtree. */
        e.stopPropagation();
      }}
    >
      <IsometricFlowCanvasToolbar {...ctrl} />
      <IsometricFlowCanvasViewportHud
        readOnly={ctrl.readOnly}
        viewRect={ctrl.viewRect}
        onResetView={ctrl.resetIsoView}
      />
      <IsometricFlowCanvasIconPickerOverlay {...ctrl} />
      <IsometricFlowCanvasSvg ctrl={ctrl} />
    </div>
  );
}
