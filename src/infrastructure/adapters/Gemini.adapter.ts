import { GoogleGenAI, Type } from "@google/genai";
import type {
  PresentationGeneratorPort,
  SlideOperationsPort,
  ImageGeneratorPort,
} from "../../domain/ports";
import {
  type Slide,
  SLIDE_TYPE,
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
  generateSlideDiagramPrompt,
  imageAlternativesPrompt,
  imageGenerationPrompt,
} from "../prompts";
import { parseSlidesFromResponse } from "../schemas";
import { getGeminiApiKey } from "../../services/apiConfig";

const DEFAULT_TEXT = "gemini-2.5-flash";
const DEFAULT_IMAGE = "gemini-2.5-flash-image";
const { min, max, default: def } = slideCountBounds;

function client(): GoogleGenAI {
  const key = getGeminiApiKey();
  if (!key) throw new Error("No hay API key de Gemini configurada.");
  return new GoogleGenAI({ apiKey: key });
}

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const m = dataUrl.match(/^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/i);
  if (!m) return null;
  return { mimeType: m[1].toLowerCase().replace("jpg", "jpeg"), data: m[3] };
}

async function resolveSlideCount(topic: string, model: string): Promise<number> {
  const { system, user } = buildPrompt(slideCountPrompt, { topic });
  const content = `${system}\n\n${user}`;
  const res = await client().models.generateContent({
    model: model || DEFAULT_TEXT,
    contents: content,
  });
  const text = (res.text || "").trim();
  const n = text.match(/\d+/);
  if (!n) return def;
  const num = parseInt(n[0], 10);
  return Math.min(max, Math.max(min, num));
}

const presentationSchema = {
  responseMimeType: "application/json" as const,
  responseSchema: {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        type: { type: Type.STRING, enum: [SLIDE_TYPE.CONTENT, SLIDE_TYPE.CHAPTER] },
        title: { type: Type.STRING },
        subtitle: { type: Type.STRING },
        content: { type: Type.STRING },
        imagePrompt: { type: Type.STRING },
      },
      required: ["id", "type", "title", "content"],
    },
  },
};

export class GeminiAdapter
  implements PresentationGeneratorPort, SlideOperationsPort, ImageGeneratorPort
{
  async generatePresentation(topic: string, modelId: string): Promise<Slide[]> {
    const model = modelId || DEFAULT_TEXT;
    const fromTopic = parseSlideCountFromTopic(topic);
    const requestedCount = fromTopic ?? await resolveSlideCount(topic, model);
    const { system, user } = buildPrompt(generatePresentationPrompt, {
      topic,
      slideCount: requestedCount,
      strictCount: requestedCount !== def,
    });
    const content = `${system}\n\n${user}`;
    const res = await client().models.generateContent({
      model,
      contents: content,
      config: presentationSchema,
    });
    return parseSlidesFromResponse(res.text || "[]");
  }

  async splitSlide(slide: Slide, prompt: string, modelId: string): Promise<Slide[]> {
    const { system, user } = buildPrompt(splitSlidePrompt, { slide, userPrompt: prompt });
    const content = `${system}\n\n${user}`;
    const res = await client().models.generateContent({
      model: modelId || DEFAULT_TEXT,
      contents: content,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              type: { type: Type.STRING, enum: ["content"] },
              title: { type: Type.STRING },
              content: { type: Type.STRING },
              imagePrompt: { type: Type.STRING },
            },
            required: ["id", "type", "title", "content"],
          },
        },
      },
    });
    return parseSlidesFromResponse(res.text || "[]");
  }

  async rewriteSlide(
    slide: Slide,
    prompt: string,
    modelId: string
  ): Promise<{ title: string; content: string }> {
    const { system, user } = buildPrompt(rewriteSlidePrompt, { slide, userPrompt: prompt });
    const content = `${system}\n\n${user}`;
    const res = await client().models.generateContent({
      model: modelId || DEFAULT_TEXT,
      contents: content,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: { title: { type: Type.STRING }, content: { type: Type.STRING } },
          required: ["title", "content"],
        },
      },
    });
    try {
      const parsed = JSON.parse(res.text || "{}") as { title?: string; content?: string };
      return { title: parsed.title ?? slide.title, content: parsed.content ?? slide.content };
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
    const content = `${system}\n\n${user}`;
    const res = await client().models.generateContent({
      model: modelId || DEFAULT_TEXT,
      contents: content,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: { title: { type: Type.STRING }, content: { type: Type.STRING } },
          required: ["title", "content"],
        },
      },
    });
    try {
      const parsed = JSON.parse(res.text || "{}") as { title?: string; content?: string };
      return { title: parsed.title ?? slide.title, content: parsed.content ?? slide.content };
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
    const content = `${system}\n\n${user}`;
    const res = await client().models.generateContent({
      model: modelId || DEFAULT_TEXT,
      contents: content,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            subtitle: { type: Type.STRING },
            content: { type: Type.STRING },
            columnHeaders: { type: Type.ARRAY, items: { type: Type.STRING } },
            rows: {
              type: Type.ARRAY,
              items: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
          },
          required: ["title", "subtitle", "content", "columnHeaders", "rows"],
        },
      },
    });
    try {
      const parsed = JSON.parse(res.text || "{}") as {
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

  async generateSlideDiagram(
    presentationTopic: string,
    slide: Slide,
    userPrompt: string,
    modelId: string
  ): Promise<{ title: string; content: string; mermaid: string }> {
    const fallback = {
      title: slide.title,
      content: slide.content,
      mermaid: "flowchart TD\nA[Define el diagrama en el prompt]",
    };
    const { system, user } = buildPrompt(generateSlideDiagramPrompt, {
      presentationTopic,
      slideTitle: slide.title,
      slideContent: slide.content,
      userPrompt,
    });
    const content = `${system}\n\n${user}`;
    const res = await client().models.generateContent({
      model: modelId || DEFAULT_TEXT,
      contents: content,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            content: { type: Type.STRING },
            mermaid: { type: Type.STRING },
          },
          required: ["title", "content", "mermaid"],
        },
      },
    });
    try {
      const parsed = JSON.parse(res.text || "{}") as {
        title?: string;
        content?: string;
        mermaid?: string;
      };
      const mermaid = String(parsed.mermaid ?? "").trim();
      if (!mermaid) return fallback;
      return {
        title: (parsed.title ?? slide.title).trim() || slide.title,
        content: String(parsed.content ?? "").trim(),
        mermaid,
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
    const content = `${system}\n\n${user}`;
    const res = await client().models.generateContent({
      model: modelId || DEFAULT_TEXT,
      contents: content,
      config: currentPrompt.trim().length > 0 ? { temperature: 0.95 } : undefined,
    });
    return (res.text || "").trim();
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
    const ref = params.characterReferenceImageDataUrl?.trim()
      ? parseDataUrl(params.characterReferenceImageDataUrl)
      : null;
    const hasRef = !!ref;
    const { user: fullPrompt } = buildPrompt(imageGenerationPrompt, {
      slideContext: params.slideContext,
      userPrompt: params.userPrompt,
      stylePrompt: params.stylePrompt,
      includeBackground: params.includeBackground,
      characterPrompt: params.characterPrompt,
      hasReferenceImage: hasRef,
      characterPreviewOnly: params.characterPreviewOnly,
    });
    const contents =
      hasRef && ref
        ? [
            {
              parts: [
                { inlineData: { mimeType: ref.mimeType, data: ref.data } },
                { text: fullPrompt },
              ],
            },
          ]
        : { parts: [{ text: fullPrompt }] };
    const res = await client().models.generateContent({
      model: params.modelId || DEFAULT_IMAGE,
      contents,
      config: { imageConfig: { aspectRatio: "9:16" } },
    });
    for (const part of res.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    return undefined;
  }
}
