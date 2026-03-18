import type { ImageGeneratorPort } from "../../domain/ports";
import { optimizeImageDataUrl } from "../../utils/imageOptimize";

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
    const raw = await generator.generateImage({
      slideContext: params.slideContext,
      userPrompt: params.userPrompt,
      stylePrompt: params.stylePrompt,
      includeBackground: params.includeBackground,
      modelId: params.modelId,
      characterPrompt: params.characterPrompt,
      characterReferenceImageDataUrl: params.characterReferenceImageDataUrl,
    });
    if (!raw?.trim()) return raw;
    if (typeof window === "undefined") return raw;
    try {
      return await optimizeImageDataUrl(raw);
    } catch {
      return raw;
    }
  }
}
