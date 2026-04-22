import type { PromptDefinition } from "../promptEngine/types";
import type { GenerateSlideDiagramInput } from "../promptEngine/types";
import { jsonStrictRulesText } from "../promptRules/json.rules";

const role =
  "Eres un experto en diagramas técnicos claros para presentaciones (arquitectura, flujos, secuencias).";
const task =
  "Responde ÚNICAMENTE un JSON válido con las claves: \"title\" (string, título del slide), \"content\" (string, notas breves opcionales para el presentador; puede ser vacío) y \"mermaid\" (string: definición Mermaid sin cercados markdown).";

function rules(): string {
  return jsonStrictRulesText();
}

export const generateSlideDiagramPrompt: PromptDefinition<GenerateSlideDiagramInput> = {
  role,
  task,
  rules,
  outputSchema:
    '{ title, content, mermaid } — mermaid debe ser sintaxis Mermaid válida (sin ``` ni prefijo "mermaid").',
  buildUserMessage(input) {
    const { presentationTopic, slideTitle, slideContent, userPrompt, deckNarrativeContext } =
      input;
    const narrative =
      deckNarrativeContext && deckNarrativeContext.trim().length > 0
        ? `Objetivo/tono narrativo del deck: ${deckNarrativeContext.trim()}\n\n`
        : "";
    const theme = presentationTopic.trim()
      ? `${narrative}Tema general de la presentación: ${presentationTopic.trim()}`
      : `${narrative}No hay tema global definido: infiere un enfoque coherente a partir de la instrucción.`;

    return `${theme}

Título actual del slide: ${slideTitle || "(vacío)"}
Notas o contexto actual (texto libre, puede estar vacío): ${slideContent || "(vacío)"}

Instrucción del usuario para el diagrama de ESTA diapositiva: ${userPrompt}

Requisitos para el campo "mermaid":
- Usa principalmente diagramas de flujo: empieza con "flowchart TD" o "flowchart LR" salvo que otro tipo encaje mejor (p. ej. sequenceDiagram para llamadas API).
- Mantén el diagrama legible: pocos nodos (idealmente menos de 20), etiquetas cortas, sin caracteres que rompan Mermaid.
- Conecta los nodos con flechas (-->, ---, etc.) de forma coherente.
- No incluyas bloques markdown ni la palabra mermaid fuera del JSON; el valor de "mermaid" es solo el código fuente del diagrama, con saltos de línea reales.
- Responde solo JSON válido con title, content y mermaid.`;
  },
};
