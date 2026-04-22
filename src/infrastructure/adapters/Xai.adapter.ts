import type { Slide } from "../../domain/entities";
import type {
  PresentationGeneratorPort,
  GeneratePresentationOptions,
  GeneratedPresentationResult,
} from "../../domain/ports";
import { buildPrompt } from "../promptEngine";
import {
  slideCountBounds,
  parseSlideCountFromTopic,
  slideCountPrompt,
  generatePresentationPrompt,
} from "../prompts";
import { parseGeneratedDeckFromResponse } from "../schemas";
import { getXaiApiKey } from "../../services/apiConfig";

const XAI_URL = "https://api.x.ai/v1/responses";
const DEFAULT_MODEL = "grok-4-1-fast-reasoning";
const { min, max, default: def } = slideCountBounds;

function key(): string {
  const k = getXaiApiKey();
  if (!k?.trim()) throw new Error("No hay API key de xAI configurada.");
  return k.trim();
}

async function resolveSlideCount(topic: string, model: string): Promise<number> {
  const { system, user } = buildPrompt(slideCountPrompt, { topic });
  const res = await fetch(XAI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key()}` },
    body: JSON.stringify({
      model: model || DEFAULT_MODEL,
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_output_tokens: 10,
    }),
  });
  if (!res.ok) return def;
  const data = await res.json().catch(() => ({}));
  const text = (data?.output_text ?? "").trim();
  const n = text.match(/\d+/);
  if (!n) return def;
  return Math.min(max, Math.max(min, parseInt(n[0], 10)));
}

export class XaiAdapter implements PresentationGeneratorPort {
  async generatePresentation(
    topic: string,
    modelId: string,
    options?: GeneratePresentationOptions,
  ): Promise<GeneratedPresentationResult> {
    const model = modelId || DEFAULT_MODEL;
    const requestedCount =
      parseSlideCountFromTopic(topic) ?? await resolveSlideCount(topic, model);
    const { system, user } = buildPrompt(generatePresentationPrompt, {
      topic,
      slideCount: requestedCount,
      strictCount: requestedCount !== def,
      narrativeInstructions: options?.narrativeInstructions,
    });
    const res = await fetch(XAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key()}` },
      body: JSON.stringify({
        model,
        input: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_output_tokens: 8192,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `xAI API: ${res.status}`);
    }
    const content = (await res.json())?.output_text;
    return content && typeof content === "string"
      ? parseGeneratedDeckFromResponse(content)
      : { slides: [] };
  }
}
