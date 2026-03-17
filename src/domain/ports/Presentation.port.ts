import type { Slide } from "../entities";

export interface PresentationGeneratorPort {
  generatePresentation(topic: string, modelId: string): Promise<Slide[]>;
}
