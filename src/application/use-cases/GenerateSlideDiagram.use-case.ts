import type { Slide } from "../../domain/entities";
import type { SlideOperationsPort } from "../../domain/ports";
import { buildExcalidrawJsonFromMermaid } from "../../utils/excalidrawMermaid";

export class GenerateSlideDiagramUseCase {
  constructor(
    private resolveOperations: (modelId: string) => SlideOperationsPort | null,
    private fallback: SlideOperationsPort
  ) {}

  async run(
    presentationTopic: string,
    slide: Slide,
    userPrompt: string,
    modelId: string
  ): Promise<{ title: string; content: string; excalidrawData: string }> {
    const operations = this.resolveOperations(modelId) ?? this.fallback;
    const { title, content, mermaid } = await operations.generateSlideDiagram(
      presentationTopic,
      slide,
      userPrompt,
      modelId
    );
    const excalidrawData = await buildExcalidrawJsonFromMermaid(mermaid);
    return {
      title: title.trim() || slide.title,
      content: String(content ?? "").trim(),
      excalidrawData,
    };
  }
}
