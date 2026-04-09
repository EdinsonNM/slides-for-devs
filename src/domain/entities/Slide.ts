import type { Presenter3dViewState } from "../../utils/presenter3dView";
import type { SlideMatrixData } from "./SlideMatrix";

/** Valores canónicos de `Slide.type` (evita comparar strings sueltos en la UI). */
export const SLIDE_TYPE = {
  CONTENT: "content",
  CHAPTER: "chapter",
  DIAGRAM: "diagram",
  MATRIX: "matrix",
} as const;

export type SlideType = (typeof SLIDE_TYPE)[keyof typeof SLIDE_TYPE];

/**
 * Vista previa / presentador: el lienzo del slide llega al borde del contenedor blanco.
 * Solo diagramas (Excalidraw); la matriz usa el mismo marco centrado y márgenes que el contenido.
 */
export function slideUsesFullBleedCanvas(type: SlideType): boolean {
  return type === SLIDE_TYPE.DIAGRAM;
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
  /** Solo cuando `type === SLIDE_TYPE.MATRIX`: encabezados y filas de la tabla. */
  matrixData?: SlideMatrixData;
}
