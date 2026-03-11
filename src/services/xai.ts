import type { Slide } from "../types";
import { XaiAdapter } from "../infrastructure/adapters/Xai.adapter";

const adapter = new XaiAdapter();

export async function generatePresentationXai(
  topic: string,
  model: string = "grok-4-1-fast-reasoning"
): Promise<Slide[]> {
  return adapter.generatePresentation(topic, model);
}
