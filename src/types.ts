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
}

export interface Presentation {
  topic: string;
  slides: Slide[];
}
