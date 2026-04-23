import type { IsometricFlowDiagram } from "../../../domain/entities/IsometricFlowDiagram";

/** Añade bloques de título / descripción al lienzo del slide (toolbar del diagrama). */
export interface IsometricSlideTextOverlayToolbar {
  onAddTitle: () => void;
  onAddDescription: () => void;
  disableTitle: boolean;
  disableDescription: boolean;
}

export interface IsometricFlowDiagramCanvasProps {
  data: IsometricFlowDiagram;
  readOnly?: boolean;
  className?: string;
  onChange?: (next: IsometricFlowDiagram) => void;
  /** Solo edición: botones para insertar título y texto en el lienzo 16:9 encima del diagrama. */
  slideTextOverlayToolbar?: IsometricSlideTextOverlayToolbar;
  /**
   * El SVG hace `stopPropagation` en pointerdown; el padre usa esto para quitar selección
   * de bloques de texto superpuestos al hacer clic en el diagrama.
   */
  onEditorSurfacePointerDown?: () => void;
  /**
   * Clave de la versión persistida (p. ej. `slideId` + `isometricFlowData`).
   * Al cambiar (guardar, deshacer, otra diapositiva), se reaplica `data.view` al encuadre.
   */
  isometricDataSyncKey?: string;
}
