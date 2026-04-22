import type { PromptDefinition } from "../promptEngine/types";
import type { GenerateSlideContentInput } from "../promptEngine/types";
import { markdownContentRulesText, markdownUserReminder } from "../promptRules/markdown.rules";
import { jsonStrictRulesText } from "../promptRules/json.rules";

const role =
  "Eres un experto en crear contenido claro y estructurado para una sola diapositiva de una presentación técnica o profesional.";
const task =
  "Responde ÚNICAMENTE un JSON válido con exactamente dos claves: \"title\" (string) y \"content\" (string, markdown).";

function rules(): string {
  return [markdownContentRulesText(), jsonStrictRulesText()].join("\n\n");
}

export const generateSlideContentPrompt: PromptDefinition<GenerateSlideContentInput> = {
  role,
  task,
  rules,
  outputSchema: "Objeto JSON con propiedades 'title' y 'content'.",
  buildUserMessage(input) {
    const { presentationTopic, slideTitle, slideContent, userPrompt, deckNarrativeContext } =
      input;
    const narrative =
      deckNarrativeContext && deckNarrativeContext.trim().length > 0
        ? `Objetivo/tono narrativo del deck: ${deckNarrativeContext.trim()}\n\n`
        : "";
    const theme = presentationTopic.trim()
      ? `${narrative}Tema general de la presentación: ${presentationTopic.trim()}`
      : `${narrative}No hay tema global definido aún: infiere un enfoque coherente a partir de la instrucción.`;
    const draft =
      slideTitle.trim() || slideContent.trim()
        ? `Borrador o notas actuales en la diapositiva:\nTítulo actual: ${slideTitle || "(vacío)"}\nContenido o notas: ${slideContent || "(vacío)"}`
        : "La diapositiva está vacía: crea título y cuerpo desde cero según la instrucción.";

    return `${theme}

${draft}

Instrucción del usuario para ESTA diapositiva (una sola slide, no una presentación completa): ${userPrompt}

El campo 'content' debe ser markdown bien formateado: ${markdownUserReminder()}, no para encabezados del título principal de la slide.
Responde estrictamente en formato JSON con las propiedades 'title' y 'content'.`;
  },
};
