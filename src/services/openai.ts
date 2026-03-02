const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const API_URL = "https://api.openai.com/v1/images/generations";

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
  if (!OPENAI_API_KEY?.trim()) {
    throw new Error(
      "OPENAI_API_KEY no está configurada. Añádela en .env o .env.local."
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

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
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
