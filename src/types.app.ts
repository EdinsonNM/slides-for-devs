import type { Slide } from "./domain/entities";

export interface ImageStyle {
  id: string;
  name: string;
  prompt: string;
}

export interface SavedCharacter {
  id: string;
  name: string;
  description: string;
  referenceImageDataUrl?: string;
}

export interface Presentation {
  topic: string;
  slides: Slide[];
  characterId?: string;
}

export interface SavedPresentation extends Presentation {
  id: string;
  savedAt: string;
}

export interface SavedPresentationMeta {
  id: string;
  topic: string;
  savedAt: string;
  slideCount: number;
}
