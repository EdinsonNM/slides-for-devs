import { MIN_SLIDES, MAX_SLIDES, DEFAULT_SLIDES } from "./constants";

/** Extrae número de diapositivas del tema si el usuario escribe "20 diapositivas" o "15 slides". */
export function parseRequestedSlideCountFromTopic(topic: string): number | null {
  const match = topic.match(/(\d+)\s*(diapositivas?|slides?)\b/i);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  return Math.min(MAX_SLIDES, Math.max(MIN_SLIDES, n));
}

/** System prompt para generación de presentaciones (OpenAI / xAI: mensaje system). */
export const PRESENTATION_SYSTEM = `Eres un experto en crear presentaciones. Genera siempre un JSON válido con un objeto que tenga una clave "slides" que sea un array de diapositivas.
Cada diapositiva tiene: id (string), type ("content" o "chapter"), title (string), content (string, markdown), imagePrompt (string, opcional), subtitle (string, opcional).
Las de tipo "chapter" tienen solo título impactante; las de tipo "content" tienen title, content en markdown e imagePrompt para ilustrar.
En el campo content (markdown) es OBLIGATORIO: para títulos o subtítulos de sección usa encabezados con numeral (# ## ###), por ejemplo "## Problemas Comunes" o "### Detalles"; no uses "* **Título:**" como subtítulo. Cada viñeta (* o -) y cada ítem numerado (1. 2. 3.) en su propia línea. Usa ** solo para destacar términos dentro de una línea, no para encabezados. Ejemplo: "## Sección\\n* **A:** texto\\n* **B:** texto".`;

/**
 * Construye el mensaje de usuario para interpretar cuántas diapositivas quiere el usuario.
 * Usado por Gemini, OpenAI y xAI.
 */
export function buildSlideCountUserMessage(topic: string): string {
  return `Mensaje del usuario para crear una presentación: "${topic}"

Interpreta cuántas diapositivas quiere. Ejemplos:
- "20 diapositivas" / "20 slides" → 20
- "unas 15" / "alrededor de 15" → 15
- "presentación larga" / "bien completa" → 20-25
- "cortita" / "breve" / "poca cosa" → 5-8
- "muchas" / "extensa" → 25-30
- Si no dice nada o no está claro → ${DEFAULT_SLIDES}

Responde ÚNICAMENTE con un número entero entre ${MIN_SLIDES} y ${MAX_SLIDES}, sin texto ni explicación.`;
}

/**
 * Instrucción de cantidad de diapositivas para el prompt de generación.
 */
export function buildCountInstruction(requestedCount: number): string {
  if (requestedCount !== DEFAULT_SLIDES) {
    return `IMPORTANTE: La presentación debe tener EXACTAMENTE ${requestedCount} diapositivas. Genera las ${requestedCount} diapositivas, ni más ni menos.`;
  }
  return "La presentación debe tener entre 8 y 12 diapositivas.";
}

/**
 * Mensaje de usuario para generar la presentación (compatible con OpenAI/xAI).
 * Para Gemini se usa contenido similar pero con formato de contents.
 */
export function buildPresentationUserMessage(
  topic: string,
  requestedCount: number
): string {
  const explicitCount = requestedCount !== DEFAULT_SLIDES;
  const countInstruction = buildCountInstruction(requestedCount);
  const countPart = explicitCount
    ? `exactamente ${requestedCount} elementos`
    : "entre 8 y 12 elementos";
  return `Genera una presentación profesional sobre: "${topic}".
${countInstruction}
Estructura: 1 diapositiva 'chapter' de título, luego diapositivas 'content' con title, content (markdown) e imagePrompt. Puedes usar más 'chapter' para separar secciones. Una 'content' de conclusión. El array "slides" debe contener ${countPart}.
En "content" usa encabezados con # ## ### para títulos/subtítulos de sección (no uses "* **Título:**" como subtítulo). Una viñeta o ítem numerado por línea.
Responde ÚNICAMENTE un JSON con esta forma: { "slides": [ { "id": "...", "type": "content"|"chapter", "title": "...", "content": "...", "imagePrompt": "..." }, ... ] }`;
}

/**
 * Contenido para Gemini (generateContent): texto único con instrucción de cantidad y estructura.
 */
export function buildGeminiPresentationContent(
  topic: string,
  requestedCount: number
): string {
  const explicitCount = requestedCount !== DEFAULT_SLIDES;
  const countInstruction = buildCountInstruction(requestedCount);
  return `Genera una presentación profesional y estructurada sobre el tema: "${topic}".
    ${countInstruction}
    Sigue esta estructura${explicitCount ? ` (total: exactamente ${requestedCount} diapositivas en el array)` : ""}:
    1. Una diapositiva de tipo 'chapter' para el título principal.
    2. Diapositivas de tipo 'content' para la introducción y puntos clave.
    3. Diapositivas de tipo 'chapter' para separar secciones temáticas si es necesario.
    4. Una diapositiva de tipo 'content' para la conclusión.
    ${explicitCount ? `Devuelve un array JSON con exactamente ${requestedCount} objetos de diapositivas.` : ""}
    
    Las diapositivas de tipo 'chapter' solo tienen un título central impactante.
    Las diapositivas de tipo 'content' tienen:
    - title: Un título claro.
    - content: Desarrollo en formato markdown. REGLAS ESTRICTAS para content:
      * Títulos y subtítulos de sección: usa encabezados markdown con numeral (# ## ###), NO asteriscos. Ejemplo: "## Problemas Comunes" o "### Detalles". # = nivel principal, ## = subtítulo, ### = sub-subtítulo.
      * Cada viñeta o elemento de lista debe ir en su propia línea (usa salto de línea \\n entre ítems).
      * Listas con asterisco: una línea por ítem, por ejemplo "\\n* **Punto 1**\\n* **Punto 2**". Usa ** solo para destacar términos dentro de una línea, no como sustituto de encabezados.
      * Sublistas numeradas: cada número en su propia línea, por ejemplo "\\n1. **Uno**\\n2. **Dos**".
      * No concatenes varios ítems en una sola línea. No uses "* **Título de sección:**" para subtítulos; usa "## Título de sección" o "### Título de sección".
    - imagePrompt: Una descripción detallada para generar una imagen artística o técnica que ilustre el contenido.
    
    Responde estrictamente en formato JSON.`;
}

export { MIN_SLIDES, MAX_SLIDES, DEFAULT_SLIDES };
