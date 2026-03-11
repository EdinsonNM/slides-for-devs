import type { Slide } from "../entities";

export interface SlideOperationsPort {
  splitSlide(slide: Slide, prompt: string, modelId: string): Promise<Slide[]>;
  rewriteSlide(
    slide: Slide,
    prompt: string,
    modelId: string
  ): Promise<{ title: string; content: string }>;
  generateImagePromptAlternatives(
    slideContext: string,
    currentPrompt: string,
    styleName: string,
    stylePrompt: string,
    modelId: string,
    characterPrompt?: string,
    includeBackground?: boolean
  ): Promise<string>;
}
