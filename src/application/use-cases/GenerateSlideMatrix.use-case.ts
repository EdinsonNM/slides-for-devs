import type { Slide } from "../../domain/entities";
import type { SlideOperationsPort } from "../../domain/ports";

export class GenerateSlideMatrixUseCase {
  constructor(
    private resolveOperations: (modelId: string) => SlideOperationsPort | null,
    private fallback: SlideOperationsPort
  ) {}

  async run(
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
  }> {
    const operations = this.resolveOperations(modelId) ?? this.fallback;
    return operations.generateSlideMatrix(presentationTopic, slide, userPrompt, modelId);
  }
}
