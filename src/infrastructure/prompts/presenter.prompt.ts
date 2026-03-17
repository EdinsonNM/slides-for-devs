import type { PromptDefinition } from "../promptEngine/types";

/** Input para notas del presentador. */
export interface PresenterNotesInput {
  title: string;
  content: string;
}

export const presenterNotesPrompt: PromptDefinition<PresenterNotesInput> = {
  role: "Genera notas breves para el presentador de esta diapositiva.",
  task: "Incluye puntos clave a recordar, transiciones sugeridas y datos o frases que no deben olvidarse. Sé conciso (2-4 líneas).",
  buildUserMessage(input) {
    return `Título: ${input.title}
Contenido: ${input.content}
Responde solo el texto de las notas, sin título ni formato adicional.`;
  },
};

/** Input para guion (speech) del slide. */
export interface SpeechForSlideInput {
  title: string;
  content: string;
  customPrompt?: string;
}

export const speechForSlidePrompt: PromptDefinition<SpeechForSlideInput> = {
  role: "Genera un guion natural y conciso que un presentador podría decir al mostrar esta diapositiva (2-5 frases).",
  task: "Responde solo el texto del guion, sin etiquetas.",
  buildUserMessage(input) {
    const instruction = input.customPrompt?.trim()
      ? `Instrucción adicional del presentador: ${input.customPrompt}.`
      : "Genera un guion natural y conciso (2-5 frases).";
    return `Diapositiva:
Título: ${input.title}
Contenido: ${input.content}
${instruction}
Responde solo el texto del guion, sin etiquetas.`;
  },
};

/** Input para refinar notas del presentador. */
export interface RefinePresenterNotesInput {
  title: string;
  contentSummary: string;
  currentNotes: string;
}

export const refinePresenterNotesPrompt: PromptDefinition<RefinePresenterNotesInput> = {
  role: "Refina y mejora el siguiente texto de notas para el presentador. Mantén el mismo contenido y sentido, pero mejora la claridad, el tono y la estructura. No añadas contenido nuevo que no esté implícito.",
  task: "Responde solo el texto refinado, sin explicaciones ni etiquetas.",
  buildUserMessage(input) {
    return `Contexto de la diapositiva - Título: ${input.title}. Contenido (resumen): ${input.contentSummary}...

Texto actual del presentador:
${input.currentNotes}
Responde solo el texto refinado, sin explicaciones ni etiquetas.`;
  },
};

/** Input para chat del presentador. */
export interface PresenterChatInput {
  topic: string;
  currentSlideTitle: string;
  currentSlideContent: string;
  userMessage: string;
}

export const presenterChatPrompt: PromptDefinition<PresenterChatInput> = {
  role: "Eres un asistente durante una presentación.",
  task: "Responde de forma clara y concisa. Si incluyes código, formátalo en bloques markdown. Usa listas, negritas y párrafos cuando ayude. Responde solo el contenido útil, sin preámbulos tipo \"Claro, ...\" a menos que sea natural.",
  buildUserMessage(input) {
    return `El tema de la presentación es: "${input.topic}". La diapositiva actual tiene título: "${input.currentSlideTitle}" y contenido: ${input.currentSlideContent.slice(0, 500)}.

El presentador o alguien del público hace la siguiente pregunta o pide que ahondes en el tema:
"${input.userMessage}"`;
  },
};
