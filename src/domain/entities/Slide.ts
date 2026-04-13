import type { Presenter3dViewState } from "../../utils/presenter3dView";
import type { SlideCanvasScene } from "./SlideCanvas";
import type { SlideMatrixData } from "./SlideMatrix";

/** Valores canónicos de `Slide.type` (evita comparar strings sueltos en la UI). */
export const SLIDE_TYPE = {
  CONTENT: "content",
  CHAPTER: "chapter",
  DIAGRAM: "diagram",
  /** Diagrama isométrico tipo infra (bloques 3D y enlaces), editor propio. */
  ISOMETRIC: "isometric",
  MATRIX: "matrix",
} as const;

export type SlideType = (typeof SLIDE_TYPE)[keyof typeof SLIDE_TYPE];

/**
 * Antes distinguía diagramas a pantalla completa; el modelo unificado usa siempre `canvasScene` en 16:9.
 */
export function slideUsesFullBleedCanvas(_type: SlideType): boolean {
  return false;
}

export type SlidePanelContentType = "image" | "code" | "video" | "presenter3d";

export interface Slide {
  id: string;
  type: SlideType;
  title: string;
  subtitle?: string;
  content: string;
  imageUrl?: string;
  imagePrompt?: string;
  code?: string;
  language?: string;
  fontSize?: number;
  editorHeight?: number;
  /** URL de vídeo incrustado (YouTube, Vimeo o directa) cuando `contentType === "video"`. */
  videoUrl?: string;
  contentType?: SlidePanelContentType;
  /** Modelo GLB del catálogo `DEVICE_3D_CATALOG` cuando `contentType === "presenter3d"`. */
  presenter3dDeviceId?: string;
  /** Si la textura de la pantalla del dispositivo viene de `imageUrl` o de `videoUrl`. */
  presenter3dScreenMedia?: "image" | "video";
  /** Cámara y punto de mira guardados del visor 3D (modo edición). */
  presenter3dViewState?: Presenter3dViewState;
  contentLayout?: "split" | "full" | "panel-full";
  imageWidthPercent?: number;
  panelHeightPercent?: number;
  /** Editor: ancho del bloque de título (% del área de texto izquierda, ~30–100). */
  editorTitleWidthPercent?: number;
  /** Editor: alto mínimo del bloque de título (px). */
  editorTitleMinHeightPx?: number;
  /** Editor: ancho del bloque de cuerpo (% del área de contenido). */
  editorContentWidthPercent?: number;
  /** Editor: alto mínimo del bloque de cuerpo (px). */
  editorContentMinHeightPx?: number;
  presenterNotes?: string;
  speech?: string;
  excalidrawData?: string;
  /** JSON `IsometricFlowDiagram` cuando `type === SLIDE_TYPE.ISOMETRIC`. */
  isometricFlowData?: string;
  /** Solo cuando `type === SLIDE_TYPE.MATRIX`: encabezados y filas de la tabla. */
  matrixData?: SlideMatrixData;
  /** Posicionamiento libre de bloques en el lienzo (% del área del slide). */
  canvasScene?: SlideCanvasScene;
}
