import { GoogleGenAI, Type } from "@google/genai";
import { Slide } from "../types";
import { getGeminiApiKey } from "./apiConfig";

const MIN_SLIDES = 3;
const MAX_SLIDES = 50;
const DEFAULT_SLIDES = 10;

function getClient(): GoogleGenAI {
  const key = getGeminiApiKey();
  if (!key) {
    throw new Error(
      "No hay API key de Gemini configurada. Configura al menos una API en la pantalla de inicio."
    );
  }
  return new GoogleGenAI({ apiKey: key });
}

/**
 * Pide al modelo que interprete cuántas diapositivas quiere el usuario.
 * Acepta frases como "unas 20", "presentación larga", "cortita", "alrededor de 15", etc.
 */
async function parseRequestedSlideCountGemini(
  topic: string,
  model: string
): Promise<number> {
  const client = getClient();
  const res = await client.models.generateContent({
    model: model || "gemini-2.5-flash",
    contents: `Mensaje del usuario para crear una presentación: "${topic}"

Interpreta cuántas diapositivas quiere. Ejemplos:
- "20 diapositivas" / "20 slides" → 20
- "unas 15" / "alrededor de 15" → 15
- "presentación larga" / "bien completa" → 20-25
- "cortita" / "breve" / "poca cosa" → 5-8
- "muchas" / "extensa" → 25-30
- Si no dice nada o no está claro → 10

Responde ÚNICAMENTE con un número entero entre ${MIN_SLIDES} y ${MAX_SLIDES}, sin texto ni explicación.`,
  });
  const text = (res.text || "").trim();
  const numMatch = text.match(/\d+/);
  if (!numMatch) return DEFAULT_SLIDES;
  const n = parseInt(numMatch[0], 10);
  return Math.min(MAX_SLIDES, Math.max(MIN_SLIDES, n));
}

export async function generatePresentation(
  topic: string,
  model: string = "gemini-2.5-flash"
): Promise<Slide[]> {
  // 1) Regex por si dice "20 diapositivas" o "20 slides"
  const slideCountMatch = topic.match(/(\d+)\s*(diapositivas?|slides?)\b/i);
  let requestedCount: number;
  if (slideCountMatch) {
    requestedCount = Math.min(MAX_SLIDES, Math.max(MIN_SLIDES, parseInt(slideCountMatch[1], 10)));
  } else {
    requestedCount = await parseRequestedSlideCountGemini(topic, model);
  }
  const countInstruction =
    requestedCount !== DEFAULT_SLIDES
      ? `IMPORTANTE: La presentación debe tener EXACTAMENTE ${requestedCount} diapositivas. Genera las ${requestedCount} diapositivas, ni más ni menos.`
      : `La presentación debe tener entre 8 y 12 diapositivas.`;

  const explicitCount = requestedCount !== DEFAULT_SLIDES;

  const response = await getClient().models.generateContent({
    model: model || "gemini-2.5-flash",
    contents: `Genera una presentación profesional y estructurada sobre el tema: "${topic}". 
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
    
    Responde estrictamente en formato JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            type: { type: Type.STRING, enum: ["content", "chapter"] },
            title: { type: Type.STRING },
            subtitle: { type: Type.STRING },
            content: { type: Type.STRING },
            imagePrompt: {
              type: Type.STRING,
              description: "Sugerencia de prompt para generar una imagen",
            },
          },
          required: ["id", "type", "title", "content"],
        },
      },
    },
  });

  const text = response.text || "[]";
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  const jsonStr = jsonMatch ? jsonMatch[0] : text;

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Failed to parse JSON:", text);
    return [];
  }
}

const DEFAULT_IMAGE_MODEL = "gemini-2.5-flash-image";

export async function generateImage(
  slideContext: string,
  userPrompt: string,
  stylePrompt: string = "",
  includeBackground: boolean = true,
  model: string = DEFAULT_IMAGE_MODEL,
  characterPrompt?: string,
  characterReferenceImageDataUrl?: string
): Promise<string | undefined> {
  const noTextRule =
    "REGLA OBLIGATORIA: La imagen NO debe contener ningún texto, leyendas, etiquetas, palabras ni caracteres. Solo elementos puramente visuales e ilustrativos.";
  const backgroundRule = includeBackground
    ? ""
    : " La imagen debe mostrarse con fondo blanco puro únicamente: solo el sujeto o concepto principal sobre fondo blanco, sin transparencia, sin escenario ni elementos de fondo. Ignora cualquier indicación de fondo en el estilo.";

  const parsedReference = characterReferenceImageDataUrl?.trim()
    ? parseImageDataUrl(characterReferenceImageDataUrl)
    : null;
  const hasReference = !!parsedReference;
  const referenceInstruction = hasReference
    ? "La imagen adjunta es el personaje de referencia. Genera una nueva imagen mostrando EXACTAMENTE este mismo personaje (misma apariencia, proporciones, colores, estilo) en la siguiente escena. Mantén al personaje idéntico. "
    : "";
  const characterPrefixText = characterPrompt?.trim()
    ? hasReference
      ? ""
      : `CRÍTICO - Personaje idéntico en todas las escenas (no cambies su apariencia): ${characterPrompt.trim()}. Repite exactamente este mismo personaje en la escena siguiente. `
    : "";
  const fullPrompt = `${referenceInstruction}${characterPrefixText}Contexto de la diapositiva: ${slideContext}. 
  Características adicionales solicitadas: ${userPrompt}. 
  Estilo visual: ${stylePrompt}.${backgroundRule}
  ${noTextRule}`;

  const contents = hasReference && parsedReference
    ? [
        {
          parts: [
            { inlineData: { mimeType: parsedReference.mimeType, data: parsedReference.data } },
            { text: fullPrompt },
          ],
        },
      ]
    : { parts: [{ text: fullPrompt }] };

  const response = await getClient().models.generateContent({
    model: model || DEFAULT_IMAGE_MODEL,
    contents,
    config: {
      imageConfig: {
        aspectRatio: "1:1",
      },
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return undefined;
}

const DEFAULT_TEXT_MODEL = "gemini-2.5-flash";

/** Genera una alternativa de prompt para imagen considerando estilo y contexto del slide actual */
export async function generateImagePromptAlternatives(
  slideContext: string,
  currentPrompt: string,
  styleName: string,
  stylePrompt: string,
  model: string = DEFAULT_TEXT_MODEL,
  characterPrompt?: string
): Promise<string> {
  const hasExistingPrompt = currentPrompt.trim().length > 0;
  const characterInstruction = characterPrompt?.trim()
    ? `\nLa escena debe incluir siempre el mismo personaje, descrito así: ${characterPrompt.trim()}. Tu descripción debe ser coherente con este personaje (mismas acciones, escenario y situación, sin repetir su apariencia).\n`
    : "";
  const response = await getClient().models.generateContent({
    model: model || DEFAULT_TEXT_MODEL,
    contents: `Eres un experto en crear prompts para imágenes. Genera UNA descripción en español para una imagen que ilustre ESTA diapositiva.
${characterInstruction}
PROHIBIDO: La imagen NO debe contener ningún texto: ni títulos del slide, ni palabras, ni etiquetas, ni leyendas, ni números ni caracteres. Solo elementos puramente visuales. Tu prompt NUNCA debe pedir o describir que aparezca texto en la imagen.

REGLA PRINCIPAL: La imagen debe representar el TEMA CONCRETO de la diapositiva (título y contenido) de forma visual: escena, metáfora, objetos o personajes que transmitan el concepto. Extrae el concepto clave y dibuja ESA idea en la escena, sin escribir nada. No uses escenas genéricas (consolas, cubos que se transforman, arcos de energía) a menos que el contenido de la diapositiva hable de eso.

Contenido de la diapositiva (título y texto) — úsalo solo para entender el tema, NO para copiar texto en la imagen:
---
${slideContext}
---

Estilo visual a usar: "${styleName}" (${stylePrompt})

MUY IMPORTANTE: No describas el estilo visual ni la forma del personaje (por ejemplo \"stickman\", \"3D\", \"minimalista\", \"realista\", \"ilustración vectorial\", etc.). Eso ya está definido por el estilo visual anterior y se añadirá aparte. Tu descripción debe centrarse SOLO en:
- el escenario o lugar donde ocurre la escena,
- la acción de los personajes,
- los objetos o elementos que aparecen y cómo se relacionan entre sí.

${
  hasExistingPrompt
    ? `El usuario ya tiene esta sugerencia y ha pedido OTRA alternativa. Genera una idea DIFERENTE: otra escena, otro momento o otro enfoque visual para el mismo tema de la diapositiva. No repitas personajes en consola, cubos/esferas ni arcos de energía a menos que el tema del slide lo exija. Prompt actual (evita algo parecido): ${currentPrompt}`
    : "Genera una descripción visual concreta que ilustre el tema de esta diapositiva en el estilo indicado."
}

Responde ÚNICAMENTE el texto del prompt, sin comillas ni explicaciones. El prompt debe describir solo elementos visuales, escenarios, acciones y objetos; no expliques estilos de dibujo ni pidas texto (por ejemplo, evita frases como "con el título...", "mostrando el texto...", "con la leyenda...", "texto sobre la pantalla", etc.).`,
  });
  return (response.text || "").trim();
}

/** Refina la descripción del usuario en un prompt preciso y reutilizable para generar siempre el mismo personaje. */
export async function refineCharacterPrompt(
  userDescription: string,
  model: string = DEFAULT_TEXT_MODEL
): Promise<string> {
  const response = await getClient().models.generateContent({
    model: model || DEFAULT_TEXT_MODEL,
    contents: `Eres un experto en crear prompts para generación de imágenes. El usuario quiere definir un personaje que se reutilizará en muchas escenas de presentaciones.

Descripción que dio el usuario (puede ser breve o imprecisa):
---
${userDescription}
---

Tu tarea: escribe UNA sola descripción en español, detallada y precisa, que sirva como prompt para generar SIEMPRE el mismo personaje en cualquier escena. La descripción debe:
- Incluir forma del cuerpo y cabeza, colores, rasgos faciales, accesorios (mochila, ropa, etc.), estilo visual (cartoon, vectorial, 3D, etc.).
- Ser reutilizable: al usarla en distintos contextos ("el personaje señalando", "el personaje con pulgar arriba") el resultado debe ser el mismo personaje.
- NO pedir texto ni palabras en la imagen.
- Ser concisa pero completa (2-5 frases).

Responde ÚNICAMENTE la descripción refinada, sin comillas ni explicaciones.`,
  });
  return (response.text || "").trim();
}

/** Extrae base64 y mimeType de un data URL de imagen. */
function parseImageDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const match = dataUrl.match(/^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/i);
  if (!match) return null;
  const mimeType = match[1].toLowerCase().replace("jpg", "jpeg");
  return { mimeType, data: match[3] };
}

/** Describe el personaje de una imagen de referencia para obtener un prompt reutilizable (requiere Gemini con visión). */
export async function describeCharacterFromImage(
  imageDataUrl: string,
  model: string = DEFAULT_TEXT_MODEL
): Promise<string> {
  const parsed = parseImageDataUrl(imageDataUrl);
  if (!parsed) throw new Error("Formato de imagen no válido. Usa PNG, JPEG o WebP.");

  const response = await getClient().models.generateContent({
    model: model || DEFAULT_TEXT_MODEL,
    contents: [
      {
        parts: [
          { inlineData: { mimeType: parsed.mimeType, data: parsed.data } },
          {
            text: `Describe en español el personaje que aparece en esta imagen. Tu respuesta se usará como prompt para generar SIEMPRE el mismo personaje en otras escenas. Incluye:
- Forma del cuerpo y cabeza, proporciones, colores.
- Rasgos faciales (ojos, expresión).
- Accesorios o ropa visibles.
- Estilo visual (cartoon, ilustración, 3D, etc.).
Sé preciso y conciso (2-5 frases). No incluyas el fondo ni la escena, solo el personaje. Responde ÚNICAMENTE la descripción, sin comillas ni explicaciones.`,
          },
        ],
      },
    ],
  });
  return (response.text || "").trim();
}

export async function splitSlide(
  slide: Slide,
  prompt: string,
  model: string = DEFAULT_TEXT_MODEL
): Promise<Slide[]> {
  const response = await getClient().models.generateContent({
    model: model || DEFAULT_TEXT_MODEL,
    contents: `El usuario quiere DIVIDIR esta diapositiva en 2 o más, según su instrucción. Tu tarea es SEPARAR el contenido existente, no reescribirlo ni ampliarlo.

Diapositiva original:
Título: ${slide.title}
Contenido: ${slide.content}

Instrucción del usuario (cómo quiere dividir): ${prompt}

REGLAS ESTRICTAS:
1. Mantén la esencia y el texto original: reparte el contenido entre las nuevas diapositivas conservando las frases, viñetas e ideas tal cual. No parafrasees, no expandas ni "mejores" el contenido.
2. Solo añade texto (por ejemplo una frase introductoria corta) si es estrictamente necesario para que una diapositiva quede coherente; en ese caso añade lo mínimo.
3. Cada diapositiva nueva debe tener un título que refleje su parte del contenido; el contenido debe ser exactamente la porción correspondiente del original, sin inventar puntos nuevos.
4. Formato markdown en cada 'content': encabezados con # ## ### para subtítulos; cada viñeta (* o -) y cada ítem numerado (1. 2. 3.) en su propia línea. Usa ** solo para énfasis dentro de una línea.
Responde estrictamente en formato JSON (array de objetos con id, type: "content", title, content, imagePrompt).`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            type: { type: Type.STRING, enum: ["content"] },
            title: { type: Type.STRING },
            content: { type: Type.STRING },
            imagePrompt: { type: Type.STRING },
          },
          required: ["id", "type", "title", "content"],
        },
      },
    },
  });

  const text = response.text || "[]";
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  const jsonStr = jsonMatch ? jsonMatch[0] : text;

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Failed to parse JSON:", text);
    return [];
  }
}

export async function rewriteSlide(
  slide: Slide,
  prompt: string,
  model: string = DEFAULT_TEXT_MODEL
): Promise<{ title: string; content: string }> {
  const response = await getClient().models.generateContent({
    model: model || DEFAULT_TEXT_MODEL,
    contents: `Reescribe el contenido de esta diapositiva según la instrucción del usuario.
    Diapositiva original:
    Título: ${slide.title}
    Contenido: ${slide.content}
    
    Instrucción del usuario: ${prompt}
    
    El campo 'content' debe ser markdown bien formateado: para títulos o subtítulos de sección usa encabezados con numeral (# ## ###), por ejemplo "## Problemas Comunes" o "### Detalles"; no uses "* **Título:**" como subtítulo. Cada viñeta (* o -) y cada ítem numerado (1. 2. 3.) en su propia línea. Usa ** solo para destacar términos dentro de una línea, no para encabezados.
    Responde estrictamente en formato JSON con las propiedades 'title' y 'content'.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          content: { type: Type.STRING },
        },
        required: ["title", "content"],
      },
    },
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("Failed to parse JSON:", response.text);
    return { title: slide.title, content: slide.content };
  }
}

/** Genera notas del presentador para una diapositiva */
export async function generatePresenterNotes(
  slide: Slide,
  model: string = DEFAULT_TEXT_MODEL
): Promise<string> {
  const response = await getClient().models.generateContent({
    model: model || DEFAULT_TEXT_MODEL,
    contents: `Genera notas breves para el presentador de esta diapositiva. Incluye puntos clave a recordar, transiciones sugeridas y datos o frases que no deben olvidarse. Sé conciso (2-4 líneas).
    Título: ${slide.title}
    Contenido: ${slide.content}
    Responde solo el texto de las notas, sin título ni formato adicional.`,
  });
  return (response.text || "").trim();
}

/** Genera speech/guion para una diapositiva con prompt opcional (específico o vacío para estándar) */
export async function generateSpeechForSlide(
  slide: Slide,
  customPrompt?: string,
  model: string = DEFAULT_TEXT_MODEL
): Promise<string> {
  const instruction = customPrompt?.trim()
    ? `Instrucción adicional del presentador: ${customPrompt}.`
    : "Genera un guion natural y conciso que un presentador podría decir al mostrar esta diapositiva (2-5 frases).";
  const response = await getClient().models.generateContent({
    model: model || DEFAULT_TEXT_MODEL,
    contents: `Diapositiva:
    Título: ${slide.title}
    Contenido: ${slide.content}
    ${instruction}
    Responde solo el texto del guion, sin etiquetas.`,
  });
  return (response.text || "").trim();
}

/** Genera speech para todas las diapositivas usando un prompt general */
export async function generateSpeechForAll(
  slides: Slide[],
  generalPrompt: string,
  model: string = DEFAULT_TEXT_MODEL
): Promise<string[]> {
  const results: string[] = [];
  for (const slide of slides) {
    const text = await generateSpeechForSlide(slide, generalPrompt, model);
    results.push(text);
  }
  return results;
}

/** Refina el texto de las notas del presentador manteniendo el sentido y mejorando claridad y tono */
export async function refinePresenterNotes(
  slide: Slide,
  currentNotes: string,
  model: string = DEFAULT_TEXT_MODEL
): Promise<string> {
  if (!currentNotes.trim()) return currentNotes;
  const response = await getClient().models.generateContent({
    model: model || DEFAULT_TEXT_MODEL,
    contents: `Refina y mejora el siguiente texto de notas para el presentador. Mantén el mismo contenido y sentido, pero mejora la claridad, el tono y la estructura. No añadas contenido nuevo que no esté implícito.
    Contexto de la diapositiva - Título: ${
      slide.title
    }. Contenido (resumen): ${slide.content.slice(0, 300)}...
    Texto actual del presentador:
    ${currentNotes}
    Responde solo el texto refinado, sin explicaciones ni etiquetas.`,
  });
  return (response.text || currentNotes).trim();
}

/** Genera código para el slide según título, contenido y lenguaje. Opcional: prompt extra del usuario. */
export async function generateCodeForSlide(
  slide: Slide,
  language: string,
  customPrompt?: string,
  model: string = DEFAULT_TEXT_MODEL
): Promise<{ code: string }> {
  const context = `Título: ${slide.title}\nContenido: ${slide.content}`;
  const instruction = customPrompt?.trim()
    ? `Instrucción adicional del usuario: ${customPrompt}.`
    : "Genera código de ejemplo breve y claro que ilustre el concepto de esta diapositiva. Solo el código, sin explicaciones alrededor.";
  const response = await getClient().models.generateContent({
    model: model || DEFAULT_TEXT_MODEL,
    contents: `Eres un experto en programación. Genera código de ejemplo para una diapositiva de presentación.

Contexto de la diapositiva:
---
${context}
---

Lenguaje de programación: ${language}.
${instruction}

Responde ÚNICAMENTE con el bloque de código, sin markdown (sin \`\`\`), sin explicaciones antes ni después. El código debe ser conciso, correcto y fácil de leer en una slide.`,
  });
  const text = (response.text || "").trim();
  // Quitar posibles bloques markdown que el modelo haya añadido
  const code = text
    .replace(/^```[\w]*\n?/, "")
    .replace(/\n?```\s*$/, "")
    .trim();
  return { code: code || "// Sin código generado" };
}

/** Chat para consultas durante la presentación: responde en markdown con contexto del tema y slide actual */
export async function presenterChat(
  topic: string,
  currentSlideTitle: string,
  currentSlideContent: string,
  userMessage: string,
  model: string = DEFAULT_TEXT_MODEL
): Promise<string> {
  const response = await getClient().models.generateContent({
    model: model || DEFAULT_TEXT_MODEL,
    contents: `Eres un asistente durante una presentación. El tema de la presentación es: "${topic}". La diapositiva actual tiene título: "${currentSlideTitle}" y contenido: ${currentSlideContent.slice(
      0,
      500
    )}.

El presentador o alguien del público hace la siguiente pregunta o pide que ahondes en el tema:
"${userMessage}"

Responde de forma clara y concisa. Si incluyes código, formátalo en bloques markdown con la sintaxis correcta (por ejemplo \`\`\`javascript ... \`\`\`). Usa listas, negritas y párrafos cuando ayude. Responde solo el contenido útil, sin preámbulos tipo "Claro, ..." a menos que sea natural.`,
  });
  return (response.text || "").trim();
}
