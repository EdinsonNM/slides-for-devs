import type { Slide } from "../../domain/entities";
import type { SlideOperationsPort } from "../../domain/ports";

export class SplitSlideUseCase {
  constructor(
    private resolveOperations: (modelId: string) => SlideOperationsPort | null,
    private fallback: SlideOperationsPort
  ) {}

  async run(slide: Slide, prompt: string, modelId: string): Promise<Slide[]> {
    const operations = this.resolveOperations(modelId) ?? this.fallback;
    return operations.splitSlide(slide, prompt, modelId);
  }
}
