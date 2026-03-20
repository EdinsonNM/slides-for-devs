export type PresentationProvider =
  | "gemini"
  | "openai"
  | "xai"
  | "groq"
  | "cerebras"
  | "openrouter";

/** Usar el modelo del combo para split / rewrite / alternativas de prompt (API chat tipo OpenAI). */
export function usesChatCompletionSlideOps(
  provider: PresentationProvider | undefined
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
}

export const PRESENTATION_MODELS: PresentationModelOption[] = [
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

export const DEFAULT_PRESENTATION_MODEL_ID = PRESENTATION_MODELS[0].id;
