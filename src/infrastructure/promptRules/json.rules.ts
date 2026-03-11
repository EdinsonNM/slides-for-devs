/**
 * Reglas reutilizables para respuestas en formato JSON.
 * Usado por el Prompt Engine en prompts que piden salida JSON.
 */

export const jsonResponseRules: string[] = [
  "Genera siempre un JSON válido.",
  "Sin explicaciones ni texto fuera del JSON.",
  "Responde ÚNICAMENTE con el JSON solicitado.",
];

/**
 * Texto formateado para inyectar en el prompt (respuesta solo JSON).
 */
export function jsonResponseRulesText(): string {
  return "Responde ÚNICAMENTE un JSON válido, sin texto ni explicación antes o después.";
}

/**
 * Variante para respuestas que deben ser estrictamente un objeto/array JSON.
 */
export function jsonStrictRulesText(): string {
  return "Responde estrictamente en formato JSON. Sin comillas alrededor del JSON, sin explicaciones.";
}
