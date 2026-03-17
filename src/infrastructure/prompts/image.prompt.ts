import type { PromptDefinition } from "../promptEngine/types";
import { imageCharacterDynamicRule, imageCharacterContextRule, imageProhibitions } from "../promptRules/image.rules";

/** Input para alternativas de imagen (con o sin personaje). */
export interface ImageAlternativesInput {
  slideContext: string;
  styleName: string;
  currentPrompt: string;
  hasCharacter: boolean;
  includeBackground: boolean;
}

const imageAlternativesRoleWithCharacter = "Tu respuesta se combina con el estilo de imagen ya elegido y con el personaje ya seleccionado. " + imageCharacterDynamicRule() + " " + imageCharacterContextRule() + " PROHIBIDO: estilo (minimalista, 3D, etc.), texto en la imagen. Responde solo el texto, sin comillas.";
const imageAlternativesRoleNoCharacter = "Tu respuesta se combina con el estilo de imagen ya elegido. No hay un personaje fijo seleccionado. Usa el título y la descripción del slide como referencia. DECIDE si la mejor imagen incluye personajes o no: si el tema lo pide (historia, cultura, personas), puede incluir personajes; si es técnico o conceptual, puede ser diagrama, iconos u objetos. " + imageProhibitions.join(" ") + " Responde solo el texto, sin comillas.";

export const imageAlternativesPrompt: PromptDefinition<ImageAlternativesInput> = {
  role: "Genera una descripción visual para la imagen del slide. Tu respuesta se combina con el estilo de imagen ya elegido.",
  task: "Responde ÚNICAMENTE el texto de la descripción, sin comillas ni explicaciones.",
  buildUserMessage(input) {
    const { slideContext, styleName, currentPrompt, hasCharacter, includeBackground } = input;
    const hasExisting = currentPrompt.trim().length > 0;
    const noBackgroundRule =
      !includeBackground
        ? "\n\nIMPORTANTE - SIN FONDO: El usuario eligió NO incluir fondo. La imagen será solo sobre fondo blanco. Describe ÚNICAMENTE el personaje o el concepto principal (pose, acción, objeto), SIN escenario: nada de mesa, oficina, laboratorio, monitores, estanterías, paredes ni elementos de fondo. Solo la figura o el elemento central."
        : "";
    const role = hasCharacter ? imageAlternativesRoleWithCharacter : imageAlternativesRoleNoCharacter;
    if (hasCharacter) {
      const alt = hasExisting
        ? `ALTERNATIVA DIFERENTE. No repitas: "${currentPrompt}". Propón otra acción o pose (el personaje haciendo algo distinto), manteniendo vestimenta/escenario acordes al contenido.`
        : "Genera una descripción: el personaje en una acción o pose dinámica (no estática), con vestimenta y accesorios acordes al contenido de la diapositiva (cultura, época, personaje histórico), posición y, si se permite fondo, escenario y elementos visibles (ej. caballos, entorno de la época).";
      return `${role}${noBackgroundRule}

CONTENIDO DE LA DIAPOSITIVA (tu descripción debe reflejar los conceptos clave del contenido, no solo el título):
---
${slideContext}
---
Tu texto se combina con el estilo "${styleName}". La escena que describas debe ilustrar ideas o conceptos del contenido de arriba.
${alt}
Responde ÚNICAMENTE el texto. Sin comillas.`;
    }
    const isDiagramStyle = /diagrama|Diagrama|sketch|hand-drawn|Excalidraw/i.test(styleName);
    const diagramEssenceRule =
      " Si es estilo diagrama: pide una composición SIMPLE (máximo 4-5 elementos), UN solo flujo (ej. cliente → servidor → base de datos), pocas flechas que no se crucen, y sin texto ni etiquetas en la imagen. La idea debe entenderse de un vistazo; no saturar ni hacer redes densas.";
    const alt = hasExisting
      ? `ALTERNATIVA DIFERENTE. No repitas: "${currentPrompt}". Propón otra representación visual del mismo tema.${isDiagramStyle ? " " + diagramEssenceRule : ""}`
      : `Genera la descripción visual que mejor ilustre el tema del slide (con o sin personajes según convenga). La imagen debe captar la ESENCIA del contenido y aportar valor.${isDiagramStyle ? " " + diagramEssenceRule : ""}`;
    return `${role}${noBackgroundRule}

CONTENIDO DE LA DIAPOSITIVA (tu descripción debe reflejar los conceptos clave del contenido, no solo el título):
---
${slideContext}
---
Tu respuesta se combina con el estilo "${styleName}". La escena que describas debe ilustrar ideas o conceptos del contenido de arriba.
${alt}
Responde ÚNICAMENTE el texto. Sin comillas. Sin explicaciones.`;
  },
};

/** Máximo de caracteres para el contexto del slide en el prompt de imagen (OpenAI DALL-E límite 4000). */
const MAX_SLIDE_CONTEXT_LENGTH = 1400;

/** Input para generación de imagen. */
export interface ImageGenerationInput {
  slideContext: string;
  userPrompt: string;
  stylePrompt: string;
  includeBackground: boolean;
  characterPrompt?: string;
  hasReferenceImage: boolean;
}

export const imageGenerationPrompt: PromptDefinition<ImageGenerationInput> = {
  role: "Genera una imagen que ilustre el contenido de la diapositiva. Si hay un personaje indicado (imagen adjunta o descripción), la imagen DEBE mostrar ÚNICAMENTE ese personaje, con la misma apariencia, en la escena descrita. No inventes ni añadas otros personajes.",
  task: "Produce el prompt final para el modelo de generación de imágenes.",
  buildUserMessage(input) {
    const { userPrompt, stylePrompt, includeBackground, characterPrompt, hasReferenceImage } = input;
    const slideContext =
      input.slideContext.length > MAX_SLIDE_CONTEXT_LENGTH
        ? input.slideContext.slice(0, MAX_SLIDE_CONTEXT_LENGTH - 3) + "..."
        : input.slideContext;
    const noText =
      "La imagen NO debe contener texto, leyendas ni etiquetas (evitar que aparezcan caracteres o palabras; solo formas e iconos).";
    const background = includeBackground ? "" : " Fondo blanco puro; solo el sujeto principal, sin escenario.";
    const hasCharacter = hasReferenceImage || (characterPrompt?.trim()?.length ?? 0) > 0;

    let characterBlock = "";
    if (hasCharacter) {
      if (hasReferenceImage) {
        characterBlock =
          "PERSONAJE: La imagen adjunta es la referencia. Esa figura DEBE aparecer tal cual (forma, colores, estilo). La escena indica QUÉ HACE o DÓNDE ESTÁ. Recrea la figura en otra pose; no sustituir por otro personaje.\n\n";
      }
      if (characterPrompt?.trim()) {
        const cp = characterPrompt.trim();
        const shortCp = cp.length > 280 ? cp.slice(0, 277) + "..." : cp;
        characterBlock += `PERSONAJE (único en escena, misma apariencia): "${shortCp}". Escena indicada abajo. No añadir otros personajes.\n\n`;
      }
    }

    const styleText = stylePrompt.trim();
    const isDiagramStyle = /diagrama|sketch|hand-drawn|excalidraw|flechas|conectores/i.test(styleText);
    const is2DStyle =
      /cartoon|2D|no 3D|ilustración|ilustracion|plano|vectorial|minimalista|diagrama|sketch|hand-drawn/i.test(
        styleText
      );
    const diagramRule = isDiagramStyle
      ? " CRÍTICO para estilo diagrama: (1) NO saturar: máximo 4-5 elementos en total (cajas, iconos, formas). (2) UN solo flujo legible (ej. izquierda a derecha o arriba abajo), pocas flechas y que NO se crucen. (3) Cero texto, cero etiquetas ni palabras en la imagen. (4) Composición minimalista: una idea clara que aporte valor al slide, no una red densa ni una maraña de conexiones."
      : "";
    const style = styleText
      ? `ESTILO: ${styleText}.${is2DStyle ? " 2D/ilustración, no 3D." : ""}${diagramRule}\n\n`
      : "";

    const contextRule = hasCharacter
      ? " Vestimenta, accesorios y escena del personaje deben reflejar el contenido (cultura, época, personaje histórico)."
      : "";

    const sceneBlock = `CONTENIDO DE LA DIAPOSITIVA:
---
${slideContext}
---
Ilustra los conceptos clave.${contextRule}

Escena a ilustrar: ${userPrompt}.`;

    const reminder = hasCharacter
      ? "\n\nPersonaje: no sustituir. Contextualizar vestimenta/escena al contenido. Estilo 2D si aplica."
      : styleText
        ? "\n\nEstilo visual: 2D si aplica, no 3D."
        : "";

    return `${characterBlock}${style}${sceneBlock}${background}
${noText}${reminder}`;
  },
};

/** Input para refinar descripción de personaje. */
export interface RefineCharacterInput {
  userDescription: string;
}

export const refineCharacterPrompt: PromptDefinition<RefineCharacterInput> = {
  role: "Eres un experto en crear prompts para generación de imágenes. El usuario quiere definir un personaje que se reutilizará en muchas escenas de presentaciones.",
  task: "Escribe UNA sola descripción en español, detallada y precisa, que sirva como prompt para generar SIEMPRE el mismo personaje en cualquier escena.",
  buildUserMessage(input) {
    return `Descripción que dio el usuario (puede ser breve o imprecisa):
---
${input.userDescription}
---

La descripción debe:
- Incluir forma del cuerpo y cabeza, colores, rasgos faciales, accesorios (mochila, ropa, etc.), estilo visual (cartoon, vectorial, 3D, etc.).
- Ser reutilizable: al usarla en distintos contextos el resultado debe ser el mismo personaje.
- NO pedir texto ni palabras en la imagen.
- Ser concisa pero completa (2-5 frases).

Responde ÚNICAMENTE la descripción refinada, sin comillas ni explicaciones.`;
  },
};

/** Sin input dinámico (solo instrucción fija). */
export const describeCharacterFromImagePrompt: PromptDefinition<Record<string, never>> = {
  role: "Describe en español el personaje que aparece en esta imagen. Tu respuesta se usará como prompt para generar SIEMPRE el mismo personaje en otras escenas.",
  task: "Incluye: forma del cuerpo y cabeza, proporciones, colores; rasgos faciales (ojos, expresión); accesorios o ropa visibles; estilo visual (cartoon, ilustración, 3D, etc.). Sé preciso y conciso (2-5 frases). No incluyas el fondo ni la escena, solo el personaje.",
  buildUserMessage: () => "Responde ÚNICAMENTE la descripción, sin comillas ni explicaciones.",
};
