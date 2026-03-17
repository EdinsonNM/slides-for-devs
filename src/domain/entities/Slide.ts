export type SlideType = "content" | "chapter" | "diagram";

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
  contentType?: "image" | "code" | "video";
  contentLayout?: "split" | "full" | "panel-full";
  imageWidthPercent?: number;
  panelHeightPercent?: number;
  presenterNotes?: string;
  speech?: string;
  excalidrawData?: string;
}
