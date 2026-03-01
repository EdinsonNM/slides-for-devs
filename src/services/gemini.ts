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
            imagePrompt: { type: Type.STRING, description: "Sugerencia de prompt para generar una imagen" }
          },
          required: ["id", "type", "title", "content"]
        }
      }
    }
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

export async function generateImage(slideContext: string, userPrompt: string, stylePrompt: string = ""): Promise<string | undefined> {
  const fullPrompt = `Contexto de la diapositiva: ${slideContext}. 
  Características adicionales solicitadas: ${userPrompt}. 
  Estilo visual: ${stylePrompt}.
  REGLA CRÍTICA: La imagen debe ser puramente visual y representar el concepto solicitado de forma artística o técnica. Evita texto innecesario o ilegible, pero puedes incluir etiquetas técnicas simples si el estilo lo requiere (como nombres de lenguajes o comandos breves) siempre que se mantengan minimalistas y limpias.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: {
      parts: [
        { text: fullPrompt }
      ]
    },
    config: {
      imageConfig: {
        aspectRatio: "1:1",
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return undefined;
}

export async function splitSlide(slide: Slide, prompt: string): Promise<Slide[]> {
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
            imagePrompt: { type: Type.STRING }
          },
          required: ["id", "type", "title", "content"]
        }
      }
    }
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

export async function rewriteSlide(slide: Slide, prompt: string): Promise<{ title: string, content: string }> {
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
          content: { type: Type.STRING }
        },
        required: ["title", "content"]
      }
    }
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("Failed to parse JSON:", response.text);
    return { title: slide.title, content: slide.content };
  }
}
