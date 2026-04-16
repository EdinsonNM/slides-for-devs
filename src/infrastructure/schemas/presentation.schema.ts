import type { Slide } from "../../domain/entities";
import type { SlideSchemaItem } from "./slide.schema";
import { slideSchemaItemToSlide } from "./slide.schema";

/**
 * Forma de la respuesta del LLM para una presentación completa.
 * Puede ser { slides: SlideSchemaItem[] } o directamente SlideSchemaItem[].
 */
export type PresentationResponse = { slides: SlideSchemaItem[] } | SlideSchemaItem[];

/** Resultado de parsear la generación completa del deck (incluye título sugerido). */
export interface GeneratedDeckParseResult {
  slides: Slide[];
  presentationTitle?: string;
}

/** Quita ```json ... ``` si el modelo envolvió el JSON en un fence markdown. */
function stripMarkdownJsonFence(s: string): string {
  let t = s.trim();
  const fenced = /^```(?:json)?\s*\r?\n?([\s\S]*?)\r?\n?```\s*$/i;
  const m = t.match(fenced);
  if (m) return m[1].trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*\r?\n?/i, "").replace(/\r?\n?```\s*$/i, "");
  }
  return t.trim();
}

/**
 * Parsea el texto de respuesta del LLM y devuelve un array de Slide.
 * Acepta JSON con clave "slides" o array directo. Extrae el array si viene envuelto en texto.
 */
export function parseSlidesFromResponse(text: string): Slide[] {
  const trimmed = stripMarkdownJsonFence(text || "");
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed) as PresentationResponse;
    return normalizeToSlides(parsed);
  } catch {
    const arrayMatch = trimmed.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        const arr = JSON.parse(arrayMatch[0]) as SlideSchemaItem[];
        return arr.map((item, i) => slideSchemaItemToSlide(item, i));
      } catch {
        return [];
      }
    }
    const slidesMatch = trimmed.match(/"slides"\s*:\s*(\[[\s\S]*\])/);
    if (slidesMatch) {
      try {
        const arr = JSON.parse(slidesMatch[1]) as SlideSchemaItem[];
        return arr.map((item, i) => slideSchemaItemToSlide(item, i));
      } catch {
        return [];
      }
    }
    return [];
  }
}

function normalizeToSlides(data: PresentationResponse): Slide[] {
  const items = Array.isArray(data) ? data : (data as { slides: SlideSchemaItem[] }).slides;
  if (!Array.isArray(items)) return [];
  return items.map((item, i) => slideSchemaItemToSlide(item, i));
}

function tryParsePresentationTitleFromObject(parsed: unknown): string | undefined {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
  const raw = (parsed as { presentationTitle?: unknown }).presentationTitle;
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  return t.length > 0 ? t : undefined;
}

/**
 * Parsea respuesta de generación completa: extrae `slides` y opcionalmente `presentationTitle`.
 * Compatible con respuestas antiguas (solo array o solo `slides`).
 */
export function parseGeneratedDeckFromResponse(text: string): GeneratedDeckParseResult {
  const trimmed = stripMarkdownJsonFence(text || "");
  if (!trimmed) return { slides: [] };

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      return {
        slides: (parsed as SlideSchemaItem[]).map((item, i) =>
          slideSchemaItemToSlide(item, i),
        ),
      };
    }
    if (parsed && typeof parsed === "object") {
      const title = tryParsePresentationTitleFromObject(parsed);
      const items = (parsed as { slides?: SlideSchemaItem[] }).slides;
      if (Array.isArray(items)) {
        return {
          slides: items.map((item, i) => slideSchemaItemToSlide(item, i)),
          presentationTitle: title,
        };
      }
    }
  } catch {
    /* continuar con heurísticas de parseSlidesFromResponse */
  }

  const slides = parseSlidesFromResponse(text);
  let presentationTitle: string | undefined;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    presentationTitle = tryParsePresentationTitleFromObject(parsed);
  } catch {
    /* ignore */
  }
  return { slides, presentationTitle };
}

/**
 * Descripción para el LLM: forma del JSON de la presentación.
 */
export const presentationOutputDescription =
  'Un objeto JSON con: (1) clave "presentationTitle": string, un título corto y legible de la presentación en español (unas 3–12 palabras, sin copiar el brief completo del usuario); (2) clave "slides": array de diapositivas.';
