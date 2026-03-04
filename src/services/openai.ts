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

const PRESENTATION_SYSTEM = `Eres un experto en crear presentaciones. Genera siempre un JSON válido con un objeto que tenga una clave "slides" que sea un array de diapositivas.
Cada diapositiva tiene: id (string), type ("content" o "chapter"), title (string), content (string, markdown), imagePrompt (string, opcional), subtitle (string, opcional).
Las de tipo "chapter" tienen solo título impactante; las de tipo "content" tienen title, content en markdown e imagePrompt para ilustrar.`;

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

  const slideCountMatch = topic.match(/(\d+)\s+diapositivas/i);
  const requestedCount = slideCountMatch ? parseInt(slideCountMatch[1]) : 10;
  const countInstruction = slideCountMatch
    ? `La presentación debe tener exactamente ${requestedCount} diapositivas.`
    : `La presentación debe tener entre 8 y 12 diapositivas.`;

  const userContent = `Genera una presentación profesional sobre: "${topic}".
${countInstruction}
Estructura: 1 diapositiva 'chapter' de título, luego diapositivas 'content' con title, content (markdown) e imagePrompt. Puedes usar más 'chapter' para separar secciones. Una 'content' de conclusión.
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
