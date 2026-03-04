import type { Slide } from "../types";
import { getOpenAIApiKey } from "./apiConfig";

const IMAGES_URL = "https://api.openai.com/v1/images/generations";
const CHAT_URL = "https://api.openai.com/v1/chat/completions";

/**
 * Genera una imagen con DALL-E 3 (OpenAI).
 * Misma firma que generateImage de Gemini para poder alternar proveedor.
 */
export async function generateImageOpenAI(
  slideContext: string,
  userPrompt: string,
  stylePrompt: string = "",
  includeBackground: boolean = true
): Promise<string | undefined> {
  const OPENAI_API_KEY = getOpenAIApiKey();
  if (!OPENAI_API_KEY?.trim()) {
    throw new Error(
      "No hay API key de OpenAI configurada. Puedes añadirla en la pantalla de inicio o en Ajustes."
    );
  }

  const noTextRule =
    "The image must NOT contain any text, labels, words or characters. Only purely visual elements.";
  const backgroundRule = includeBackground
    ? ""
    : " Show the subject on a plain white or transparent background, no scenery or environment.";
  const fullPrompt = `Slide context: ${slideContext}. 
Additional details: ${userPrompt}. 
Visual style: ${stylePrompt}.${backgroundRule}
${noTextRule}`;

  const res = await fetch(IMAGES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY!.trim()}`,
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt: fullPrompt,
      n: 1,
      size: "1024x1024",
      response_format: "b64_json",
      quality: "standard",
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err?.error?.message || `OpenAI API error: ${res.status} ${res.statusText}`
    );
  }

  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) return undefined;
  return `data:image/png;base64,${b64}`;
}

const MIN_SLIDES = 3;
const MAX_SLIDES = 50;
const DEFAULT_SLIDES = 10;

const PRESENTATION_SYSTEM = `Eres un experto en crear presentaciones. Genera siempre un JSON válido con un objeto que tenga una clave "slides" que sea un array de diapositivas.
Cada diapositiva tiene: id (string), type ("content" o "chapter"), title (string), content (string, markdown), imagePrompt (string, opcional), subtitle (string, opcional).
Las de tipo "chapter" tienen solo título impactante; las de tipo "content" tienen title, content en markdown e imagePrompt para ilustrar.`;

/**
 * Pide al modelo que interprete cuántas diapositivas quiere el usuario.
 * Acepta frases como "unas 20", "presentación larga", "cortita", etc.
 */
async function parseRequestedSlideCountOpenAI(
  topic: string,
  model: string,
  key: string
): Promise<number> {
  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key.trim()}`,
    },
    body: JSON.stringify({
      model: model || "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `Mensaje del usuario para crear una presentación: "${topic}"

Interpreta cuántas diapositivas quiere. Ejemplos: "20 diapositivas"→20, "unas 15"→15, "presentación larga"→22, "cortita"→6, "muchas"→28. Si no está claro → 10.
Responde ÚNICAMENTE con un número entero entre ${MIN_SLIDES} y ${MAX_SLIDES}.`,
        },
      ],
      max_tokens: 10,
    }),
  });
  if (!res.ok) return DEFAULT_SLIDES;
  const data = await res.json().catch(() => ({}));
  const text = (data?.choices?.[0]?.message?.content ?? "").trim();
  const numMatch = text.match(/\d+/);
  if (!numMatch) return DEFAULT_SLIDES;
  const n = parseInt(numMatch[0], 10);
  return Math.min(MAX_SLIDES, Math.max(MIN_SLIDES, n));
}

/**
 * Genera una presentación con un modelo de OpenAI (GPT).
 * Requiere API key de OpenAI configurada.
 */
export async function generatePresentationOpenAI(
  topic: string,
  model: string = "gpt-5.2"
): Promise<Slide[]> {
  const key = getOpenAIApiKey();
  if (!key?.trim()) {
    throw new Error(
      "No hay API key de OpenAI configurada. Configúrala en el botón de configuración."
    );
  }

  const slideCountMatch = topic.match(/(\d+)\s*(diapositivas?|slides?)\b/i);
  let requestedCount: number;
  if (slideCountMatch) {
    requestedCount = Math.min(
      MAX_SLIDES,
      Math.max(MIN_SLIDES, parseInt(slideCountMatch[1], 10))
    );
  } else {
    requestedCount = await parseRequestedSlideCountOpenAI(topic, model, key);
  }

  const explicitCount = requestedCount !== DEFAULT_SLIDES;
  const countInstruction = explicitCount
    ? `IMPORTANTE: La presentación debe tener EXACTAMENTE ${requestedCount} diapositivas. Genera las ${requestedCount} diapositivas, ni más ni menos.`
    : `La presentación debe tener entre 8 y 12 diapositivas.`;

  const userContent = `Genera una presentación profesional sobre: "${topic}".
${countInstruction}
Estructura: 1 diapositiva 'chapter' de título, luego diapositivas 'content' con title, content (markdown) e imagePrompt. Puedes usar más 'chapter' para separar secciones. Una 'content' de conclusión. El array "slides" debe contener ${explicitCount ? `exactamente ${requestedCount} elementos` : "entre 8 y 12 elementos"}.
Responde ÚNICAMENTE un JSON con esta forma: { "slides": [ { "id": "...", "type": "content"|"chapter", "title": "...", "content": "...", "imagePrompt": "..." }, ... ] }`;

  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key.trim()}`,
    },
    body: JSON.stringify({
      model: model || "gpt-5.2",
      messages: [
        { role: "system", content: PRESENTATION_SYSTEM },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err?.error?.message || `OpenAI API: ${res.status} ${res.statusText}`
    );
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") return [];

  try {
    const parsed = JSON.parse(content) as { slides?: Slide[] } | Slide[];
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.slides)) return parsed.slides;
    const arrayMatch = content.match(/\[[\s\S]*\]/);
    if (arrayMatch) return JSON.parse(arrayMatch[0]) as Slide[];
    return [];
  } catch {
    const arrayMatch = content.match(/\[[\s\S]*\]/);
    if (arrayMatch) return JSON.parse(arrayMatch[0]) as Slide[];
    return [];
  }
}
