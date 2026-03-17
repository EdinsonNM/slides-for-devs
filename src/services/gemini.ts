import { GoogleGenAI } from "@google/genai";
import type { Slide } from "../types";
import { getGeminiApiKey } from "./apiConfig";
import { buildPrompt } from "../infrastructure/promptEngine";
import {
  refineCharacterPrompt as refineCharacterPromptDef,
  describeCharacterFromImagePrompt,
  presenterNotesPrompt,
  speechForSlidePrompt,
  refinePresenterNotesPrompt,
  codeForSlidePrompt,
  presenterChatPrompt,
} from "../infrastructure/prompts";

const DEFAULT_TEXT_MODEL = "gemini-2.5-flash";

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

export async function refineCharacterPrompt(
  userDescription: string,
  model: string = DEFAULT_TEXT_MODEL
): Promise<string> {
  const { system, user } = buildPrompt(refineCharacterPromptDef, { userDescription });
  const content = `${system}\n\n${user}`;
  const response = await getClient().models.generateContent({
    model: model || DEFAULT_TEXT_MODEL,
    contents: content,
  });
  return (response.text || "").trim();
}

export async function describeCharacterFromImage(
  imageDataUrl: string,
  model: string = DEFAULT_TEXT_MODEL
): Promise<string> {
  const parsed = parseImageDataUrl(imageDataUrl);
  if (!parsed) throw new Error("Formato de imagen no válido. Usa PNG, JPEG o WebP.");

  const { system, user } = buildPrompt(describeCharacterFromImagePrompt, {});
  const textPart = `${system}\n\n${user}`;
  const response = await getClient().models.generateContent({
    model: model || DEFAULT_TEXT_MODEL,
    contents: [
      {
        parts: [
          { inlineData: { mimeType: parsed.mimeType, data: parsed.data } },
          { text: textPart },
        ],
      },
    ],
  });
  return (response.text || "").trim();
}

export async function generatePresenterNotes(
  slide: Slide,
  model: string = DEFAULT_TEXT_MODEL
): Promise<string> {
  const { system, user } = buildPrompt(presenterNotesPrompt, { title: slide.title, content: slide.content });
  const response = await getClient().models.generateContent({
    model: model || DEFAULT_TEXT_MODEL,
    contents: `${system}\n\n${user}`,
  });
  return (response.text || "").trim();
}

export async function generateSpeechForSlide(
  slide: Slide,
  customPrompt?: string,
  model: string = DEFAULT_TEXT_MODEL
): Promise<string> {
  const { system, user } = buildPrompt(speechForSlidePrompt, {
    title: slide.title,
    content: slide.content,
    customPrompt,
  });
  const modelId = (model && model.trim()) || DEFAULT_TEXT_MODEL;
  const response = await getClient().models.generateContent({
    model: modelId,
    contents: `${system}\n\n${user}`,
  });
  return (response.text || "").trim();
}

export async function generateSpeechForAll(
  slides: Slide[],
  generalPrompt: string,
  model: string = DEFAULT_TEXT_MODEL
): Promise<string[]> {
  const results: string[] = [];
  for (const slide of slides) {
    const text = await generateSpeechForSlide(slide, generalPrompt, model);
    results.push(text);
  }
  return results;
}

export async function refinePresenterNotes(
  slide: Slide,
  currentNotes: string,
  model: string = DEFAULT_TEXT_MODEL
): Promise<string> {
  if (!currentNotes.trim()) return currentNotes;
  const { system, user } = buildPrompt(refinePresenterNotesPrompt, {
    title: slide.title,
    contentSummary: slide.content.slice(0, 300),
    currentNotes,
  });
  const response = await getClient().models.generateContent({
    model: model || DEFAULT_TEXT_MODEL,
    contents: `${system}\n\n${user}`,
  });
  return (response.text || currentNotes).trim();
}

export async function generateCodeForSlide(
  slide: Slide,
  language: string,
  customPrompt?: string,
  model: string = DEFAULT_TEXT_MODEL
): Promise<{ code: string }> {
  const { system, user } = buildPrompt(codeForSlidePrompt, {
    title: slide.title,
    content: slide.content,
    language,
    customPrompt,
  });
  const modelId = (model && model.trim()) || DEFAULT_TEXT_MODEL;
  const response = await getClient().models.generateContent({
    model: modelId,
    contents: `${system}\n\n${user}`,
  });
  const text = (response.text || "").trim();
  const code = text
    .replace(/^```[\w]*\n?/, "")
    .replace(/\n?```\s*$/, "")
    .trim();
  return { code: code || "// Sin código generado" };
}

export async function presenterChat(
  topic: string,
  currentSlideTitle: string,
  currentSlideContent: string,
  userMessage: string,
  model: string = DEFAULT_TEXT_MODEL
): Promise<string> {
  const { system, user } = buildPrompt(presenterChatPrompt, {
    topic,
    currentSlideTitle,
    currentSlideContent,
    userMessage,
  });
  const response = await getClient().models.generateContent({
    model: model || DEFAULT_TEXT_MODEL,
    contents: `${system}\n\n${user}`,
  });
  return (response.text || "").trim();
}
