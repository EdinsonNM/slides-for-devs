/**
 * Modelos de imagen de OpenAI (API /v1/images/generations).
 * gpt-image-1.5 es el recomendado (mejor calidad, texto más legible).
 * @see https://platform.openai.com/docs/api-reference/images/create
 */
export const DEFAULT_OPENAI_IMAGE_MODEL_ID = "gpt-image-1.5";

/** Etiqueta en configuración (la app usa un único modelo vía API de imágenes). */
export const OPENAI_IMAGE_MODEL_DISPLAY =
  "GPT Image 1.5 (gpt-image-1.5) · API de imágenes";
