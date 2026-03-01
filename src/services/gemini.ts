import { GoogleGenAI, Type } from "@google/genai";
import { Slide } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generatePresentation(topic: string): Promise<Slide[]> {
  // Intentar extraer el número de diapositivas del prompt del usuario
  const slideCountMatch = topic.match(/(\d+)\s+diapositivas/i);
  const requestedCount = slideCountMatch ? parseInt(slideCountMatch[1]) : 10;
  const countInstruction = slideCountMatch
    ? `La presentación debe tener exactamente ${requestedCount} diapositivas.`
    : `La presentación debe tener entre 8 y 12 diapositivas.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Genera una presentación profesional y estructurada sobre el tema: "${topic}". 
    ${countInstruction}
    Sigue esta estructura:
    1. Una diapositiva de tipo 'chapter' para el título principal.
    2. Diapositivas de tipo 'content' para la introducción y puntos clave.
    3. Diapositivas de tipo 'chapter' para separar secciones temáticas si es necesario.
    4. Una diapositiva de tipo 'content' para la conclusión.
    
    Las diapositivas de tipo 'chapter' solo tienen un título central impactante.
    Las diapositivas de tipo 'content' tienen:
    - title: Un título claro.
    - content: Desarrollo en formato markdown (usa viñetas, negritas, etc.).
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

export async function generateImage(
  slideContext: string,
  userPrompt: string,
  stylePrompt: string = "",
  includeBackground: boolean = true
): Promise<string | undefined> {
  const noTextRule =
    "REGLA OBLIGATORIA: La imagen NO debe contener ningún texto, leyendas, etiquetas, palabras ni caracteres. Solo elementos puramente visuales e ilustrativos.";
  const backgroundRule = includeBackground
    ? ""
    : " La imagen debe mostrarse SIN fondo decorativo: fondo transparente o blanco puro, solo el sujeto o concepto principal, sin escenario, ambiente ni elementos de fondo. Ignora cualquier indicación de fondo en el estilo.";
  const fullPrompt = `Contexto de la diapositiva: ${slideContext}. 
  Características adicionales solicitadas: ${userPrompt}. 
  Estilo visual: ${stylePrompt}.${backgroundRule}
  ${noTextRule}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: {
      parts: [{ text: fullPrompt }],
    },
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

export async function splitSlide(
  slide: Slide,
  prompt: string
): Promise<Slide[]> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `El usuario quiere profundizar en el tema de esta diapositiva y dividirla en 2 o más diapositivas.
    Diapositiva original:
    Título: ${slide.title}
    Contenido: ${slide.content}
    
    Instrucción del usuario: ${prompt}
    
    Genera un array de nuevas diapositivas (tipo 'content') que expandan este tema.
    Responde estrictamente en formato JSON.`,
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
  prompt: string
): Promise<{ title: string; content: string }> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Reescribe el contenido de esta diapositiva según la instrucción del usuario.
    Diapositiva original:
    Título: ${slide.title}
    Contenido: ${slide.content}
    
    Instrucción del usuario: ${prompt}
    
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
export async function generatePresenterNotes(slide: Slide): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
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
  customPrompt?: string
): Promise<string> {
  const instruction = customPrompt?.trim()
    ? `Instrucción adicional del presentador: ${customPrompt}.`
    : "Genera un guion natural y conciso que un presentador podría decir al mostrar esta diapositiva (2-5 frases).";
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
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
  generalPrompt: string
): Promise<string[]> {
  const results: string[] = [];
  for (const slide of slides) {
    const text = await generateSpeechForSlide(slide, generalPrompt);
    results.push(text);
  }
  return results;
}

/** Refina el texto de las notas del presentador manteniendo el sentido y mejorando claridad y tono */
export async function refinePresenterNotes(
  slide: Slide,
  currentNotes: string
): Promise<string> {
  if (!currentNotes.trim()) return currentNotes;
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
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

/** Chat para consultas durante la presentación: responde en markdown con contexto del tema y slide actual */
export async function presenterChat(
  topic: string,
  currentSlideTitle: string,
  currentSlideContent: string,
  userMessage: string
): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
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
