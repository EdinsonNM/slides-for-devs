import type { Slide } from "../../types";
import { getXaiApiKey } from "../../services/apiConfig";
import type { IPresentationGenerator } from "../types";
import type { PresentationProviderId } from "../types";
import {
  PRESENTATION_SYSTEM,
  buildSlideCountUserMessage,
  buildPresentationUserMessage,
  parseRequestedSlideCountFromTopic,
  MIN_SLIDES,
  MAX_SLIDES,
  DEFAULT_SLIDES,
} from "../prompts/presentation";

const XAI_RESPONSES_URL = "https://api.x.ai/v1/responses";
const DEFAULT_MODEL = "grok-4-1-fast-reasoning";

function getKey(): string {
  const key = getXaiApiKey();
  if (!key?.trim()) {
    throw new Error(
      "No hay API key de xAI (Grok) configurada. Configúrala en el botón de configuración."
    );
  }
  return key.trim();
}

async function parseRequestedSlideCount(
  topic: string,
  model: string,
  key: string
): Promise<number> {
  const res = await fetch(XAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: model || DEFAULT_MODEL,
      input: [{ role: "user", content: buildSlideCountUserMessage(topic) }],
      max_output_tokens: 10,
    }),
  });
  if (!res.ok) return DEFAULT_SLIDES;
  const data = await res.json().catch(() => ({}));
  const text = (data?.output_text ?? "").trim();
  const numMatch = text.match(/\d+/);
  if (!numMatch) return DEFAULT_SLIDES;
  const n = parseInt(numMatch[0], 10);
  return Math.min(MAX_SLIDES, Math.max(MIN_SLIDES, n));
}

function parseSlidesFromContent(content: string): Slide[] {
  try {
    const parsed = JSON.parse(content) as { slides?: Slide[] } | Slide[];
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.slides)) return (parsed as { slides: Slide[] }).slides;
    const arrayMatch = content.match(/\[[\s\S]*\]/);
    if (arrayMatch) return JSON.parse(arrayMatch[0]) as Slide[];
    return [];
  } catch {
    const arrayMatch = content.match(/\[[\s\S]*\]/);
    if (arrayMatch) return JSON.parse(arrayMatch[0]) as Slide[];
    return [];
  }
}

export class XaiProvider implements IPresentationGenerator {
  readonly provider: PresentationProviderId = "xai";

  async generatePresentation(topic: string, modelId: string): Promise<Slide[]> {
    const key = getKey();
    const model = modelId || DEFAULT_MODEL;
    let requestedCount: number;
    const fromTopic = parseRequestedSlideCountFromTopic(topic);
    if (fromTopic != null) {
      requestedCount = fromTopic;
    } else {
      requestedCount = await parseRequestedSlideCount(topic, model, key);
    }
    const userContent = buildPresentationUserMessage(topic, requestedCount);
    const res = await fetch(XAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: model,
        input: [
          { role: "system", content: PRESENTATION_SYSTEM },
          { role: "user", content: userContent },
        ],
        max_output_tokens: 8192,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err?.error?.message || `xAI API: ${res.status} ${res.statusText}`
      );
    }
    const data = await res.json();
    const content = data?.output_text;
    if (!content || typeof content !== "string") return [];
    return parseSlidesFromContent(content);
  }
}
