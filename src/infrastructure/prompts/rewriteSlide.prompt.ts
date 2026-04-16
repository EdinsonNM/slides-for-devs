import type { PromptDefinition } from "../promptEngine/types";
import type { RewriteSlideInput } from "../promptEngine/types";
import { markdownContentRulesText, markdownUserReminder } from "../promptRules/markdown.rules";
import { jsonStrictRulesText } from "../promptRules/json.rules";

const role = "Eres un experto en redactar contenido para presentaciones.";
const task = "Responde ÚNICAMENTE un JSON válido con exactamente dos claves: \"title\" (string) y \"content\" (string, markdown).";

function rules(): string {
  return [markdownContentRulesText(), jsonStrictRulesText()].join("\n\n");
}

export const rewriteSlidePrompt: PromptDefinition<RewriteSlideInput> = {
  role,
  task,
  rules,
  outputSchema: "Objeto JSON con propiedades 'title' y 'content'.",
  buildUserMessage(input) {
    const { slide, userPrompt, deckNarrativeContext } = input;
    const globalTone =
      deckNarrativeContext && deckNarrativeContext.trim().length > 0
        ? `Contexto de objetivo/tono de la presentación completa:\n${deckNarrativeContext.trim()}\n\n`
        : "";
    return `${globalTone}Reescribe el contenido de esta diapositiva según la instrucción del usuario.
Diapositiva original:
Título: ${slide.title}
Contenido: ${slide.content}

Instrucción del usuario: ${userPrompt}

El campo 'content' debe ser markdown bien formateado: ${markdownUserReminder()}, no para encabezados.
Responde estrictamente en formato JSON con las propiedades 'title' y 'content'.`;
  },
};
