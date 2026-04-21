import { useCallback, useEffect, useMemo } from "react";
import { PRESENTATION_MODELS } from "../../constants/presentationModels";
import {
  getGeminiApiKey,
  getOpenAIApiKey,
  getXaiApiKey,
  getGroqApiKey,
  getCerebrasApiKey,
  getOpenRouterApiKey,
} from "../../services/apiConfig";
import type { PresentationModelCatalogDeps } from "./presentationModelCatalogDeps";

/**
 * Modelos de presentación filtrados por API keys configuradas, derivados para Gemini
 * y sincronización del proveedor de imagen (Gemini/OpenAI).
 */
export function usePresentationModelCatalog(
  deps: PresentationModelCatalogDeps,
) {
  const hasGemini = !!getGeminiApiKey();
  const hasOpenAI = !!getOpenAIApiKey();
  const hasXai = !!getXaiApiKey();
  const hasGroq = !!getGroqApiKey();
  const hasCerebras = !!getCerebrasApiKey();
  const hasOpenRouter = !!getOpenRouterApiKey();

  const presentationModels = useMemo(
    () =>
      PRESENTATION_MODELS.filter(
        (m) =>
          (m.provider === "gemini" && hasGemini) ||
          (m.provider === "openai" && hasOpenAI) ||
          (m.provider === "xai" && hasXai) ||
          (m.provider === "groq" && hasGroq) ||
          (m.provider === "cerebras" && hasCerebras) ||
          (m.provider === "openrouter" && hasOpenRouter),
      ),
    [
      hasGemini,
      hasOpenAI,
      hasXai,
      hasGroq,
      hasCerebras,
      hasOpenRouter,
      deps.apiKeysVersion,
    ],
  );

  const refreshApiKeys = useCallback(() => {
    deps.setApiKeysVersion((v) => v + 1);
  }, [deps.setApiKeysVersion]);

  const presentationModelOption = useMemo(
    () =>
      presentationModels.find((m) => m.id === deps.presentationModelId) ??
      PRESENTATION_MODELS.find((m) => m.id === deps.presentationModelId),
    [presentationModels, deps.presentationModelId],
  );

  const effectiveGeminiModel = useMemo(
    () =>
      presentationModelOption?.provider === "gemini"
        ? deps.presentationModelId
        : "gemini-2.5-flash",
    [presentationModelOption, deps.presentationModelId],
  );

  const modelForGeminiOps = useMemo(
    () => effectiveGeminiModel?.trim() || "gemini-2.5-flash",
    [effectiveGeminiModel],
  );

  const effectiveGeminiModelLabel = useMemo(
    () =>
      PRESENTATION_MODELS.find((m) => m.id === modelForGeminiOps)?.label ??
      modelForGeminiOps,
    [modelForGeminiOps],
  );

  useEffect(() => {
    const allowedIds = presentationModels.map((m) => m.id);
    if (
      presentationModels.length > 0 &&
      !allowedIds.includes(deps.presentationModelId)
    ) {
      deps.setPresentationModelId(presentationModels[0].id);
    }
  }, [presentationModels, deps.presentationModelId, deps.setPresentationModelId]);

  /** Solo corregir si el proveedor alternativo tiene clave; si no hay ninguna, no alternar (evita bucle infinito). */
  useEffect(() => {
    if (deps.imageProvider === "openai" && !hasOpenAI && hasGemini) {
      deps.setImageProvider("gemini");
    } else if (deps.imageProvider === "gemini" && !hasGemini && hasOpenAI) {
      deps.setImageProvider("openai");
    }
  }, [
    hasGemini,
    hasOpenAI,
    deps.imageProvider,
    deps.setImageProvider,
  ]);

  return {
    hasGemini,
    hasOpenAI,
    hasXai,
    presentationModels,
    presentationModelOption,
    effectiveGeminiModel,
    modelForGeminiOps,
    effectiveGeminiModelLabel,
    refreshApiKeys,
  };
}
