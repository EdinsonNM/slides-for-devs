import { cn } from "../../../utils/cn";
import {
  ISO_FLOW_CANVAS_BACKDROP_GRADIENT_DARK,
  ISO_FLOW_CANVAS_BACKDROP_GRADIENT_LIGHT,
} from "../isometricFlowDiagramCanvas/isoFlowCanvasBackdrop";
import { MindMapCanvasSvg } from "./MindMapCanvasSvg";
import { MindMapCanvasToolbar } from "./MindMapCanvasToolbar";
import type { MindMapCanvasProps } from "./useMindMapCanvasController";
import { useMindMapCanvasController } from "./useMindMapCanvasController";

/**
 * Zoom y pan del mapa viven en el SVG (`viewBox`), no en `scale()` CSS:
 * así curvas y círculos siguen siendo vectores nítidos al acercar.
 *
 * Fondo: solo el degradado lineal del isométrico (sin viñeta radial ni halos difuminados).
 */
export function MindMapDiagramCanvasView(props: MindMapCanvasProps) {
  const ctrl = useMindMapCanvasController(props);

  return (
    <div
      className={cn("relative h-full w-full overflow-hidden", props.className)}
      onWheel={ctrl.handleWheel}
      onPointerDown={ctrl.handlePointerDownBg}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 dark:hidden"
        style={{ backgroundImage: ISO_FLOW_CANVAS_BACKDROP_GRADIENT_LIGHT }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden dark:block"
        style={{ backgroundImage: ISO_FLOW_CANVAS_BACKDROP_GRADIENT_DARK }}
      />

      <div className="absolute inset-0 z-20 h-full w-full">
        <MindMapCanvasSvg ctrl={ctrl} />
      </div>
      <MindMapCanvasToolbar {...ctrl} />
    </div>
  );
}
