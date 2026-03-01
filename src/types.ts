export type SlideType = 'content' | 'chapter';

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
  videoUrl?: string;
  contentType?: 'image' | 'code' | 'video';
  /** Porcentaje de ancho (0-100) del panel derecho (imagen/código/video). Solo aplica a este slide. */
  imageWidthPercent?: number;
}

export interface Presentation {
  topic: string;
  slides: Slide[];
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
