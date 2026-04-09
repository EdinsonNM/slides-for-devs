import { SLIDE_TYPE, type Slide } from "../../domain/entities";

/**
 * Estructura mínima de una slide tal como la genera el LLM (presentación, split).
 * Compatible con domain/entities/Slide.ts.
 */
export interface SlideSchemaItem {
  id: string;
  type: "content" | "chapter";
  title: string;
  subtitle?: string;
  content: string;
  imagePrompt?: string;
}

/**
 * Descripción para el LLM: forma del JSON de una diapositiva.
 * Usado en prompts de generatePresentation, splitSlide.
 */
export const slideSchemaDescription = `Cada diapositiva: id (string), type ("content" o "chapter"), title (string), content (string, markdown), imagePrompt (string, opcional), subtitle (string, opcional). Las de tipo "chapter" tienen solo título impactante; las de tipo "content" tienen title, content en markdown e imagePrompt para ilustrar.`;

/**
 * Forma del JSON de salida para el array de slides (para incluir en el prompt).
 */
export const slidesArrayShapeDescription = `{ "slides": [ { "id": "...", "type": "content"|"chapter", "title": "...", "content": "...", "imagePrompt": "..." }, ... ] }`;

/**
 * Convierte un ítem del schema (respuesta del LLM) a la entidad Slide del dominio.
 */
export function slideSchemaItemToSlide(item: SlideSchemaItem, index: number): Slide {
  return {
    id: item.id || `slide-${index + 1}`,
    type: item.type === SLIDE_TYPE.CHAPTER ? SLIDE_TYPE.CHAPTER : SLIDE_TYPE.CONTENT,
    title: item.title ?? "",
    subtitle: item.subtitle,
    content: item.content ?? "",
    imagePrompt: item.imagePrompt,
  };
}
