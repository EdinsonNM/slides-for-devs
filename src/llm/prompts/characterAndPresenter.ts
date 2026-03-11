import type { Slide } from "../../types";

/** Prompt para refinar la descripción del personaje (Gemini). */
export function buildRefineCharacterPrompt(userDescription: string): string {
  return `Eres un experto en crear prompts para generación de imágenes. El usuario quiere definir un personaje que se reutilizará en muchas escenas de presentaciones.

Descripción que dio el usuario (puede ser breve o imprecisa):
---
${userDescription}
---

Tu tarea: escribe UNA sola descripción en español, detallada y precisa, que sirva como prompt para generar SIEMPRE el mismo personaje en cualquier escena. La descripción debe:
- Incluir forma del cuerpo y cabeza, colores, rasgos faciales, accesorios (mochila, ropa, etc.), estilo visual (cartoon, vectorial, 3D, etc.).
- Ser reutilizable: al usarla en distintos contextos ("el personaje señalando", "el personaje con pulgar arriba") el resultado debe ser el mismo personaje.
- NO pedir texto ni palabras en la imagen.
- Ser concisa pero completa (2-5 frases).

Responde ÚNICAMENTE la descripción refinada, sin comillas ni explicaciones.`;
}

/** Prompt para describir personaje desde imagen (Gemini visión). */
export const DESCRIBE_CHARACTER_FROM_IMAGE = `Describe en español el personaje que aparece en esta imagen. Tu respuesta se usará como prompt para generar SIEMPRE el mismo personaje en otras escenas. Incluye:
- Forma del cuerpo y cabeza, proporciones, colores.
- Rasgos faciales (ojos, expresión).
- Accesorios o ropa visibles.
- Estilo visual (cartoon, ilustración, 3D, etc.).
Sé preciso y conciso (2-5 frases). No incluyas el fondo ni la escena, solo el personaje. Responde ÚNICAMENTE la descripción, sin comillas ni explicaciones.`;

/** Genera notas del presentador para una diapositiva. */
export function buildPresenterNotesPrompt(slide: Slide): string {
  return `Genera notas breves para el presentador de esta diapositiva. Incluye puntos clave a recordar, transiciones sugeridas y datos o frases que no deben olvidarse. Sé conciso (2-4 líneas).
Título: ${slide.title}
Contenido: ${slide.content}
Responde solo el texto de las notas, sin título ni formato adicional.`;
}

/** Genera guion/speech para una diapositiva. */
export function buildSpeechForSlidePrompt(slide: Slide, customPrompt?: string): string {
  const instruction = customPrompt?.trim()
    ? `Instrucción adicional del presentador: ${customPrompt}.`
    : "Genera un guion natural y conciso que un presentador podría decir al mostrar esta diapositiva (2-5 frases).";
  return `Diapositiva:
Título: ${slide.title}
Contenido: ${slide.content}
${instruction}
Responde solo el texto del guion, sin etiquetas.`;
}

/** Refina notas del presentador. */
export function buildRefinePresenterNotesPrompt(
  slide: Slide,
  currentNotes: string
): string {
  return `Refina y mejora el siguiente texto de notas para el presentador. Mantén el mismo contenido y sentido, pero mejora la claridad, el tono y la estructura. No añadas contenido nuevo que no esté implícito.
Contexto de la diapositiva - Título: ${slide.title}. Contenido (resumen): ${slide.content.slice(0, 300)}...
Texto actual del presentador:
${currentNotes}
Responde solo el texto refinado, sin explicaciones ni etiquetas.`;
}

/** Genera código para el slide. */
export function buildCodeForSlidePrompt(
  slide: Slide,
  language: string,
  customPrompt?: string
): string {
  const context = `Título: ${slide.title}\nContenido: ${slide.content}`;
  const instruction = customPrompt?.trim()
    ? `Instrucción adicional del usuario: ${customPrompt}.`
    : "Genera código de ejemplo breve y claro que ilustre el concepto de esta diapositiva. Solo el código, sin explicaciones alrededor.";
  return `Eres un experto en programación. Genera código de ejemplo para una diapositiva de presentación.

Contexto de la diapositiva:
---
${context}
---

Lenguaje de programación: ${language}.
${instruction}

Responde ÚNICAMENTE con el bloque de código, sin markdown (sin \`\`\`), sin explicaciones antes ni después. El código debe ser conciso, correcto y fácil de leer en una slide.`;
}

/** Chat del presentador (contexto tema + slide actual). */
export function buildPresenterChatPrompt(
  topic: string,
  currentSlideTitle: string,
  currentSlideContent: string,
  userMessage: string
): string {
  return `Eres un asistente durante una presentación. El tema de la presentación es: "${topic}". La diapositiva actual tiene título: "${currentSlideTitle}" y contenido: ${currentSlideContent.slice(0, 500)}.

El presentador o alguien del público hace la siguiente pregunta o pide que ahondes en el tema:
"${userMessage}"

Responde de forma clara y concisa. Si incluyes código, formátalo en bloques markdown con la sintaxis correcta (por ejemplo \`\`\`javascript ... \`\`\`). Usa listas, negritas y párrafos cuando ayude. Responde solo el contenido útil, sin preámbulos tipo "Claro, ..." a menos que sea natural.`;
}
