import type { Slide } from "../../domain/entities";
import type { DeckNarrativeSlideOptions, SlideOperationsPort } from "../../domain/ports";

export class RewriteSlideUseCase {
  constructor(
    private resolveOperations: (modelId: string) => SlideOperationsPort | null,
    private fallback: SlideOperationsPort
  ) {}

  async run(
    slide: Slide,
    prompt: string,
    modelId: string,
    options?: DeckNarrativeSlideOptions,
  ): Promise<{ title: string; content: string }> {
    const operations = this.resolveOperations(modelId) ?? this.fallback;
    return operations.rewriteSlide(slide, prompt, modelId, options);
  }
}
