export type SlideType = "content" | "chapter" | "diagram";

export interface ImageStyle {
  id: string;
  name: string;
  prompt: string;
}

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
  /** Altura del bloque de código en px (solo para slides con código). */
  editorHeight?: number;
  videoUrl?: string;
  contentType?: "image" | "code" | "video";
  /** Distribución del contenido: split = título+texto a la izquierda y panel derecho; full = solo título+texto a ancho completo; panel-full = título arriba, descripción como subtítulo opcional y panel ocupa todo el resto. Solo aplica cuando type === "content". */
  contentLayout?: "split" | "full" | "panel-full";
  /** Porcentaje de ancho (0-100) del panel derecho (imagen/código/video). Solo aplica a contentLayout "split". */
  imageWidthPercent?: number;
  /** Porcentaje de altura (0-100) del panel inferior en layout "panel-full". El resto es título/subtítulo. */
  panelHeightPercent?: number;
  /** Notas del presentador (solo visibles en modo presentador) */
  presenterNotes?: string;
  /** Guion o speech sugerido para esta diapositiva */
  speech?: string;
  /** Datos del diagrama Excalidraw (JSON: elements, appState, files). Solo cuando type === "diagram". */
  excalidrawData?: string;
}

/** Personaje guardado para reutilizar en generaciones de imagen (misma apariencia en todas las escenas). */
export interface SavedCharacter {
  id: string;
  name: string;
  description: string;
  /** Imagen de referencia (data URL) para que Gemini mantenga el personaje idéntico. */
  referenceImageDataUrl?: string;
}

export interface Presentation {
  topic: string;
  slides: Slide[];
  /** Id del personaje asignado a esta presentación (opcional). */
  characterId?: string;
}

/** Presentación guardada en disco (incluye id y fecha) */
export interface SavedPresentation extends Presentation {
  id: string;
  savedAt: string; // ISO date
}

/** Resumen para listar presentaciones guardadas */
export interface SavedPresentationMeta {
  id: string;
  topic: string;
  savedAt: string;
  slideCount: number;
}
