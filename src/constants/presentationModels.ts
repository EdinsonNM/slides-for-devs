export type PresentationProvider = "gemini" | "openai" | "xai";

export interface PresentationModelOption {
  id: string;
  label: string;
  provider: PresentationProvider;
}

/**
 * Modelos recomendados para generación de presentaciones.
 * Gemini: https://ai.google.dev/gemini-api/docs/models
 * OpenAI: https://developers.openai.com/api/docs/models
 * xAI (Grok): https://docs.x.ai/developers/quickstart
 */
export const PRESENTATION_MODELS: PresentationModelOption[] = [
  // --- Gemini (Google AI) ---
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
    id: "gemini-1.5-flash",
    label: "Gemini 1.5 Flash",
    provider: "gemini",
  },
  {
    id: "gemini-1.5-pro",
    label: "Gemini 1.5 Pro",
    provider: "gemini",
  },
  // --- OpenAI (Frontier / recomendados) ---
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
    id: "gpt-4.1",
    label: "OpenAI GPT-4.1",
    provider: "openai",
  },
  {
    id: "gpt-4.1-mini",
    label: "OpenAI GPT-4.1 mini",
    provider: "openai",
  },
  {
    id: "gpt-4.1-nano",
    label: "OpenAI GPT-4.1 nano",
    provider: "openai",
  },
  {
    id: "gpt-4o",
    label: "OpenAI GPT-4o",
    provider: "openai",
  },
  {
    id: "gpt-4o-mini",
    label: "OpenAI GPT-4o mini",
    provider: "openai",
  },
  // --- xAI (Grok) ---
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
];

export const DEFAULT_PRESENTATION_MODEL_ID = PRESENTATION_MODELS[0].id;
