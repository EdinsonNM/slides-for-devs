/**
 * Regla obligatoria: la imagen no debe contener texto.
 * Español para Gemini; inglés para OpenAI se puede construir en el proveedor.
 */
export const IMAGE_NO_TEXT_RULE_ES =
  "REGLA OBLIGATORIA: La imagen NO debe contener ningún texto, leyendas, etiquetas, palabras ni caracteres. Solo elementos puramente visuales e ilustrativos.";

export const IMAGE_NO_TEXT_RULE_EN =
  "The image must NOT contain any text, labels, words or characters. Only purely visual elements.";

/**
 * Regla de fondo blanco (cuando includeBackground es false).
 */
export function buildBackgroundRule(includeBackground: boolean, lang: "es" | "en"): string {
  if (includeBackground) return "";
  if (lang === "es") {
    return " La imagen debe mostrarse con fondo blanco puro únicamente: solo el sujeto o concepto principal sobre fondo blanco, sin transparencia, sin escenario ni elementos de fondo. Ignora cualquier indicación de fondo en el estilo.";
  }
  return " CRITICAL: The image MUST have a pure white background only. No scenery, no environment, no landscape, no sky, no floor, no shadows on the ground, no background objects. Just the main subject on solid white. Ignore any background suggestion in the style or context.";
}

/**
 * Prefijo de personaje para el prompt de imagen (mismo diseño, otra pose/acción).
 */
export function buildCharacterPrefix(
  characterPrompt: string | undefined,
  hasReferenceImage: boolean,
  lang: "es" | "en"
): string {
  if (!characterPrompt?.trim()) return "";
  if (lang === "es") {
    return hasReferenceImage
      ? ""
      : `CRÍTICO - Mismo personaje (apariencia y estilo) pero en una POSE o ACCIÓN NUEVA cada vez (señalando, sorprendido, enseñando, etc.). No repitas la misma pose: ${characterPrompt.trim()}. `;
  }
  return `CRITICAL - Same character design (match this description) but in a DIFFERENT pose or action each time (pointing, surprised, teaching, sitting, etc.). Do NOT copy the reference pose; keep the character dynamic. ${characterPrompt.trim()}. `;
}

/** Instrucción cuando hay imagen de referencia (personaje). */
export const IMAGE_REFERENCE_INSTRUCTION_ES =
  "La imagen adjunta es el personaje de referencia. Mantén su DISEÑO (apariencia, proporciones, colores, estilo) pero muéstralo en una POSE o ACCIÓN DIFERENTE: puede estar señalando, sorprendido, sentado, explicando, enseñando, etc. NO copies la pose de la imagen de referencia; el personaje debe ser dinámico y adaptarse a la escena. ";

/**
 * Construye el prompt completo para generación de imagen (texto único para el modelo).
 */
export function buildImageGenerationPrompt(params: {
  slideContext: string;
  userPrompt: string;
  stylePrompt: string;
  includeBackground: boolean;
  characterPrompt?: string;
  hasReferenceImage: boolean;
  referenceInstruction: string;
  lang: "es" | "en";
}): string {
  const {
    slideContext,
    userPrompt,
    stylePrompt,
    includeBackground,
    characterPrompt,
    hasReferenceImage,
    referenceInstruction,
    lang,
  } = params;
  const noTextRule = lang === "es" ? IMAGE_NO_TEXT_RULE_ES : IMAGE_NO_TEXT_RULE_EN;
  const backgroundRule = buildBackgroundRule(includeBackground, lang);
  const characterPrefix = buildCharacterPrefix(characterPrompt, hasReferenceImage, lang);
  const styleMandatory =
    stylePrompt.trim() !== ""
      ? (lang === "es"
          ? `OBLIGATORIO - ESTILO VISUAL (prioridad máxima): ${stylePrompt.trim()}. La imagen entera debe respetar este estilo. Si el estilo indica 2D, ilustración o cartoon, NO generes render 3D ni realismo fotográfico. `
          : `CRITICAL - Visual style (highest priority, apply to the entire image): ${stylePrompt.trim()}. If the style says 2D, cartoon or illustration, do NOT generate 3D render or photorealistic style. `)
      : "";
  const styleReminder =
    stylePrompt.trim() !== "" || characterPrompt?.trim()
      ? (lang === "es"
          ? " RECUERDA: Respeta estrictamente el estilo visual y la descripción del personaje indicados. No uses 3D ni realismo si se ha pedido 2D o ilustración."
          : " REMINDER: Strictly follow the visual style and character description above. Do not use 3D or realism if 2D or illustration was requested.")
      : "";
  const body =
    lang === "es"
      ? `Contexto de la diapositiva: ${slideContext}.\nEscena o detalles a ilustrar: ${userPrompt}.\nEstilo visual (aplicar a toda la imagen): ${stylePrompt || "coherente con lo anterior"}.`
      : `Slide context: ${slideContext}.\nScene or details to illustrate: ${userPrompt}.\nVisual style (apply to entire image): ${stylePrompt || "consistent with the above"}.`;
  return `${styleMandatory}${referenceInstruction}${characterPrefix}${body}
${backgroundRule}
${noTextRule}${styleReminder}`;
}

/** System prompt para alternativas de prompt de imagen CON personaje. */
export const IMAGE_ALTERNATIVES_SYSTEM_WITH_CHARACTER = `Tu respuesta se combina con el estilo de imagen ya elegido y con el personaje ya seleccionado. El personaje debe ser DINÁMICO: otra pose, otra acción (señalando, sorprendido, enseñando, etc.), no la misma postura de referencia. NO incluyas estilo visual ni apariencia del personaje. DESCRIBE SOLO: qué hace el personaje (acción distinta), postura, posición, escenario, otros elementos. PROHIBIDO: estilo (minimalista, 3D, etc.), apariencia del personaje, texto en la imagen. Responde solo el texto, sin comillas.`;

/** System prompt para alternativas de prompt de imagen SIN personaje. */
export const IMAGE_ALTERNATIVES_SYSTEM_NO_CHARACTER = `Tu respuesta se combina con el estilo de imagen ya elegido. No hay un personaje fijo seleccionado. Usa el título y la descripción del slide como referencia. DECIDE si la mejor imagen incluye personajes o no: si el tema lo pide (historia, cultura, personas como los incas), puede incluir personajes; si es técnico o conceptual, puede ser diagrama, iconos u objetos. Lo importante es que la descripción sea la mejor opción visual para el tema del slide. PROHIBIDO: estilo visual (minimalista, 3D, etc.) en tu texto; texto o palabras dentro de la imagen. Responde solo el texto, sin comillas.`;

/**
 * Mensaje de usuario para generar alternativa de prompt CON personaje.
 */
export function buildImageAlternativesUserMessageWithCharacter(
  slideContext: string,
  styleName: string,
  currentPrompt: string
): string {
  const hasExisting = currentPrompt.trim().length > 0;
  return `CONTEXTO DE LA DIAPOSITIVA (para entender el tema):
---
${slideContext}
---
Hay un personaje ya seleccionado. El personaje debe ser DINÁMICO: otra pose, otra acción (señalando, sorprendido, enseñando, sentado, etc.), no la misma postura de la referencia. Tu texto se combina con el estilo "${styleName}". NO describas la apariencia del personaje. DESCRIBE SOLO (en español): qué hace el personaje (acción distinta), postura, posición en la escena, escenario, otros elementos. PROHIBIDO: estilo visual (minimalista, 3D, etc.), apariencia del personaje, texto en la imagen.
${
  hasExisting
    ? `ALTERNATIVA DIFERENTE. No repitas: "${currentPrompt}". Propón otra acción o pose (el personaje haciendo algo distinto).`
    : "Genera una descripción: el personaje en una acción o pose dinámica (no estática), posición, escenario y elementos visibles."
}
Responde ÚNICAMENTE el texto. Sin comillas.`;
}

/**
 * Mensaje de usuario para generar alternativa de prompt SIN personaje.
 */
export function buildImageAlternativesUserMessageNoCharacter(
  slideContext: string,
  styleName: string,
  currentPrompt: string
): string {
  const hasExisting = currentPrompt.trim().length > 0;
  return `REFERENCIA - TÍTULO Y DESCRIPCIÓN DEL SLIDE (la imagen debe ilustrar este contenido):
---
${slideContext}
---
No hay un personaje fijo seleccionado. Toma como referencia el título y la descripción del slide. DECIDE TÚ qué representa mejor el contenido: si el tema lo pide (historia, cultura, personas como los incas, un relato), la imagen puede incluir personajes o figuras; si es técnico o conceptual (p. ej. métodos HTTP, arquitectura), puede ser un diagrama, iconos, objetos o escena sin personas. Lo importante es que la descripción esté alineada al slide y sea la mejor opción visual para su tema.
Tu respuesta se combina con el estilo "${styleName}". PROHIBIDO: estilo visual (minimalista, 3D, etc.) en tu texto; texto o palabras dentro de la imagen.
${
  hasExisting
    ? `ALTERNATIVA DIFERENTE. No repitas: "${currentPrompt}". Propón otra representación visual del mismo tema (otra escena, otros elementos, otra metáfora).`
    : "Genera la descripción visual que mejor ilustre el tema del slide (con o sin personajes según convenga)."
}
Responde ÚNICAMENTE el texto. Sin comillas. Sin explicaciones.`;
}
