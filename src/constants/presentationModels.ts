export type PresentationProvider =
  | "gemini"
  | "openai"
  | "xai"
  | "groq"
  | "cerebras"
  | "openrouter";

/** Usar el modelo del combo para split / rewrite / alternativas de prompt (API chat tipo OpenAI). */
export function usesChatCompletionSlideOps(
  provider: PresentationProvider | undefined,
): boolean {
  return (
    provider === "openai" ||
    provider === "groq" ||
    provider === "cerebras" ||
    provider === "openrouter"
  );
}

export interface PresentationModelOption {
  id: string;
  label: string;
  provider: PresentationProvider;
  /** Texto de ayuda en el combo (cuándo conviene este modelo). */
  description?: string;
}

const PRESENTATION_MODEL_ROWS: Array<
  Omit<PresentationModelOption, "description">
> = [
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    provider: "gemini",
  },
  {
    id: "gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash-Lite",
    provider: "gemini",
  },
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    provider: "gemini",
  },
  {
    id: "gemini-3-flash-preview",
    label: "Gemini 3 Flash (preview)",
    provider: "gemini",
  },
  {
    id: "gemini-3.1-flash-lite-preview",
    label: "Gemini 3.1 Flash-Lite (preview)",
    provider: "gemini",
  },
  {
    id: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro (preview)",
    provider: "gemini",
  },
  {
    id: "gpt-5.2",
    label: "OpenAI GPT-5.2",
    provider: "openai",
  },
  {
    id: "gpt-5-mini",
    label: "OpenAI GPT-5 mini",
    provider: "openai",
  },
  {
    id: "gpt-5-nano",
    label: "OpenAI GPT-5 nano",
    provider: "openai",
  },
  {
    id: "gpt-5.2-pro",
    label: "OpenAI GPT-5.2 pro",
    provider: "openai",
  },
  {
    id: "grok-4-1-fast-reasoning",
    label: "Grok 4.1 Fast (reasoning)",
    provider: "xai",
  },
  {
    id: "grok-4-1-fast-non-reasoning",
    label: "Grok 4.1 Fast",
    provider: "xai",
  },
  {
    id: "grok-4-0709",
    label: "Grok 4",
    provider: "xai",
  },
  {
    id: "grok-3",
    label: "Grok 3",
    provider: "xai",
  },
  {
    id: "grok-3-mini",
    label: "Grok 3 mini",
    provider: "xai",
  },
  {
    id: "openai/gpt-oss-20b",
    label: "Groq — GPT-OSS 20B",
    provider: "groq",
  },
  {
    id: "openrouter/free",
    label: "OpenRouter (free)",
    provider: "openrouter",
  },
  {
    id: "llama3.1-8b",
    label: "Cerebras Llama 3.1 8B",
    provider: "cerebras",
  },
];

/** Cuándo usar cada modelo (se muestra en el desplegable). */
const PRESENTATION_MODEL_WHEN_TO_USE: Record<string, string> = {
  "gemini-2.5-flash":
    "Buen equilibrio velocidad / calidad; ideal como opción por defecto para generar decks completos.",
  "gemini-2.5-flash-lite":
    "Más rápido y económico; borradores, esquemas o iteraciones cuando el texto puede ser más simple.",
  "gemini-2.5-pro":
    "Máxima calidad en la familia 2.5; razonamiento más fino y redacción cuidada si el tiempo de respuesta lo permite.",
  "gemini-3-flash-preview":
    "Línea nueva (preview); prueba cuando quieras lo último en Gemini con sesgo a velocidad.",
  "gemini-3.1-flash-lite-preview":
    "Preview ligero de 3.1; tareas rápidas o listas cuando aceptes modelos en preview.",
  "gemini-3.1-pro-preview":
    "Preview más capaz de 3.1; contenido exigente o poco habitual si toleras inestabilidad de preview.",
  "gpt-5.2":
    "Modelo tope OpenAI para calidad general; buena opción si priorizas precisión y matices.",
  "gpt-5-mini":
    "OpenAI más ligero que 5.2; coste menor y buen resultado en la mayoría de decks estándar.",
  "gpt-5-nano":
    "El más rápido/barato de la familia; esquemas, ideas iniciales o cuando el volumen es alto.",
  "gpt-5.2-pro":
    "Máxima capacidad OpenAI; razonamiento complejo, pocos errores o prompts muy largos.",
  "grok-4-1-fast-reasoning":
    "xAI con modo razonamiento; cuando necesites cadena de pensamiento explícita o pasos detallados.",
  "grok-4-1-fast-non-reasoning":
    "xAI rápido sin cadena de razonamiento; respuestas directas y menor latencia.",
  "grok-4-0709":
    "Modelo Grok 4 estable; alternativa sólida si ya usas el ecosistema xAI.",
  "grok-3":
    "Generación anterior a 4.x; útil si buscas un comportamiento conocido o compatibilidad.",
  "grok-3-mini":
    "Variante compacta de Grok 3; tareas simples o cuando quieras minimizar coste en xAI.",
  "openai/gpt-oss-20b":
    "Modelo abierto vía Groq; muy rápido; mejor para borradores o cuando la API de Groq es tu canal.",
  "openrouter/free":
    "Modelo gratuito agregado por OpenRouter; ideal para pruebas, con límites y disponibilidad variables.",
  "llama3.1-8b":
    "Llama pequeña en Cerebras; extrema velocidad en hardware Cerebras; borradores o listas cortas.",
};

export const PRESENTATION_MODELS: PresentationModelOption[] =
  PRESENTATION_MODEL_ROWS.map((m) => ({
    ...m,
    description: PRESENTATION_MODEL_WHEN_TO_USE[m.id],
  }));

export const DEFAULT_PRESENTATION_MODEL_ID = PRESENTATION_MODELS[0].id;
