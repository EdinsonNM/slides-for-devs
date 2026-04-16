import type { Slide } from "../entities";

/** Contexto de objetivo narrativo del deck para operaciones por slide (opcional). */
export interface DeckNarrativeSlideOptions {
  deckNarrativeContext?: string;
}

export interface SlideOperationsPort {
  splitSlide(slide: Slide, prompt: string, modelId: string): Promise<Slide[]>;
  rewriteSlide(
    slide: Slide,
    prompt: string,
    modelId: string,
    options?: DeckNarrativeSlideOptions,
  ): Promise<{ title: string; content: string }>;
  /** Genera título y contenido markdown para una sola diapositiva a partir de la instrucción y el tema de la presentación. */
  generateSlideContent(
    presentationTopic: string,
    slide: Slide,
    userPrompt: string,
    modelId: string,
    options?: DeckNarrativeSlideOptions,
  ): Promise<{ title: string; content: string }>;
  /** Genera título, subtítulo opcional, notas y datos tabulares para un slide tipo matrix. */
  generateSlideMatrix(
    presentationTopic: string,
    slide: Slide,
    userPrompt: string,
    modelId: string,
    options?: DeckNarrativeSlideOptions,
  ): Promise<{
    title: string;
    subtitle: string;
    content: string;
    columnHeaders: string[];
    rows: string[][];
  }>;
  /** Genera título, notas opcionales y código Mermaid para un slide tipo diagram (Excalidraw). */
  generateSlideDiagram(
    presentationTopic: string,
    slide: Slide,
    userPrompt: string,
    modelId: string,
    options?: DeckNarrativeSlideOptions,
  ): Promise<{ title: string; content: string; mermaid: string }>;
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
