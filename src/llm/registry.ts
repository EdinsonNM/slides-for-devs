import { PRESENTATION_MODELS } from "../constants/presentationModels";
import type {
  IPresentationGenerator,
  ISlideOperations,
  IImageGenerator,
  PresentationProviderId,
  ImageProviderId,
} from "./types";
import { GeminiProvider } from "./providers/gemini-provider";
import { OpenAIProvider } from "./providers/openai-provider";
import { XaiProvider } from "./providers/xai-provider";

const geminiProvider = new GeminiProvider();
const openaiProvider = new OpenAIProvider();
const xaiProvider = new XaiProvider();

const presentationByProvider: Record<PresentationProviderId, IPresentationGenerator> = {
  gemini: geminiProvider,
  openai: openaiProvider,
  xai: xaiProvider,
};

const imageByProvider: Record<ImageProviderId, IImageGenerator> = {
  gemini: geminiProvider,
  openai: openaiProvider,
};

/**
 * Obtiene el generador de presentaciones para el modelo dado.
 * El modelo debe existir en PRESENTATION_MODELS.
 */
export function getPresentationGenerator(
  modelId: string
): IPresentationGenerator {
  const option = PRESENTATION_MODELS.find((m) => m.id === modelId);
  const provider: PresentationProviderId = option?.provider ?? "gemini";
  return presentationByProvider[provider];
}

/**
 * Obtiene el proveedor de operaciones sobre diapositivas (split, rewrite, alternativas de imagen).
 * xAI no soporta estas operaciones; en ese caso se devuelve el proveedor Gemini como fallback
 * para que la UI pueda seguir funcionando (o el llamador puede usar Gemini explícitamente).
 */
export function getSlideOperations(modelId: string): ISlideOperations | null {
  const option = PRESENTATION_MODELS.find((m) => m.id === modelId);
  const provider = option?.provider ?? "gemini";
  if (provider === "xai") return null;
  return presentationByProvider[provider] as ISlideOperations;
}

/**
 * Obtiene el generador de imágenes para el proveedor dado (gemini u openai).
 */
export function getImageGenerator(
  providerId: ImageProviderId
): IImageGenerator {
  return imageByProvider[providerId];
}

/**
 * Proveedor Gemini para operaciones de diapositivas (split, rewrite, alternativas de imagen).
 * Usar como fallback cuando el modelo seleccionado es xAI (que no soporta estas operaciones).
 */
export function getGeminiSlideOperations(): ISlideOperations {
  return geminiProvider;
}
