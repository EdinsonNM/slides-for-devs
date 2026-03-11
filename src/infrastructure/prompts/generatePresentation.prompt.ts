import type { PromptDefinition, GeneratePresentationInput } from "../promptEngine/types";
import { markdownContentRulesText, markdownUserReminder } from "../promptRules/markdown.rules";
import { jsonResponseRulesText } from "../promptRules/json.rules";
import { slideSchemaDescription, slidesArrayShapeDescription } from "../schemas/slide.schema";
import { presentationOutputDescription } from "../schemas/presentation.schema";
import { DEFAULT_SLIDES } from "./constants";

const role = "Eres un experto en crear presentaciones. Genera siempre un JSON válido con un objeto que tenga una clave \"slides\" que sea un array de diapositivas.";
const task = `${slideSchemaDescription}\n\n${presentationOutputDescription}`;

function rules(): string {
  return [markdownContentRulesText(), jsonResponseRulesText()].join("\n\n");
}

export const generatePresentationPrompt: PromptDefinition<GeneratePresentationInput> = {
  role,
  task,
  rules,
  outputSchema: `Forma del JSON: ${slidesArrayShapeDescription}`,
  buildUserMessage(input) {
    const { topic, slideCount, strictCount } = input;
    const explicit = strictCount ?? (slideCount !== DEFAULT_SLIDES);
    const countInstruction = explicit
      ? `IMPORTANTE: La presentación debe tener EXACTAMENTE ${slideCount} diapositivas. Genera las ${slideCount} diapositivas, ni más ni menos.`
      : "La presentación debe tener entre 8 y 12 diapositivas.";
    const countPart = explicit ? `exactamente ${slideCount} elementos` : "entre 8 y 12 elementos";
    return `Genera una presentación profesional sobre el tema indicado en los datos, con el número de diapositivas indicado.

Datos:
${JSON.stringify({ topic, slideCount, strictCount: !!explicit })}

${countInstruction}
Estructura: 1 diapositiva 'chapter' de título, luego diapositivas 'content' con title, content (markdown) e imagePrompt. Puedes usar más 'chapter' para separar secciones. Una 'content' de conclusión. El array "slides" debe contener ${countPart}.
${markdownUserReminder()}
Responde ÚNICAMENTE un JSON con esta forma: { "slides": [ { "id": "...", "type": "content"|"chapter", "title": "...", "content": "...", "imagePrompt": "..." }, ... ] }`;
  },
};
