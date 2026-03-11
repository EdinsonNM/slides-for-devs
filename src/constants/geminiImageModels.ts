export interface GeminiImageModelOption {
  id: string;
  label: string;
}

export const GEMINI_IMAGE_MODELS: GeminiImageModelOption[] = [
  {
    id: "gemini-2.5-flash-image",
    label: "Nano Banana (2.5 Flash)",
  },
  {
    id: "gemini-3.1-flash-image-preview",
    label: "Nano Banana 2 (3.1 Flash)",
  },
  {
    id: "gemini-3-pro-image-preview",
    label: "Nano Banana Pro (3 Pro)",
  },
];

export const DEFAULT_GEMINI_IMAGE_MODEL_ID = GEMINI_IMAGE_MODELS[0].id;
