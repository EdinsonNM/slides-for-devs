import type { Presenter3dViewState } from "../../utils/presenter3dView";
import type { Canvas3dModelTransform } from "../../utils/canvas3dModelTransform";
import type { PanelContentKind } from "../panelContent/panelContentKind";
import type { DataMotionRingState } from "../dataMotionRing/dataMotionRingModel";
import type { WebcamPanelState } from "../webcam/webcamPanelModel";
import type { SlideCanvasScene, SlideCodeEditorTheme } from "./SlideCanvas";
import type { SlideMatrixData } from "./SlideMatrix";
import type { SlideDocumentEmbed } from "./SlideDocumentEmbed";

/** Valores canónicos de `Slide.type` (evita comparar strings sueltos en la UI). */
export const SLIDE_TYPE = {
  CONTENT: "content",
  CHAPTER: "chapter",
  DIAGRAM: "diagram",
  /** Diagrama isométrico tipo infra (bloques 3D y enlaces), editor propio. */
  ISOMETRIC: "isometric",
  MIND_MAP: "mind-map",
  MATRIX: "matrix",
  /** Mapa interactivo Mapbox (marcadores y rutas). */
  MAPS: "maps",
  /**
   * Documento incrustado (PDF, Word, Excel, Markdown) a pantalla completa en el slide.
   */
  DOCUMENT: "document",
  /** Escena 3D exclusiva (varios GLB / personajes con animación y posición). */
  CANVAS_3D: "canvas-3d",
} as const;

export type SlideType = (typeof SLIDE_TYPE)[keyof typeof SLIDE_TYPE];

/**
 * Antes distinguía diagramas a pantalla completa; el modelo unificado usa siempre `canvasScene` en 16:9.
 */
export function slideUsesFullBleedCanvas(_type: SlideType): boolean {
  return false;
}

/** Alias del discriminante persistido; valores en `PANEL_CONTENT_KIND` (`domain/panelContent`). */
export type SlidePanelContentType = PanelContentKind;

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
  /** URL de vídeo incrustado cuando el panel de media es de tipo vídeo. */
  videoUrl?: string;
  /**
   * URL del documento a incrustar cuando `contentType === PANEL_CONTENT_KIND.IFRAME_EMBED`.
   * Debe ser `http:` o `https:` (validación en guardado).
   */
  iframeEmbedUrl?: string;
  /**
   * URL del recurso Rive (p. ej. `blob:` tras cargar un `.riv` en local, o URL https).
   * Solo aplica cuando `contentType === PANEL_CONTENT_KIND.RIVE`.
   */
  riveUrl?: string;
  /**
   * Nombres de state machines para puntero/hover (Rive), separados por coma si hay varias.
   * Vacío o ausente: el reproductor intenta todas las del artboard.
   */
  riveStateMachineNames?: string;
  /**
   * Artboard de Rive a cargar (nombre exacto). Vacío = artboard por defecto del archivo.
   * Ej.: el asset “Expression Grid” del marketplace de Rive usa el artboard Main.
   */
  riveArtboard?: string;
  contentType?: SlidePanelContentType;
  /** Modelo GLB del catálogo `DEVICE_3D_CATALOG` cuando el panel es Presentador 3D. */
  presenter3dDeviceId?: string;
  /** Si la textura de la pantalla del dispositivo viene de `imageUrl` o de `videoUrl`. */
  presenter3dScreenMedia?: "image" | "video";
  /** Cámara y punto de mira guardados del visor 3D (modo edición). */
  presenter3dViewState?: Presenter3dViewState;
  /**
   * URL o data URL (`model/gltf-binary`) del GLB para el panel Canvas 3D.
   * Las URLs remotas requieren CORS en el servidor del modelo.
   */
  canvas3dGlbUrl?: string;
  /** Vista de cámara guardada para el panel Canvas 3D (mismo formato que Presentador 3D). */
  canvas3dViewState?: Presenter3dViewState;
  /** Transformación del modelo en Canvas 3D para ajustar centro y orientación. */
  canvas3dModelTransform?: Canvas3dModelTransform;
  /**
   * Clip de animación GLB a reproducir en Canvas 3D.
   * Ausente = primera animación del archivo; cadena vacía = ninguna.
   */
  canvas3dAnimationClipName?: string;
  /**
   * Configuración del panel «aro de datos 3D» (`PANEL_CONTENT_KIND.DATA_MOTION_RING`).
   */
  dataMotionRing?: DataMotionRingState;
  /**
   * Vista de cámara en vivo (`PANEL_CONTENT_KIND.CAMERA`): máscara y espejo.
   */
  webcam?: WebcamPanelState;
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
  /** JSON `MindMapDiagram` cuando `type === SLIDE_TYPE.MIND_MAP`. */
  mindMapData?: string;
  /** JSON `SlideMapData` cuando `type === SLIDE_TYPE.MAPS`. */
  mapData?: string;
  /** Documento embebido (data URL) cuando `type === SLIDE_TYPE.DOCUMENT`. */
  documentEmbed?: SlideDocumentEmbed;
  /** JSON `Canvas3dSceneData` cuando `type === SLIDE_TYPE.CANVAS_3D`. */
  canvas3dSceneData?: string;
  /** Solo cuando `type === SLIDE_TYPE.MATRIX`: encabezados y filas de la tabla. */
  matrixData?: SlideMatrixData;
  /** Posicionamiento libre de bloques en el lienzo (% del área del slide). */
  canvasScene?: SlideCanvasScene;
  /**
   * Tema del editor de código (solo lectura / espejo del primer `mediaPanel` en algunos flujos).
   * En lienzo, el valor canónico vive en el `payload` de cada `mediaPanel`.
   */
  codeEditorTheme?: SlideCodeEditorTheme;
  /**
   * Fondo con imagen (URL o data URL) sobre el tema del deck.
   * Solo aplica a tipos que usan `DeckBackdrop` (contenido, capítulo, diagrama, matriz); no
   * sustituye al fondo de la escena 3D (`canvas3dSceneData.backgroundImageUrl`).
   */
  slideBackgroundImageUrl?: string;
  /**
   * Color sólido opcional encima del tema del deck y debajo de `slideBackgroundImageUrl`.
   * Valor CSS (p. ej. `#0f172a`); solo aplica a los mismos tipos que la imagen de fondo del slide.
   */
  slideBackgroundColor?: string;
}
