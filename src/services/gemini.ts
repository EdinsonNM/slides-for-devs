import { GoogleGenAI } from "@google/genai";
import type { Slide } from "../types";
import { getGeminiApiKey } from "./apiConfig";
import {
  buildRefineCharacterPrompt,
  DESCRIBE_CHARACTER_FROM_IMAGE,
  buildPresenterNotesPrompt,
  buildSpeechForSlidePrompt,
  buildRefinePresenterNotesPrompt,
  buildCodeForSlidePrompt,
  buildPresenterChatPrompt,
} from "../llm/prompts/characterAndPresenter";

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

/** Refina la descripción del usuario en un prompt preciso y reutilizable para generar siempre el mismo personaje. */
export async function refineCharacterPrompt(
  userDescription: string,
  model: string = DEFAULT_TEXT_MODEL
): Promise<string> {
  const response = await getClient().models.generateContent({
    model: model || DEFAULT_TEXT_MODEL,
    contents: buildRefineCharacterPrompt(userDescription),
  });
  return (response.text || "").trim();
}

/** Describe el personaje de una imagen de referencia para obtener un prompt reutilizable (requiere Gemini con visión). */
export async function describeCharacterFromImage(
  imageDataUrl: string,
  model: string = DEFAULT_TEXT_MODEL
): Promise<string> {
  const parsed = parseImageDataUrl(imageDataUrl);
  if (!parsed) throw new Error("Formato de imagen no válido. Usa PNG, JPEG o WebP.");

  const response = await getClient().models.generateContent({
    model: model || DEFAULT_TEXT_MODEL,
    contents: [
      {
        parts: [
          { inlineData: { mimeType: parsed.mimeType, data: parsed.data } },
          { text: DESCRIBE_CHARACTER_FROM_IMAGE },
        ],
      },
    ],
  });
  return (response.text || "").trim();
}

/** Genera notas del presentador para una diapositiva */
export async function generatePresenterNotes(
  slide: Slide,
  model: string = DEFAULT_TEXT_MODEL
): Promise<string> {
  const response = await getClient().models.generateContent({
    model: model || DEFAULT_TEXT_MODEL,
    contents: buildPresenterNotesPrompt(slide),
  });
  return (response.text || "").trim();
}

/** Genera speech/guion para una diapositiva con prompt opcional (específico o vacío para estándar) */
export async function generateSpeechForSlide(
  slide: Slide,
  customPrompt?: string,
  model: string = DEFAULT_TEXT_MODEL
): Promise<string> {
  const response = await getClient().models.generateContent({
    model: model || DEFAULT_TEXT_MODEL,
    contents: buildSpeechForSlidePrompt(slide, customPrompt),
  });
  return (response.text || "").trim();
}

/** Genera speech para todas las diapositivas usando un prompt general */
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

/** Refina el texto de las notas del presentador manteniendo el sentido y mejorando claridad y tono */
export async function refinePresenterNotes(
  slide: Slide,
  currentNotes: string,
  model: string = DEFAULT_TEXT_MODEL
): Promise<string> {
  if (!currentNotes.trim()) return currentNotes;
  const response = await getClient().models.generateContent({
    model: model || DEFAULT_TEXT_MODEL,
    contents: buildRefinePresenterNotesPrompt(slide, currentNotes),
  });
  return (response.text || currentNotes).trim();
}

/** Genera código para el slide según título, contenido y lenguaje. Opcional: prompt extra del usuario. */
export async function generateCodeForSlide(
  slide: Slide,
  language: string,
  customPrompt?: string,
  model: string = DEFAULT_TEXT_MODEL
): Promise<{ code: string }> {
  const response = await getClient().models.generateContent({
    model: model || DEFAULT_TEXT_MODEL,
    contents: buildCodeForSlidePrompt(slide, language, customPrompt),
  });
  const text = (response.text || "").trim();
  const code = text
    .replace(/^```[\w]*\n?/, "")
    .replace(/\n?```\s*$/, "")
    .trim();
  return { code: code || "// Sin código generado" };
}

/** Chat para consultas durante la presentación: responde en markdown con contexto del tema y slide actual */
export async function presenterChat(
  topic: string,
  currentSlideTitle: string,
  currentSlideContent: string,
  userMessage: string,
  model: string = DEFAULT_TEXT_MODEL
): Promise<string> {
  const response = await getClient().models.generateContent({
    model: model || DEFAULT_TEXT_MODEL,
    contents: buildPresenterChatPrompt(
      topic,
      currentSlideTitle,
      currentSlideContent,
      userMessage
    ),
  });
  return (response.text || "").trim();
}
