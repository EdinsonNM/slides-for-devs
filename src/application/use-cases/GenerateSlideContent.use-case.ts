import type { Slide } from "../../domain/entities";
import type { SlideOperationsPort } from "../../domain/ports";

export class GenerateSlideContentUseCase {
  constructor(
    private resolveOperations: (modelId: string) => SlideOperationsPort | null,
    private fallback: SlideOperationsPort
  ) {}

  async run(
    presentationTopic: string,
    slide: Slide,
    userPrompt: string,
    modelId: string
  ): Promise<{ title: string; content: string }> {
    const operations = this.resolveOperations(modelId) ?? this.fallback;
    return operations.generateSlideContent(presentationTopic, slide, userPrompt, modelId);
  }
}
