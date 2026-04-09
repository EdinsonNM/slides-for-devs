import type {
  PresentationGeneratorPort,
  SlideOperationsPort,
  ImageGeneratorPort,
} from "../../domain/ports";
import {
  type Slide,
  createEmptySlideMatrixData,
  normalizeSlideMatrixData,
  serializeSlideMatrixForPrompt,
} from "../../domain/entities";
import { buildPrompt } from "../promptEngine";
import {
  slideCountBounds,
  parseSlideCountFromTopic,
  slideCountPrompt,
  generatePresentationPrompt,
  splitSlidePrompt,
  rewriteSlidePrompt,
  generateSlideContentPrompt,
  generateSlideMatrixPrompt,
  imageAlternativesPrompt,
  imageGenerationPrompt,
} from "../prompts";
import { parseSlidesFromResponse } from "../schemas";
import { getOpenAIApiKey } from "../../services/apiConfig";

const CHAT_URL = "https://api.openai.com/v1/chat/completions";
const IMAGES_URL = "https://api.openai.com/v1/images/generations";
const RESPONSES_MODEL = "gpt-5";
const DEFAULT_CHAT = "gpt-5.2";
const { min, max, default: def } = slideCountBounds;

function key(): string {
  const k = getOpenAIApiKey();
  if (!k?.trim()) throw new Error("No hay API key de OpenAI configurada.");
  return k.trim();
}

async function resolveSlideCount(topic: string, model: string): Promise<number> {
  const { system, user } = buildPrompt(slideCountPrompt, { topic });
  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key()}` },
    body: JSON.stringify({
      model: model || "gpt-4o-mini",
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      max_completion_tokens: 10,
    }),
  });
  if (!res.ok) return def;
  const data = await res.json().catch(() => ({}));
  const text = (data?.choices?.[0]?.message?.content ?? "").trim();
  const n = text.match(/\d+/);
  if (!n) return def;
  return Math.min(max, Math.max(min, parseInt(n[0], 10)));
}

export class OpenAIAdapter
  implements PresentationGeneratorPort, SlideOperationsPort, ImageGeneratorPort
{
  async generatePresentation(topic: string, modelId: string): Promise<Slide[]> {
    const model = modelId || DEFAULT_CHAT;
    const requestedCount =
      parseSlideCountFromTopic(topic) ?? await resolveSlideCount(topic, model);
    const { system, user } = buildPrompt(generatePresentationPrompt, {
      topic,
      slideCount: requestedCount,
      strictCount: requestedCount !== def,
    });
    const res = await fetch(CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key()}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `OpenAI API: ${res.status}`);
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    return content && typeof content === "string" ? parseSlidesFromResponse(content) : [];
  }

  async splitSlide(slide: Slide, prompt: string, modelId: string): Promise<Slide[]> {
    const { system, user } = buildPrompt(splitSlidePrompt, { slide, userPrompt: prompt });
    const res = await fetch(CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key()}` },
      body: JSON.stringify({
        model: modelId || "gpt-4o-mini",
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error?.message || "OpenAI API");
    const content = (await res.json())?.choices?.[0]?.message?.content;
    return content && typeof content === "string" ? parseSlidesFromResponse(content) : [];
  }

  async rewriteSlide(
    slide: Slide,
    prompt: string,
    modelId: string
  ): Promise<{ title: string; content: string }> {
    const { system, user } = buildPrompt(rewriteSlidePrompt, { slide, userPrompt: prompt });
    const res = await fetch(CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key()}` },
      body: JSON.stringify({
        model: modelId || "gpt-4o-mini",
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error?.message || "OpenAI API");
    const content = (await res.json())?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string")
      return { title: slide.title, content: slide.content };
    try {
      const p = JSON.parse(content) as { title?: string; content?: string };
      return { title: p.title ?? slide.title, content: p.content ?? slide.content };
    } catch {
      return { title: slide.title, content: slide.content };
    }
  }

  async generateSlideContent(
    presentationTopic: string,
    slide: Slide,
    userPrompt: string,
    modelId: string
  ): Promise<{ title: string; content: string }> {
    const { system, user } = buildPrompt(generateSlideContentPrompt, {
      presentationTopic,
      slideTitle: slide.title,
      slideContent: slide.content,
      userPrompt,
    });
    const res = await fetch(CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key()}` },
      body: JSON.stringify({
        model: modelId || "gpt-4o-mini",
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error?.message || "OpenAI API");
    const content = (await res.json())?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string")
      return { title: slide.title, content: slide.content };
    try {
      const p = JSON.parse(content) as { title?: string; content?: string };
      return { title: p.title ?? slide.title, content: p.content ?? slide.content };
    } catch {
      return { title: slide.title, content: slide.content };
    }
  }

  async generateSlideMatrix(
    presentationTopic: string,
    slide: Slide,
    userPrompt: string,
    modelId: string
  ): Promise<{
    title: string;
    subtitle: string;
    content: string;
    columnHeaders: string[];
    rows: string[][];
  }> {
    const baseMatrix = normalizeSlideMatrixData(slide.matrixData ?? createEmptySlideMatrixData());
    const fallback = {
      title: slide.title,
      subtitle: slide.subtitle ?? "",
      content: slide.content,
      columnHeaders: baseMatrix.columnHeaders,
      rows: baseMatrix.rows,
    };
    const { system, user } = buildPrompt(generateSlideMatrixPrompt, {
      presentationTopic,
      slideTitle: slide.title,
      slideSubtitle: slide.subtitle ?? "",
      matrixJson: serializeSlideMatrixForPrompt(baseMatrix),
      userPrompt,
    });
    const res = await fetch(CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key()}` },
      body: JSON.stringify({
        model: modelId || "gpt-4o-mini",
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error?.message || "OpenAI API");
    const raw = (await res.json())?.choices?.[0]?.message?.content;
    if (!raw || typeof raw !== "string") return fallback;
    try {
      const parsed = JSON.parse(raw) as {
        title?: string;
        subtitle?: string;
        content?: string;
        columnHeaders?: unknown;
        rows?: unknown;
      };
      const matrix = normalizeSlideMatrixData({
        columnHeaders: parsed.columnHeaders,
        rows: parsed.rows,
      });
      return {
        title: (parsed.title ?? slide.title).trim() || slide.title,
        subtitle: String(parsed.subtitle ?? "").trim(),
        content: String(parsed.content ?? "").trim(),
        columnHeaders: matrix.columnHeaders,
        rows: matrix.rows,
      };
    } catch {
      return fallback;
    }
  }

  async generateImagePromptAlternatives(
    slideContext: string,
    currentPrompt: string,
    styleName: string,
    stylePrompt: string,
    modelId: string,
    characterPrompt?: string,
    includeBackground: boolean = true
  ): Promise<string> {
    const hasCharacter = !!characterPrompt?.trim();
    const { system, user } = buildPrompt(imageAlternativesPrompt, {
      slideContext,
      styleName,
      currentPrompt,
      hasCharacter,
      includeBackground,
    });
    const res = await fetch(CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key()}` },
      body: JSON.stringify({
        model: modelId || "gpt-4o-mini",
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        max_completion_tokens: 500,
        ...(currentPrompt.trim().length > 0 ? { temperature: 0.95 } : {}),
      }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error?.message || "OpenAI API");
    return ((await res.json())?.choices?.[0]?.message?.content ?? "").trim();
  }

  async generateImage(params: {
    slideContext: string;
    userPrompt: string;
    stylePrompt: string;
    includeBackground: boolean;
    modelId: string;
    characterPrompt?: string;
    characterReferenceImageDataUrl?: string;
    characterPreviewOnly?: boolean;
  }): Promise<string | undefined> {
    const hasRef =
      !!params.characterReferenceImageDataUrl?.trim() &&
      params.characterReferenceImageDataUrl!.startsWith("data:image/");

    const buildPromptForImageApi = (useReferenceImage: boolean) => {
      const { user } = buildPrompt(imageGenerationPrompt, {
        slideContext: params.slideContext,
        userPrompt: params.userPrompt,
        stylePrompt: params.stylePrompt,
        includeBackground: params.includeBackground,
        characterPrompt: params.characterPrompt,
        hasReferenceImage: useReferenceImage,
        characterPreviewOnly: params.characterPreviewOnly,
      });
      return user;
    };

    const OPENAI_IMAGE_PROMPT_MAX_LENGTH = 4000;
    const truncatePrompt = (p: string) =>
      p.length > OPENAI_IMAGE_PROMPT_MAX_LENGTH ? p.slice(0, OPENAI_IMAGE_PROMPT_MAX_LENGTH - 3) + "..." : p;

    if (hasRef && params.characterReferenceImageDataUrl) {
      try {
        const fullPrompt = truncatePrompt(buildPromptForImageApi(true));
        const OpenAI = (await import("openai")).default;
        const openai = new OpenAI({ apiKey: key() });
        const response = await openai.responses.create({
          model: RESPONSES_MODEL,
          input: [
            {
              role: "user",
              content: [
                { type: "input_text", text: fullPrompt },
                {
                  type: "input_image",
                  image_url: params.characterReferenceImageDataUrl,
                  detail: "auto",
                },
              ],
            },
          ],
          tools: [{ type: "image_generation" }],
        });
        const outputItems = response.output ?? [];
        const imageCalls = outputItems.filter(
          (o): o is (typeof outputItems)[number] & { type: "image_generation_call"; result: string | null } =>
            (o as { type?: string }).type === "image_generation_call"
        );
        const result = imageCalls.map((o) => (o as { result: string | null }).result);
        if (result[0]) return `data:image/png;base64,${result[0]}`;
      } catch {
        // Fallback to Image API without logging prompt or error in production
      }
    }

    const textOnlyPrompt = truncatePrompt(buildPromptForImageApi(false));

    const modelId = params.modelId || "gpt-image-1.5";
    const isGptImage = modelId.startsWith("gpt-image");
    const body: Record<string, unknown> = {
      model: modelId,
      prompt: textOnlyPrompt,
      n: 1,
      size: "1024x1536", // 2:3 portrait; formato vertical cercano a 9:16
    };
    if (isGptImage) {
      body.quality = "medium";
      // gpt-image-* devuelve b64 por defecto; no acepta response_format
    } else {
      body.quality = "standard";
      body.response_format = "b64_json";
    }
    const res = await fetch(IMAGES_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key()}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error?.message || "OpenAI API");
    const b64 = (await res.json())?.data?.[0]?.b64_json;
    return b64 ? `data:image/png;base64,${b64}` : undefined;
  }
}
