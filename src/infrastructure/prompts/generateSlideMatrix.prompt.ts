import type { PromptDefinition } from "../promptEngine/types";
import type { GenerateSlideMatrixInput } from "../promptEngine/types";
import { jsonStrictRulesText } from "../promptRules/json.rules";

const role =
  "Eres un experto en sintetizar información en tablas claras para presentaciones técnicas o de negocio.";
const task =
  "Responde ÚNICAMENTE un JSON válido con las claves: \"title\" (string), \"subtitle\" (string, puede ser vacío), \"content\" (string, notas breves opcionales en texto plano o markdown ligero), \"columnHeaders\" (array de strings) y \"rows\" (array de arrays de strings: cada fila misma longitud que columnHeaders).";

function rules(): string {
  return jsonStrictRulesText();
}

export const generateSlideMatrixPrompt: PromptDefinition<GenerateSlideMatrixInput> = {
  role,
  task,
  rules,
  outputSchema:
    "{ title, subtitle, content, columnHeaders: string[], rows: string[][] } — sin celdas nulas; usa \"\" si falta texto.",
  buildUserMessage(input) {
    const {
      presentationTopic,
      slideTitle,
      slideSubtitle,
      matrixJson,
      userPrompt,
      deckNarrativeContext,
    } = input;
    const narrative =
      deckNarrativeContext && deckNarrativeContext.trim().length > 0
        ? `Objetivo/tono narrativo del deck: ${deckNarrativeContext.trim()}\n\n`
        : "";
    const theme = presentationTopic.trim()
      ? `${narrative}Tema general de la presentación: ${presentationTopic.trim()}`
      : `${narrative}No hay tema global definido: infiere un enfoque coherente a partir de la instrucción.`;
    const ctx = `Título actual del slide: ${slideTitle || "(vacío)"}
Subtítulo actual: ${slideSubtitle || "(vacío)"}
Tabla o matriz actual (JSON, puede estar vacía o incompleta): ${matrixJson}`;

    return `${theme}

${ctx}

Instrucción del usuario para generar o rehacer la tabla/matriz de ESTA diapositiva: ${userPrompt}

Requisitos:
- columnHeaders: entre 2 y 8 columnas salvo que el usuario pida explícitamente otra cantidad razonable (máximo 12).
- rows: al menos 1 fila de datos; cada fila con exactamente len(columnHeaders) celdas.
- Texto conciso en celdas; sin saltos de línea dentro de una celda si es posible.
- Responde solo JSON válido con title, subtitle, content, columnHeaders y rows.`;
  },
};
