import type { Slide } from "../../types";
import { getOpenAIApiKey } from "../../services/apiConfig";
import type {
  IPresentationGenerator,
  ISlideOperations,
  IImageGenerator,
} from "../types";
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
import {
  SPLIT_SLIDE_SYSTEM,
  buildSplitSlideUserMessage,
  REWRITE_SLIDE_SYSTEM,
  buildRewriteSlideUserMessage,
} from "../prompts/slideOperations";
import {
  buildImageGenerationPrompt,
  IMAGE_ALTERNATIVES_SYSTEM_WITH_CHARACTER,
  IMAGE_ALTERNATIVES_SYSTEM_NO_CHARACTER,
  buildImageAlternativesUserMessageWithCharacter,
  buildImageAlternativesUserMessageNoCharacter,
} from "../prompts/imagePrompts";

const IMAGES_URL = "https://api.openai.com/v1/images/generations";
const CHAT_URL = "https://api.openai.com/v1/chat/completions";
const RESPONSES_API_MODEL = "gpt-5";
const DEFAULT_CHAT_MODEL = "gpt-5.2";

function getKey(): string {
  const key = getOpenAIApiKey();
  if (!key?.trim()) {
    throw new Error(
      "No hay API key de OpenAI configurada. Configúrala en el botón de configuración."
    );
  }
  return key.trim();
}

async function parseRequestedSlideCount(
  topic: string,
  model: string,
  key: string
): Promise<number> {
  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: model || "gpt-4o-mini",
      messages: [{ role: "user", content: buildSlideCountUserMessage(topic) }],
      max_completion_tokens: 10,
    }),
  });
  if (!res.ok) return DEFAULT_SLIDES;
  const data = await res.json().catch(() => ({}));
  const text = (data?.choices?.[0]?.message?.content ?? "").trim();
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

export class OpenAIProvider
  implements IPresentationGenerator, ISlideOperations, IImageGenerator
{
  readonly provider: PresentationProviderId = "openai";

  async generatePresentation(topic: string, modelId: string): Promise<Slide[]> {
    const key = getKey();
    const model = modelId || DEFAULT_CHAT_MODEL;
    let requestedCount: number;
    const fromTopic = parseRequestedSlideCountFromTopic(topic);
    if (fromTopic != null) {
      requestedCount = fromTopic;
    } else {
      requestedCount = await parseRequestedSlideCount(topic, model, key);
    }
    const userContent = buildPresentationUserMessage(topic, requestedCount);
    const res = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: PRESENTATION_SYSTEM },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err?.error?.message || `OpenAI API: ${res.status} ${res.statusText}`
      );
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") return [];
    return parseSlidesFromContent(content);
  }

  async splitSlide(slide: Slide, prompt: string, modelId: string): Promise<Slide[]> {
    const key = getKey();
    const userContent = buildSplitSlideUserMessage(slide, prompt);
    const res = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: modelId || "gpt-4o-mini",
        messages: [
          { role: "system", content: SPLIT_SLIDE_SYSTEM },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err?.error?.message || `OpenAI API: ${res.status} ${res.statusText}`
      );
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") return [];
    try {
      const parsed = JSON.parse(content) as { slides?: Slide[] } | Slide[];
      const arr = Array.isArray(parsed) ? parsed : (parsed as { slides?: Slide[] }).slides;
      if (Array.isArray(arr)) return arr as Slide[];
      const arrayMatch = content.match(/\[[\s\S]*\]/);
      if (arrayMatch) return JSON.parse(arrayMatch[0]) as Slide[];
      return [];
    } catch {
      const arrayMatch = content.match(/\[[\s\S]*\]/);
      if (arrayMatch) return JSON.parse(arrayMatch[0]) as Slide[];
      return [];
    }
  }

  async rewriteSlide(
    slide: Slide,
    prompt: string,
    modelId: string
  ): Promise<{ title: string; content: string }> {
    const key = getKey();
    const userContent = buildRewriteSlideUserMessage(slide, prompt);
    const res = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: modelId || "gpt-4o-mini",
        messages: [
          { role: "system", content: REWRITE_SLIDE_SYSTEM },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err?.error?.message || `OpenAI API: ${res.status} ${res.statusText}`
      );
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
      return { title: slide.title, content: slide.content };
    }
    try {
      const parsed = JSON.parse(content) as { title?: string; content?: string };
      return {
        title: parsed.title ?? slide.title,
        content: parsed.content ?? slide.content,
      };
    } catch {
      return { title: slide.title, content: slide.content };
    }
  }

  async generateImagePromptAlternatives(
    slideContext: string,
    currentPrompt: string,
    styleName: string,
    stylePrompt: string,
    modelId: string,
    characterPrompt?: string
  ): Promise<string> {
    const key = getKey();
    const hasCharacter = !!characterPrompt?.trim();
    const systemContent = hasCharacter
      ? IMAGE_ALTERNATIVES_SYSTEM_WITH_CHARACTER
      : IMAGE_ALTERNATIVES_SYSTEM_NO_CHARACTER;
    const userContent = hasCharacter
      ? buildImageAlternativesUserMessageWithCharacter(
          slideContext,
          styleName,
          currentPrompt
        )
      : buildImageAlternativesUserMessageNoCharacter(
          slideContext,
          styleName,
          currentPrompt
        );
    const res = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: modelId || "gpt-4o-mini",
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: userContent },
        ],
        max_completion_tokens: 500,
        ...(currentPrompt.trim().length > 0 ? { temperature: 0.95 } : {}),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err?.error?.message || `OpenAI API: ${res.status} ${res.statusText}`
      );
    }
    const data = await res.json();
    return (data?.choices?.[0]?.message?.content ?? "").trim();
  }

  async generateImage(params: {
    slideContext: string;
    userPrompt: string;
    stylePrompt: string;
    includeBackground: boolean;
    modelId: string;
    characterPrompt?: string;
    characterReferenceImageDataUrl?: string;
  }): Promise<string | undefined> {
    const key = getKey();
    const {
      slideContext,
      userPrompt,
      stylePrompt,
      includeBackground,
      characterPrompt,
      characterReferenceImageDataUrl,
    } = params;
    const hasReference =
      !!characterReferenceImageDataUrl?.trim() &&
      characterReferenceImageDataUrl!.startsWith("data:image/");
    const fullPrompt = buildImageGenerationPrompt({
      slideContext,
      userPrompt,
      stylePrompt,
      includeBackground,
      characterPrompt,
      hasReferenceImage: hasReference,
      referenceInstruction: "",
      lang: "en",
    });
    if (hasReference && characterReferenceImageDataUrl) {
      try {
        const OpenAI = (await import("openai")).default;
        const openai = new OpenAI({ apiKey: key });
        const tool = {
          type: "image_generation" as const,
          action: "generate" as const,
          input_fidelity: "high" as const,
        };
        const response = await openai.responses.create({
          model: RESPONSES_API_MODEL,
          input: [
            {
              role: "user",
              content: [
                { type: "input_text", text: fullPrompt },
                {
                  type: "input_image",
                  image_url: characterReferenceImageDataUrl,
                },
              ],
            },
          ],
          tools: [tool],
        });
        const imageData = (response.output ?? [])
          .filter((o: { type?: string }) => o.type === "image_generation_call")
          .map((o: { result?: string }) => o.result);
        if (imageData.length > 0 && imageData[0]) {
          return `data:image/png;base64,${imageData[0]}`;
        }
      } catch (e) {
        console.warn(
          "OpenAI Responses API (character image) failed, falling back to Image API:",
          e
        );
      }
    }
    const res = await fetch(IMAGES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: fullPrompt,
        n: 1,
        size: "1024x1024",
        response_format: "b64_json",
        quality: "standard",
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err?.error?.message || `OpenAI API error: ${res.status} ${res.statusText}`
      );
    }
    const data = await res.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) return undefined;
    return `data:image/png;base64,${b64}`;
  }
}
