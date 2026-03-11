/**
 * Reglas reutilizables para formateo de contenido en markdown (slides, content).
 * Usado por el Prompt Engine al construir prompts de presentación, split, rewrite, etc.
 */

export const markdownContentRules: string[] = [
  "Para títulos o subtítulos de sección usa encabezados con numeral (# ## ###), por ejemplo \"## Problemas Comunes\" o \"### Detalles\".",
  "No uses \"* **Título:**\" como subtítulo; usa encabezados con # ## ###.",
  "Cada viñeta (* o -) y cada ítem numerado (1. 2. 3.) en su propia línea.",
  "Usa ** solo para destacar términos dentro de una línea, no para encabezados.",
  "Markdown limpio: una viñeta o ítem numerado por línea.",
];

/**
 * Texto formateado listo para inyectar en el system/user prompt.
 */
export function markdownContentRulesText(): string {
  return `En el campo content (markdown) es OBLIGATORIO: para títulos o subtítulos de sección usa encabezados con numeral (# ## ###), por ejemplo "## Problemas Comunes" o "### Detalles"; no uses "* **Título:**" como subtítulo. Cada viñeta (* o -) y cada ítem numerado (1. 2. 3.) en su propia línea. Usa ** solo para destacar términos dentro de una línea, no para encabezados. Ejemplo: "## Sección\\n* **A:** texto\\n* **B:** texto".`;
}

/** Recordatorio corto para user message (encabezados, viñetas, negrita). */
export function markdownUserReminder(): string {
  return "En content usa encabezados con # ## ### para títulos/subtítulos de sección; cada viñeta (* o -) y cada ítem numerado (1. 2. 3.) en su propia línea. Usa ** solo para énfasis dentro de una línea.";
}
