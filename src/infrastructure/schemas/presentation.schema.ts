import type { Slide } from "../../domain/entities";
import type { SlideSchemaItem } from "./slide.schema";
import { slideSchemaItemToSlide } from "./slide.schema";

/**
 * Forma de la respuesta del LLM para una presentación completa.
 * Puede ser { slides: SlideSchemaItem[] } o directamente SlideSchemaItem[].
 */
export type PresentationResponse = { slides: SlideSchemaItem[] } | SlideSchemaItem[];

/**
 * Parsea el texto de respuesta del LLM y devuelve un array de Slide.
 * Acepta JSON con clave "slides" o array directo. Extrae el array si viene envuelto en texto.
 */
export function parseSlidesFromResponse(text: string): Slide[] {
  const trimmed = (text || "").trim();
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

/**
 * Descripción para el LLM: forma del JSON de la presentación.
 */
export const presentationOutputDescription = 'Un objeto JSON con una clave "slides" que sea un array de diapositivas.';
