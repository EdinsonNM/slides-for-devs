import type { PromptDefinition } from "../promptEngine/types";
import type { SplitSlideInput } from "../promptEngine/types";
import { markdownContentRulesText, markdownUserReminder } from "../promptRules/markdown.rules";
import { jsonStrictRulesText } from "../promptRules/json.rules";

const role = "Eres un experto en estructurar presentaciones. Tu tarea es DIVIDIR una diapositiva en 2 o más según la instrucción del usuario, SEPARANDO el contenido existente sin reescribirlo ni ampliarlo.";
const task = "Responde ÚNICAMENTE un JSON válido con una clave \"slides\" cuyo valor es un array de objetos. Cada objeto: id (string), type (\"content\"), title (string), content (string, markdown), imagePrompt (string, opcional).";

function rules(): string {
  return [markdownContentRulesText(), jsonStrictRulesText()].join("\n\n");
}

function constraints(): string {
  return markdownUserReminder();
}

const splitRulesStrict = `REGLAS ESTRICTAS:
1. Mantén la esencia y el texto original: reparte el contenido entre las nuevas diapositivas conservando las frases, viñetas e ideas tal cual. No parafrasees, no expandas ni "mejores" el contenido.
2. Solo añade texto (por ejemplo una frase introductoria corta) si es estrictamente necesario para que una diapositiva quede coherente; en ese caso añade lo mínimo.
3. Cada diapositiva nueva debe tener un título que refleje su parte del contenido; el contenido debe ser exactamente la porción correspondiente del original, sin inventar puntos nuevos.
4. Formato markdown en cada 'content': ${markdownUserReminder()}`;

export const splitSlidePrompt: PromptDefinition<SplitSlideInput> = {
  role,
  task,
  rules,
  constraints: constraints(),
  outputSchema: "Array de objetos con id, type: \"content\", title, content, imagePrompt.",
  buildUserMessage(input) {
    const { slide, userPrompt } = input;
    return `El usuario quiere DIVIDIR esta diapositiva en 2 o más, según su instrucción.

Diapositiva original:
Título: ${slide.title}
Contenido: ${slide.content}

Instrucción del usuario (cómo quiere dividir): ${userPrompt}

${splitRulesStrict}
Responde estrictamente en formato JSON (array de objetos con id, type: "content", title, content, imagePrompt).`;
  },
};
