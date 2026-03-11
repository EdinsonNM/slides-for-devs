import type { PromptDefinition } from "../promptEngine/types";

/** Input para código de ejemplo en slide. */
export interface CodeForSlideInput {
  title: string;
  content: string;
  language: string;
  customPrompt?: string;
}

export const codeForSlidePrompt: PromptDefinition<CodeForSlideInput> = {
  role: "Eres un experto en programación. Genera código de ejemplo para una diapositiva de presentación.",
  task: "Responde ÚNICAMENTE con el bloque de código, sin markdown (sin ```), sin explicaciones antes ni después. El código debe ser conciso, correcto y fácil de leer en una slide.",
  buildUserMessage(input) {
    const context = `Título: ${input.title}\nContenido: ${input.content}`;
    const instruction = input.customPrompt?.trim()
      ? `Instrucción adicional del usuario: ${input.customPrompt}.`
      : "Genera código de ejemplo breve y claro que ilustre el concepto de esta diapositiva. Solo el código, sin explicaciones alrededor.";
    return `Contexto de la diapositiva:
---
${context}
---

Lenguaje de programación: ${input.language}.
${instruction}

Responde ÚNICAMENTE con el bloque de código, sin markdown (sin \`\`\`), sin explicaciones antes ni después.`;
  },
};
