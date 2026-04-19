import { MindMapDiagramCanvasView } from "./mindMapDiagramCanvas/MindMapDiagramCanvasView";
import type { MindMapCanvasProps } from "./mindMapDiagramCanvas/useMindMapCanvasController";

export function MindMapDiagramCanvas(props: MindMapCanvasProps) {
  return <MindMapDiagramCanvasView {...props} />;
}
