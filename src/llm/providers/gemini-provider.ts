import { GoogleGenAI, Type } from "@google/genai";
import type { Slide } from "../../types";
import { getGeminiApiKey } from "../../services/apiConfig";
import type {
  IPresentationGenerator,
  ISlideOperations,
  IImageGenerator,
} from "../types";
import type { PresentationProviderId } from "../types";
import {
  MIN_SLIDES,
  MAX_SLIDES,
  DEFAULT_SLIDES,
  buildSlideCountUserMessage,
  buildGeminiPresentationContent,
  parseRequestedSlideCountFromTopic,
} from "../prompts/presentation";
import {
  buildSplitSlideUserMessage,
  buildRewriteSlideUserMessage,
} from "../prompts/slideOperations";
import {
  buildImageGenerationPrompt,
  IMAGE_REFERENCE_INSTRUCTION_ES,
  buildImageAlternativesUserMessageWithCharacter,
  buildImageAlternativesUserMessageNoCharacter,
} from "../prompts/imagePrompts";

const DEFAULT_TEXT_MODEL = "gemini-2.5-flash";
const DEFAULT_IMAGE_MODEL = "gemini-2.5-flash-image";

function getClient(): GoogleGenAI {
  const key = getGeminiApiKey();
  if (!key) {
    throw new Error(
      "No hay API key de Gemini configurada. Configura al menos una API en la pantalla de inicio."
    );
  }
  return new GoogleGenAI({ apiKey: key });
}

function parseImageDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const match = dataUrl.match(/^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/i);
  if (!match) return null;
  const mimeType = match[1].toLowerCase().replace("jpg", "jpeg");
  return { mimeType, data: match[3] };
}

async function parseRequestedSlideCount(topic: string, model: string): Promise<number> {
  const client = getClient();
  const res = await client.models.generateContent({
    model: model || DEFAULT_TEXT_MODEL,
    contents: buildSlideCountUserMessage(topic),
  });
  const text = (res.text || "").trim();
  const numMatch = text.match(/\d+/);
  if (!numMatch) return DEFAULT_SLIDES;
  const n = parseInt(numMatch[0], 10);
  return Math.min(MAX_SLIDES, Math.max(MIN_SLIDES, n));
}

function parseSlidesFromResponse(text: string): Slide[] {
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  const jsonStr = jsonMatch ? jsonMatch[0] : text;
  try {
    return JSON.parse(jsonStr);
  } catch {
    return [];
  }
}

export class GeminiProvider
  implements IPresentationGenerator, ISlideOperations, IImageGenerator
{
  readonly provider: PresentationProviderId = "gemini";

  async generatePresentation(topic: string, modelId: string): Promise<Slide[]> {
    const model = modelId || DEFAULT_TEXT_MODEL;
    let requestedCount: number;
    const fromTopic = parseRequestedSlideCountFromTopic(topic);
    if (fromTopic != null) {
      requestedCount = fromTopic;
    } else {
      requestedCount = await parseRequestedSlideCount(topic, model);
    }
    const content = buildGeminiPresentationContent(topic, requestedCount);
    const response = await getClient().models.generateContent({
      model: model,
      contents: content,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              type: { type: Type.STRING, enum: ["content", "chapter"] },
              title: { type: Type.STRING },
              subtitle: { type: Type.STRING },
              content: { type: Type.STRING },
              imagePrompt: {
                type: Type.STRING,
                description: "Sugerencia de prompt para generar una imagen",
              },
            },
            required: ["id", "type", "title", "content"],
          },
        },
      },
    });
    return parseSlidesFromResponse(response.text || "[]");
  }

  async splitSlide(slide: Slide, prompt: string, modelId: string): Promise<Slide[]> {
    const content = buildSplitSlideUserMessage(slide, prompt);
    const response = await getClient().models.generateContent({
      model: modelId || DEFAULT_TEXT_MODEL,
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
    return parseSlidesFromResponse(response.text || "[]");
  }

  async rewriteSlide(
    slide: Slide,
    prompt: string,
    modelId: string
  ): Promise<{ title: string; content: string }> {
    const content = buildRewriteSlideUserMessage(slide, prompt);
    const response = await getClient().models.generateContent({
      model: modelId || DEFAULT_TEXT_MODEL,
      contents: content,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            content: { type: Type.STRING },
          },
          required: ["title", "content"],
        },
      },
    });
    try {
      return JSON.parse(response.text || "{}");
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
    const hasCharacter = !!characterPrompt?.trim();
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
    const response = await getClient().models.generateContent({
      model: modelId || DEFAULT_TEXT_MODEL,
      contents: userContent,
      config: currentPrompt.trim().length > 0 ? { temperature: 0.95 } : undefined,
    });
    return (response.text || "").trim();
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
    const {
      slideContext,
      userPrompt,
      stylePrompt,
      includeBackground,
      modelId,
      characterPrompt,
      characterReferenceImageDataUrl,
    } = params;
    const parsedReference = characterReferenceImageDataUrl?.trim()
      ? parseImageDataUrl(characterReferenceImageDataUrl)
      : null;
    const hasReference = !!parsedReference;
    const referenceInstruction = hasReference ? IMAGE_REFERENCE_INSTRUCTION_ES : "";
    const fullPrompt = buildImageGenerationPrompt({
      slideContext,
      userPrompt,
      stylePrompt,
      includeBackground,
      characterPrompt,
      hasReferenceImage: hasReference,
      referenceInstruction,
      lang: "es",
    });
    const contents =
      hasReference && parsedReference
        ? [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: parsedReference.mimeType,
                    data: parsedReference.data,
                  },
                },
                { text: fullPrompt },
              ],
            },
          ]
        : { parts: [{ text: fullPrompt }] };
    const response = await getClient().models.generateContent({
      model: modelId || DEFAULT_IMAGE_MODEL,
      contents,
      config: {
        imageConfig: { aspectRatio: "1:1" },
      },
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return undefined;
  }
}
