import type { Slide } from "../entities";

export interface SlideOperationsPort {
  splitSlide(slide: Slide, prompt: string, modelId: string): Promise<Slide[]>;
  rewriteSlide(
    slide: Slide,
    prompt: string,
    modelId: string
  ): Promise<{ title: string; content: string }>;
  /** Genera título y contenido markdown para una sola diapositiva a partir de la instrucción y el tema de la presentación. */
  generateSlideContent(
    presentationTopic: string,
    slide: Slide,
    userPrompt: string,
    modelId: string
  ): Promise<{ title: string; content: string }>;
  /** Genera título, subtítulo opcional, notas y datos tabulares para un slide tipo matrix. */
  generateSlideMatrix(
    presentationTopic: string,
    slide: Slide,
    userPrompt: string,
    modelId: string
  ): Promise<{
    title: string;
    subtitle: string;
    content: string;
    columnHeaders: string[];
    rows: string[][];
  }>;
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
