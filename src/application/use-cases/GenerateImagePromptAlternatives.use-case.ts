import type { SlideOperationsPort } from "../../domain/ports";

export class GenerateImagePromptAlternativesUseCase {
  constructor(
    private resolveOperations: (modelId: string) => SlideOperationsPort | null,
    private fallback: SlideOperationsPort
  ) {}

  async run(
    slideContext: string,
    currentPrompt: string,
    styleName: string,
    stylePrompt: string,
    modelId: string,
    characterPrompt?: string,
    includeBackground: boolean = true
  ): Promise<string> {
    const operations = this.resolveOperations(modelId) ?? this.fallback;
    return operations.generateImagePromptAlternatives(
      slideContext,
      currentPrompt,
      styleName,
      stylePrompt,
      modelId,
      characterPrompt,
      includeBackground
    );
  }
}
