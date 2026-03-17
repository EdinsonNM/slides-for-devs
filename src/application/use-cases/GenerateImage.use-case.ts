import type { ImageGeneratorPort } from "../../domain/ports";

export class GenerateImageUseCase {
  constructor(private resolveGenerator: (providerId: "gemini" | "openai") => ImageGeneratorPort) {}

  async run(params: {
    providerId: "gemini" | "openai";
    slideContext: string;
    userPrompt: string;
    stylePrompt: string;
    includeBackground: boolean;
    modelId: string;
    characterPrompt?: string;
    characterReferenceImageDataUrl?: string;
  }): Promise<string | undefined> {
    const generator = this.resolveGenerator(params.providerId);
    return generator.generateImage({
      slideContext: params.slideContext,
      userPrompt: params.userPrompt,
      stylePrompt: params.stylePrompt,
      includeBackground: params.includeBackground,
      modelId: params.modelId,
      characterPrompt: params.characterPrompt,
      characterReferenceImageDataUrl: params.characterReferenceImageDataUrl,
    });
  }
}
