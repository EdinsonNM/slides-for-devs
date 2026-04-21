import { useCallback, useEffect, useRef, useState } from "react";
import {
  DECK_COVER_IMAGE_PROMPT,
  DECK_COVER_STYLE_PROMPT,
  buildDeckCoverImageUserPrompt,
  firstSlideDeckCoverImageUrl,
  loadSlaimMascotCoverReferenceDataUrl,
  SLAIM_MASCOT_COVER_CHARACTER_PROMPT,
} from "../../constants/deckCover";
import { normalizeDeckVisualTheme } from "../../domain/entities";
import { listPresentations, loadPresentation, updatePresentation } from "../../services/storage";
import { getGeminiApiKey } from "../../services/apiConfig";
import { generateImage as generateImageUseCase } from "../../composition/container";
import { trackEvent, ANALYTICS_EVENTS } from "../../services/analytics";
import type { PresentationDeckCoversDeps } from "./presentationDeckCoversDeps";

export function usePresentationDeckCovers(deps: PresentationDeckCoversDeps) {
  const depsRef = useRef(deps);
  depsRef.current = deps;

  const [generatingCoverId, setGeneratingCoverId] = useState<string | null>(
    null,
  );
  const [coverImageCache, setCoverImageCache] = useState<
    Record<string, string>
  >({});
  const coverPrefetchSavedAtRef = useRef<Record<string, string>>({});
  const coverPrefetchGenerationRef = useRef(0);

  useEffect(() => {
    const generation = ++coverPrefetchGenerationRef.current;
    const scope = depsRef.current.localAccountScope;
    const list = depsRef.current.savedList;
    const eligible = list.filter(
      (m) =>
        m.slideCount > 0 &&
        !m.localBodyCleared &&
        coverPrefetchSavedAtRef.current[m.id] !== m.savedAt,
    );
    if (eligible.length === 0) return;

    void (async () => {
      for (const meta of eligible) {
        if (coverPrefetchSavedAtRef.current[meta.id] === meta.savedAt) continue;
        try {
          const saved = await loadPresentation(meta.id, scope);
          if (coverPrefetchGenerationRef.current !== generation) break;
          if (saved.savedAt !== meta.savedAt) continue;
          coverPrefetchSavedAtRef.current[meta.id] = saved.savedAt;
          const coverUrl = firstSlideDeckCoverImageUrl(saved.slides[0]);
          if (coverUrl) {
            setCoverImageCache((prev) => ({ ...prev, [meta.id]: coverUrl }));
          }
        } catch {
          /* listado ya mostró la tarjeta; fallo al leer portada no bloquea */
        }
      }
    })();

    return () => {
      coverPrefetchGenerationRef.current += 1;
    };
  }, [deps.savedList, deps.localAccountScope]);

  const handleGenerateCoverForPresentation = useCallback(async (id: string) => {
    setGeneratingCoverId(id);
    try {
      const d = depsRef.current;
      try {
        const list = await listPresentations(d.localAccountScope);
        const meta = list.find((p) => p.id === id);
        if (meta?.localBodyCleared) {
          alert(
            "Recupera la presentación desde la nube antes de generar la portada.",
          );
          return;
        }
      } catch {
        /* ignore */
      }
      const saved = await loadPresentation(id, d.localAccountScope);
      if (!saved.slides.length) {
        alert("Esta presentación no tiene diapositivas.");
        return;
      }
      const firstSlide = saved.slides[0];
      const slideContext = `Título: ${firstSlide.title}. Contenido: ${firstSlide.content}. Presentación sobre: ${saved.topic}`;
      if (!getGeminiApiKey()?.trim()) {
        alert(
          "La portada Slaim se genera con Gemini. Configura tu API key de Gemini en Ajustes de la app.",
        );
        return;
      }
      const mascotReferenceImageDataUrl =
        await loadSlaimMascotCoverReferenceDataUrl();
      const imageUrl = await generateImageUseCase.run({
        providerId: "gemini",
        slideContext,
        userPrompt: buildDeckCoverImageUserPrompt(),
        stylePrompt: DECK_COVER_STYLE_PROMPT,
        includeBackground: true,
        modelId: d.geminiImageModelId,
        characterPrompt: SLAIM_MASCOT_COVER_CHARACTER_PROMPT,
        characterReferenceImageDataUrl: mascotReferenceImageDataUrl,
        aspectRatio: "16:9",
      });
      if (imageUrl) {
        const updatedSlides = [...saved.slides];
        updatedSlides[0] = {
          ...firstSlide,
          imageUrl,
          imagePrompt: DECK_COVER_IMAGE_PROMPT,
        };
        await updatePresentation(
          id,
          {
            topic: saved.topic,
            slides: updatedSlides,
            characterId: saved.characterId,
            deckVisualTheme: normalizeDeckVisualTheme(saved.deckVisualTheme),
            deckNarrativePresetId: saved.deckNarrativePresetId,
            narrativeNotes: saved.narrativeNotes,
          },
          d.localAccountScope,
        );
        if (
          d.autoCloudSyncOnSave &&
          d.user &&
          typeof window !== "undefined" &&
          (window as unknown as { __TAURI__?: unknown }).__TAURI__
        ) {
          void d.runAutoSyncAfterSaveRef.current(id);
        }
        setCoverImageCache((prev) => ({ ...prev, [id]: imageUrl }));
        trackEvent(ANALYTICS_EVENTS.COVER_GENERATED);
      } else {
        alert(
          "No se pudo generar la portada con Gemini. Comprueba tu API key y el modelo de imagen en Ajustes.",
        );
      }
    } catch (e) {
      console.error(e);
      alert(
        "Error al generar la portada. Comprueba la consola y tu configuración de API.",
      );
    } finally {
      setGeneratingCoverId(null);
    }
  }, []);

  return {
    generatingCoverId,
    coverImageCache,
    setCoverImageCache,
    coverPrefetchSavedAtRef,
    handleGenerateCoverForPresentation,
  };
}
