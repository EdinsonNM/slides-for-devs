import type { Slide } from "../types";
import { XaiProvider } from "../llm/providers/xai-provider";

const xaiProvider = new XaiProvider();

/** Genera una presentación con un modelo de xAI (Grok). */
export async function generatePresentationXai(
  topic: string,
  model: string = "grok-4-1-fast-reasoning"
): Promise<Slide[]> {
  return xaiProvider.generatePresentation(topic, model);
}
