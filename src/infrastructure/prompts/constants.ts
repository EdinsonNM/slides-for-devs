/** Límites de número de diapositivas (para interpretar tema y para generación). */
export const MIN_SLIDES = 3;
export const MAX_SLIDES = 50;
export const DEFAULT_SLIDES = 10;

export const slideCountBounds = {
  min: MIN_SLIDES,
  max: MAX_SLIDES,
  default: DEFAULT_SLIDES,
} as const;

/**
 * Extrae del texto del tema un número explícito de diapositivas (ej: "20 diapositivas" → 20).
 */
export function parseSlideCountFromTopic(topic: string): number | null {
  const match = topic.match(/(\d+)\s*(diapositivas?|slides?)\b/i);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  return Math.min(MAX_SLIDES, Math.max(MIN_SLIDES, n));
}
