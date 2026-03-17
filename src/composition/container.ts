import { PRESENTATION_MODELS } from "../constants/presentationModels";
import type { PresentationGeneratorPort, SlideOperationsPort, ImageGeneratorPort } from "../domain/ports";
import {
  GeneratePresentationUseCase,
  SplitSlideUseCase,
  RewriteSlideUseCase,
  GenerateImagePromptAlternativesUseCase,
  GenerateImageUseCase,
} from "../application/use-cases";
import { GeminiAdapter, OpenAIAdapter, XaiAdapter } from "../infrastructure/adapters";

const gemini = new GeminiAdapter();
const openai = new OpenAIAdapter();
const xai = new XaiAdapter();

const byProvider: Record<string, PresentationGeneratorPort> = {
  gemini,
  openai,
  xai,
};

function getPresentationGenerator(modelId: string): PresentationGeneratorPort {
  const option = PRESENTATION_MODELS.find((m) => m.id === modelId);
  return byProvider[option?.provider ?? "gemini"];
}

function getSlideOperations(modelId: string): SlideOperationsPort | null {
  const option = PRESENTATION_MODELS.find((m) => m.id === modelId);
  if (option?.provider === "xai") return null;
  return byProvider[option?.provider ?? "gemini"] as SlideOperationsPort;
}

const imageByProvider: Record<"gemini" | "openai", ImageGeneratorPort> = {
  gemini,
  openai,
};

export const generatePresentation = new GeneratePresentationUseCase(getPresentationGenerator);

export const splitSlide = new SplitSlideUseCase(getSlideOperations, gemini);

export const rewriteSlide = new RewriteSlideUseCase(getSlideOperations, gemini);

export const generateImagePromptAlternatives = new GenerateImagePromptAlternativesUseCase(
  getSlideOperations,
  gemini
);

export const generateImage = new GenerateImageUseCase(
  (id) => imageByProvider[id]
);
