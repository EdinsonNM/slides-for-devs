import type { PromptDefinition } from "../promptEngine/types";
import { DEFAULT_SLIDES, MIN_SLIDES, MAX_SLIDES } from "./constants";

/** Input: solo el tema (mensaje del usuario). */
export interface SlideCountInput {
  topic: string;
}

/**
 * Prompt para que el modelo devuelva un número (cuántas diapositivas quiere el usuario).
 * La respuesta debe ser únicamente un entero entre MIN_SLIDES y MAX_SLIDES.
 */
export const slideCountPrompt: PromptDefinition<SlideCountInput> = {
  role: "Interpreta cuántas diapositivas quiere el usuario para su presentación.",
  task: `Responde ÚNICAMENTE con un número entero entre ${MIN_SLIDES} y ${MAX_SLIDES}, sin texto ni explicación.`,
  buildUserMessage(input) {
    return `Mensaje del usuario para crear una presentación: "${input.topic}"

Interpreta cuántas diapositivas quiere. Ejemplos:
- "20 diapositivas" / "20 slides" → 20
- "unas 15" / "alrededor de 15" → 15
- "presentación larga" / "bien completa" → 20-25
- "cortita" / "breve" / "poca cosa" → 5-8
- "muchas" / "extensa" → 25-30
- Si no dice nada o no está claro → ${DEFAULT_SLIDES}

Responde ÚNICAMENTE con un número entero entre ${MIN_SLIDES} y ${MAX_SLIDES}, sin texto ni explicación.`;
  },
};
