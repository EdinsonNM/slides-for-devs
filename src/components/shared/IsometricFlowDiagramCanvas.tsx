export type {
  IsometricFlowDiagramCanvasProps,
  IsometricSlideTextOverlayToolbar,
} from "./isometricFlowDiagramCanvas/isometricFlowDiagramCanvasTypes";

import type { IsometricFlowDiagramCanvasProps } from "./isometricFlowDiagramCanvas/isometricFlowDiagramCanvasTypes";
import { IsometricFlowDiagramCanvasView } from "./isometricFlowDiagramCanvas/IsometricFlowDiagramCanvasView";
import { useIsometricFlowCanvasController } from "./isometricFlowDiagramCanvas/useIsometricFlowCanvasController";

export function IsometricFlowDiagramCanvas(props: IsometricFlowDiagramCanvasProps) {
  const ctrl = useIsometricFlowCanvasController(props);
  return <IsometricFlowDiagramCanvasView ctrl={ctrl} />;
}
