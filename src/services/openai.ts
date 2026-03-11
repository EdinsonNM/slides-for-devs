import type { Slide } from "../types";
import { OpenAIProvider } from "../llm/providers/openai-provider";

const openaiProvider = new OpenAIProvider();

/** Genera una presentación con un modelo de OpenAI (GPT). */
export async function generatePresentationOpenAI(
  topic: string,
  model: string = "gpt-5.2"
): Promise<Slide[]> {
  return openaiProvider.generatePresentation(topic, model);
}

/** Genera una imagen con OpenAI (DALL-E 3 o Responses API con personaje). */
export async function generateImageOpenAI(
  slideContext: string,
  userPrompt: string,
  stylePrompt: string = "",
  includeBackground: boolean = true,
  characterPrompt?: string,
  characterReferenceImageDataUrl?: string
): Promise<string | undefined> {
  return openaiProvider.generateImage({
    slideContext,
    userPrompt,
    stylePrompt,
    includeBackground,
    modelId: "dall-e-3",
    characterPrompt,
    characterReferenceImageDataUrl,
  });
}

/** Divide una diapositiva en varias usando OpenAI. */
export async function splitSlideOpenAI(
  slide: Slide,
  prompt: string,
  model: string = "gpt-4o-mini"
): Promise<Slide[]> {
  return openaiProvider.splitSlide(slide, prompt, model);
}

/** Reescribe una diapositiva según la instrucción del usuario usando OpenAI. */
export async function rewriteSlideOpenAI(
  slide: Slide,
  prompt: string,
  model: string = "gpt-4o-mini"
): Promise<{ title: string; content: string }> {
  return openaiProvider.rewriteSlide(slide, prompt, model);
}

/** Genera una alternativa de prompt para imagen. */
export async function generateImagePromptAlternativesOpenAI(
  slideContext: string,
  currentPrompt: string,
  styleName: string,
  stylePrompt: string,
  model: string = "gpt-4o-mini",
  characterPrompt?: string
): Promise<string> {
  return openaiProvider.generateImagePromptAlternatives(
    slideContext,
    currentPrompt,
    styleName,
    stylePrompt,
    model,
    characterPrompt
  );
}
