import type {
  GeneratedPresentationResult,
  PresentationGeneratorPort,
} from "../../domain/ports";
import { buildDeckNarrativeContextForPrompts } from "../../constants/presentationNarrativePresets";

export interface GeneratePresentationNarrativeInput {
  narrativePresetId?: string;
  narrativeNotes?: string | null;
}

export class GeneratePresentationUseCase {
  constructor(
    private resolveGenerator: (modelId: string) => PresentationGeneratorPort
  ) {}

  async run(
    topic: string,
    modelId: string,
    narrative?: GeneratePresentationNarrativeInput,
  ): Promise<GeneratedPresentationResult> {
    const generator = this.resolveGenerator(modelId);
    const narrativeInstructions = buildDeckNarrativeContextForPrompts(
      narrative?.narrativePresetId,
      narrative?.narrativeNotes,
    );
    return generator.generatePresentation(topic, modelId, {
      narrativeInstructions,
    });
  }
}
