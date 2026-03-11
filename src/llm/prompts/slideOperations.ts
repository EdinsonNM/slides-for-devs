import type { Slide } from "../../types";

/** System prompt para dividir una diapositiva en varias (OpenAI). */
export const SPLIT_SLIDE_SYSTEM = `Eres un experto en estructurar presentaciones. Tu tarea es DIVIDIR una diapositiva en 2 o más según la instrucción del usuario, SEPARANDO el contenido existente sin reescribirlo ni ampliarlo.
Responde ÚNICAMENTE un JSON válido con una clave "slides" cuyo valor es un array de objetos. Cada objeto: id (string), type ("content"), title (string), content (string, markdown), imagePrompt (string, opcional).
En content usa encabezados con # ## ### para subtítulos; cada viñeta (* o -) y cada ítem numerado (1. 2. 3.) en su propia línea. Usa ** solo para énfasis dentro de una línea.`;

/** Mensaje de usuario para split slide (compartido entre Gemini y OpenAI). */
export function buildSplitSlideUserMessage(slide: Slide, prompt: string): string {
  return `El usuario quiere DIVIDIR esta diapositiva en 2 o más, según su instrucción.

Diapositiva original:
Título: ${slide.title}
Contenido: ${slide.content}

Instrucción del usuario (cómo quiere dividir): ${prompt}

REGLAS ESTRICTAS:
1. Mantén la esencia y el texto original: reparte el contenido entre las nuevas diapositivas conservando las frases, viñetas e ideas tal cual. No parafrasees, no expandas ni "mejores" el contenido.
2. Solo añade texto (por ejemplo una frase introductoria corta) si es estrictamente necesario para que una diapositiva quede coherente; en ese caso añade lo mínimo.
3. Cada diapositiva nueva debe tener un título que refleje su parte del contenido; el contenido debe ser exactamente la porción correspondiente del original, sin inventar puntos nuevos.
4. Formato markdown en cada 'content': encabezados con # ## ### para subtítulos; cada viñeta (* o -) y cada ítem numerado (1. 2. 3.) en su propia línea. Usa ** solo para énfasis dentro de una línea.
Responde estrictamente en formato JSON (array de objetos con id, type: "content", title, content, imagePrompt).`;
}

/** System prompt para reescribir una diapositiva (OpenAI). */
export const REWRITE_SLIDE_SYSTEM = `Eres un experto en redactar contenido para presentaciones. Responde ÚNICAMENTE un JSON válido con exactamente dos claves: "title" (string) y "content" (string, markdown).
En content usa encabezados con # ## ### para títulos/subtítulos de sección; cada viñeta (* o -) y cada ítem numerado (1. 2. 3.) en su propia línea. Usa ** solo para destacar términos dentro de una línea.`;

/** Mensaje de usuario para rewrite slide (compartido). */
export function buildRewriteSlideUserMessage(slide: Slide, prompt: string): string {
  return `Reescribe el contenido de esta diapositiva según la instrucción del usuario.
Diapositiva original:
Título: ${slide.title}
Contenido: ${slide.content}

Instrucción del usuario: ${prompt}

El campo 'content' debe ser markdown bien formateado: para títulos o subtítulos de sección usa encabezados con numeral (# ## ###), por ejemplo "## Problemas Comunes" o "### Detalles"; no uses "* **Título:**" como subtítulo. Cada viñeta (* o -) y cada ítem numerado (1. 2. 3.) en su propia línea. Usa ** solo para destacar términos dentro de una línea, no para encabezados.
Responde estrictamente en formato JSON con las propiedades 'title' y 'content'.`;
}
