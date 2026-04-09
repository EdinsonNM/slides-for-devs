import {
  PRESENTATION_MODELS,
  type PresentationProvider,
} from "../constants/presentationModels";
import type { PresentationGeneratorPort, SlideOperationsPort, ImageGeneratorPort } from "../domain/ports";
import {
  GeneratePresentationUseCase,
  SplitSlideUseCase,
  RewriteSlideUseCase,
  GenerateSlideContentUseCase,
  GenerateSlideMatrixUseCase,
  GenerateImagePromptAlternativesUseCase,
  GenerateImageUseCase,
} from "../application/use-cases";
import { GeminiAdapter, OpenAIAdapter, XaiAdapter, OpenAiCompatibleAdapter } from "../infrastructure/adapters";
import { getGroqApiKey, getCerebrasApiKey, getOpenRouterApiKey } from "../services/apiConfig";

const gemini = new GeminiAdapter();
const openai = new OpenAIAdapter();
const xai = new XaiAdapter();
const groq = new OpenAiCompatibleAdapter({
  providerId: "groq",
  chatUrl: "https://api.groq.com/openai/v1/chat/completions",
  getApiKey: getGroqApiKey,
  label: "Groq",
  defaultModel: "openai/gpt-oss-20b",
});
const cerebras = new OpenAiCompatibleAdapter({
  providerId: "cerebras",
  chatUrl: "https://api.cerebras.ai/v1/chat/completions",
  getApiKey: getCerebrasApiKey,
  label: "Cerebras",
  defaultModel: "llama3.1-8b",
});
const openrouter = new OpenAiCompatibleAdapter({
  providerId: "openrouter",
  chatUrl: "https://openrouter.ai/api/v1/chat/completions",
  getApiKey: getOpenRouterApiKey,
  label: "OpenRouter",
  defaultModel: "openrouter/free",
  extraHeaders: {
    "HTTP-Referer": "https://slaim.app",
    "X-Title": "Slaim",
  },
});

const byProvider: Record<PresentationProvider, PresentationGeneratorPort> = {
  gemini,
  openai,
  xai,
  groq,
  cerebras,
  openrouter,
};

function getPresentationGenerator(modelId: string): PresentationGeneratorPort {
  const option = PRESENTATION_MODELS.find((m) => m.id === modelId);
  return byProvider[option?.provider ?? "gemini"];
}

function getSlideOperations(modelId: string): SlideOperationsPort | null {
  const option = PRESENTATION_MODELS.find((m) => m.id === modelId);
  if (option?.provider === "xai") return null;
  return byProvider[option?.provider ?? "gemini"] as unknown as SlideOperationsPort;
}

const imageByProvider: Record<"gemini" | "openai", ImageGeneratorPort> = {
  gemini,
  openai,
};

export const generatePresentation = new GeneratePresentationUseCase(getPresentationGenerator);

export const splitSlide = new SplitSlideUseCase(getSlideOperations, gemini);

export const rewriteSlide = new RewriteSlideUseCase(getSlideOperations, gemini);

export const generateSlideContent = new GenerateSlideContentUseCase(getSlideOperations, gemini);

export const generateSlideMatrix = new GenerateSlideMatrixUseCase(getSlideOperations, gemini);

export const generateImagePromptAlternatives = new GenerateImagePromptAlternativesUseCase(
  getSlideOperations,
  gemini
);

export const generateImage = new GenerateImageUseCase(
  (id) => imageByProvider[id]
);
