import type { PromptDefinition, GeneratePresentationInput } from "../promptEngine/types";
import { markdownContentRulesText, markdownUserReminder } from "../promptRules/markdown.rules";
import { jsonResponseRulesText } from "../promptRules/json.rules";
import { slideSchemaDescription, slidesArrayShapeDescription } from "../schemas/slide.schema";
import { presentationOutputDescription } from "../schemas/presentation.schema";
import { DEFAULT_SLIDES } from "./constants";

const role =
  'Eres un experto en crear presentaciones. Genera siempre un JSON válido: un objeto con las claves "presentationTitle" (string) y "slides" (array de diapositivas).';

const task = `${slideSchemaDescription}\n\n${presentationOutputDescription}`;

function rules(): string {
  return [markdownContentRulesText(), jsonResponseRulesText()].join("\n\n");
}

export const generatePresentationPrompt: PromptDefinition<GeneratePresentationInput> = {
  role,
  task,
  rules,
  outputSchema: `Forma del JSON: objeto con "presentationTitle" (título corto de la presentación) y "slides" como ${slidesArrayShapeDescription}`,
  buildUserMessage(input) {
    const { topic, slideCount, strictCount, narrativeInstructions } = input;
    const explicit = strictCount ?? (slideCount !== DEFAULT_SLIDES);
    const countInstruction = explicit
      ? `IMPORTANTE: La presentación debe tener EXACTAMENTE ${slideCount} diapositivas. Genera las ${slideCount} diapositivas, ni más ni menos.`
      : "La presentación debe tener entre 8 y 12 diapositivas.";
    const countPart = explicit ? `exactamente ${slideCount} elementos` : "entre 8 y 12 elementos";
    const narrativeBlock =
      narrativeInstructions && narrativeInstructions.trim().length > 0
        ? `\n\nObjetivo y estilo narrativo del deck (respétalo al redactar títulos, secciones y tono):\n${narrativeInstructions.trim()}`
        : "";

    return `Genera una presentación profesional sobre el tema indicado en los datos, con el número de diapositivas indicado.

Datos:
${JSON.stringify({ topic, slideCount, strictCount: !!explicit })}${narrativeBlock}

${countInstruction}
Estructura: 1 diapositiva 'chapter' de título, luego diapositivas 'content' con title, content (markdown) e imagePrompt. Puedes usar más 'chapter' para separar secciones. Una 'content' de conclusión. El array "slides" debe contener ${countPart}.

El campo "presentationTitle" debe ser un título breve en español para la presentación (unas 3–12 palabras): descriptivo y profesional, **sin** copiar literalmente prompts largos ni pegar el brief completo del usuario.
${markdownUserReminder()}
Responde ÚNICAMENTE un JSON con esta forma: { "presentationTitle": "...", "slides": [ { "id": "...", "type": "content"|"chapter", "title": "...", "content": "...", "imagePrompt": "..." }, ... ] }`;
  },
};
