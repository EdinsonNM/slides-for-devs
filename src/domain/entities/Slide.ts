import type { Presenter3dViewState } from "../../utils/presenter3dView";

export type SlideType = "content" | "chapter" | "diagram";

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
  presenterNotes?: string;
  speech?: string;
  excalidrawData?: string;
}
