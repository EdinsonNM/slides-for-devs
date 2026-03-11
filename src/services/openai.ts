import type { Slide } from "../types";
import { OpenAIAdapter } from "../infrastructure/adapters/OpenAI.adapter";

const adapter = new OpenAIAdapter();

export async function generatePresentationOpenAI(
  topic: string,
  model: string = "gpt-5.2"
): Promise<Slide[]> {
  return adapter.generatePresentation(topic, model);
}

export async function generateImageOpenAI(
  slideContext: string,
  userPrompt: string,
  stylePrompt: string = "",
  includeBackground: boolean = true,
  characterPrompt?: string,
  characterReferenceImageDataUrl?: string
): Promise<string | undefined> {
  return adapter.generateImage({
    slideContext,
    userPrompt,
    stylePrompt,
    includeBackground,
    modelId: "dall-e-3",
    characterPrompt,
    characterReferenceImageDataUrl,
  });
}

export async function splitSlideOpenAI(
  slide: Slide,
  prompt: string,
  model: string = "gpt-4o-mini"
): Promise<Slide[]> {
  return adapter.splitSlide(slide, prompt, model);
}

export async function rewriteSlideOpenAI(
  slide: Slide,
  prompt: string,
  model: string = "gpt-4o-mini"
): Promise<{ title: string; content: string }> {
  return adapter.rewriteSlide(slide, prompt, model);
}

export async function generateImagePromptAlternativesOpenAI(
  slideContext: string,
  currentPrompt: string,
  styleName: string,
  stylePrompt: string,
  model: string = "gpt-4o-mini",
  characterPrompt?: string,
  includeBackground: boolean = true
): Promise<string> {
  return adapter.generateImagePromptAlternatives(
    slideContext,
    currentPrompt,
    styleName,
    stylePrompt,
    model,
    characterPrompt,
    includeBackground
  );
}
