import type { Slide } from "../types";

/** Proveedores de texto/presentación (combo del header). */
export type PresentationProviderId = "gemini" | "openai" | "xai";

/** Proveedores de imagen (selector en modal de imagen). */
export type ImageProviderId = "gemini" | "openai";

/**
 * Generación de presentación desde un tema.
 * Implementado por: Gemini, OpenAI, xAI.
 */
export interface IPresentationGenerator {
  readonly provider: PresentationProviderId;
  generatePresentation(topic: string, modelId: string): Promise<Slide[]>;
}

/**
 * Operaciones sobre diapositivas: dividir, reescribir, alternativas de prompt de imagen.
 * Implementado por: Gemini, OpenAI. xAI no soporta estas operaciones.
 */
export interface ISlideOperations {
  readonly provider: PresentationProviderId;
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
    characterPrompt?: string
  ): Promise<string>;
}

/**
 * Generación de imágenes para slides.
 * Implementado por: Gemini, OpenAI.
 */
export interface IImageGenerator {
  readonly provider: ImageProviderId;
  generateImage(params: {
    slideContext: string;
    userPrompt: string;
    stylePrompt: string;
    includeBackground: boolean;
    modelId: string;
    characterPrompt?: string;
    characterReferenceImageDataUrl?: string;
  }): Promise<string | undefined>;
}
