import type { Slide } from "../../domain/entities";
import type { PresentationGeneratorPort } from "../../domain/ports";

export class GeneratePresentationUseCase {
  constructor(
    private resolveGenerator: (modelId: string) => PresentationGeneratorPort
  ) {}

  async run(topic: string, modelId: string): Promise<Slide[]> {
    const generator = this.resolveGenerator(modelId);
    return generator.generatePresentation(topic, modelId);
  }
}
