import { useCallback, useEffect, useRef, useState } from "react";
import { useLatestRef } from "./useLatestRef";
import {
  DECK_COVER_IMAGE_PROMPT,
  DECK_COVER_CUSTOM_IMAGE_PROMPT,
  DECK_COVER_STYLE_PROMPT,
  buildDeckCoverImageUserPrompt,
  firstSlideDeckCoverImageUrl,
  loadSlaimMascotCoverReferenceDataUrl,
  SLAIM_MASCOT_COVER_CHARACTER_PROMPT,
} from "../../constants/deckCover";
import {
  normalizeDeckVisualTheme,
  type DeckVisualTheme,
} from "../../domain/entities";
import { listPresentations, loadPresentation, updatePresentation } from "../../services/storage";
import { getGeminiApiKey } from "../../services/apiConfig";
import { generateImage as generateImageUseCase } from "../../composition/container";
import { trackEvent, ANALYTICS_EVENTS } from "../../services/analytics";
import type { Slide } from "../../types";
import type { PresentationDeckCoversDeps } from "./presentationDeckCoversDeps";

export function usePresentationDeckCovers(deps: PresentationDeckCoversDeps) {
  const depsRef = useLatestRef(deps);

  const [generatingCoverId, setGeneratingCoverId] = useState<string | null>(
    null,
  );
  const [coverImageCache, setCoverImageCache] = useState<
    Record<string, string>
  >({});
  const [homeFirstSlideReplicaBySavedId, setHomeFirstSlideReplicaBySavedId] =
    useState<Record<string, Slide | undefined>>({});
  const [
    homeFirstSlideReplicaDeckThemeBySavedId,
    setHomeFirstSlideReplicaDeckThemeBySavedId,
  ] = useState<Record<string, DeckVisualTheme | undefined>>({});
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
          const deckUrl = firstSlideDeckCoverImageUrl(saved.slides[0]);
          if (deckUrl) {
            setCoverImageCache((prev) => ({ ...prev, [meta.id]: deckUrl }));
            setHomeFirstSlideReplicaBySavedId((prev) => {
              const next = { ...prev };
              delete next[meta.id];
              return next;
            });
            setHomeFirstSlideReplicaDeckThemeBySavedId((prev) => {
              const next = { ...prev };
              delete next[meta.id];
              return next;
            });
          } else if (saved.slides[0]) {
            setCoverImageCache((prev) => {
              const next = { ...prev };
              delete next[meta.id];
              return next;
            });
            setHomeFirstSlideReplicaBySavedId((prev) => ({
              ...prev,
              [meta.id]: { ...saved.slides[0] },
            }));
            setHomeFirstSlideReplicaDeckThemeBySavedId((prev) => ({
              ...prev,
              [meta.id]: normalizeDeckVisualTheme(saved.deckVisualTheme),
            }));
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

  const persistUpdatedFirstSlide = useCallback(
    async (
      id: string,
      options: {
        imageUrl?: string;
        imagePrompt?: string;
      },
    ) => {
      const d = depsRef.current;
      const saved = await loadPresentation(id, d.localAccountScope);
      if (!saved.slides.length) {
        alert("Esta presentación no tiene diapositivas.");
        return null;
      }
      const firstSlide = saved.slides[0];
      const nextFirstSlide = { ...firstSlide };
      if (options.imageUrl?.trim()) {
        nextFirstSlide.imageUrl = options.imageUrl.trim();
        nextFirstSlide.imagePrompt = options.imagePrompt?.trim() || DECK_COVER_CUSTOM_IMAGE_PROMPT;
      } else {
        delete (nextFirstSlide as { imageUrl?: string }).imageUrl;
        delete (nextFirstSlide as { imagePrompt?: string }).imagePrompt;
      }
      const updatedSlides = [...saved.slides];
      updatedSlides[0] = nextFirstSlide;
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
      if (d.user) {
        void d.runAutoSyncAfterSaveRef.current(id);
      }
      return { saved, nextFirstSlide };
    },
    [],
  );

  const handleGenerateCoverForPresentation = useCallback(
    async (
      id: string,
      options?: {
        userPrompt?: string;
        referenceImageDataUrl?: string;
      },
    ) => {
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
            "La generación de portada usa Gemini. Configura tu API key de Gemini en Ajustes de la app.",
          );
          return;
        }
        const trimmedPrompt = options?.userPrompt?.trim();
        const userPrompt =
          trimmedPrompt && trimmedPrompt.length > 0
            ? trimmedPrompt
            : buildDeckCoverImageUserPrompt();
        const mascotReferenceImageDataUrl =
          await loadSlaimMascotCoverReferenceDataUrl();
        const imageUrl = await generateImageUseCase.run({
          providerId: "gemini",
          slideContext,
          userPrompt,
          stylePrompt: DECK_COVER_STYLE_PROMPT,
          includeBackground: true,
          modelId: d.geminiImageModelId,
          characterPrompt: trimmedPrompt
            ? undefined
            : SLAIM_MASCOT_COVER_CHARACTER_PROMPT,
          characterReferenceImageDataUrl:
            options?.referenceImageDataUrl ?? mascotReferenceImageDataUrl,
          aspectRatio: "16:9",
        });
        if (!imageUrl) {
          alert(
            "No se pudo generar la portada con Gemini. Comprueba tu API key y el modelo de imagen en Ajustes.",
          );
          return;
        }
        await persistUpdatedFirstSlide(id, {
          imageUrl,
          imagePrompt: trimmedPrompt
            ? `${DECK_COVER_CUSTOM_IMAGE_PROMPT} Prompt: ${trimmedPrompt}`
            : DECK_COVER_IMAGE_PROMPT,
        });
        setCoverImageCache((prev) => ({ ...prev, [id]: imageUrl }));
        setHomeFirstSlideReplicaBySavedId((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setHomeFirstSlideReplicaDeckThemeBySavedId((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        trackEvent(ANALYTICS_EVENTS.COVER_GENERATED);
      } catch (e) {
        console.error(e);
        alert(
          "Error al generar la portada. Comprueba la consola y tu configuración de API.",
        );
      } finally {
        setGeneratingCoverId(null);
      }
    },
    [persistUpdatedFirstSlide],
  );

  const handleUploadCoverForPresentation = useCallback(
    async (id: string, imageUrl: string, promptLabel?: string) => {
      const normalizedUrl = imageUrl.trim();
      if (!normalizedUrl) return;
      setGeneratingCoverId(id);
      try {
        const persisted = await persistUpdatedFirstSlide(id, {
          imageUrl: normalizedUrl,
          imagePrompt: promptLabel
            ? `${DECK_COVER_CUSTOM_IMAGE_PROMPT} ${promptLabel.trim()}`
            : DECK_COVER_CUSTOM_IMAGE_PROMPT,
        });
        if (!persisted) return;
        setCoverImageCache((prev) => ({ ...prev, [id]: normalizedUrl }));
        setHomeFirstSlideReplicaBySavedId((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setHomeFirstSlideReplicaDeckThemeBySavedId((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      } catch (e) {
        console.error(e);
        alert("No se pudo guardar la portada personalizada.");
      } finally {
        setGeneratingCoverId(null);
      }
    },
    [persistUpdatedFirstSlide],
  );

  const handleRemoveCoverForPresentation = useCallback(
    async (id: string) => {
      setGeneratingCoverId(id);
      try {
        const persisted = await persistUpdatedFirstSlide(id, {});
        if (!persisted) return;
        setCoverImageCache((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setHomeFirstSlideReplicaBySavedId((prev) => ({
          ...prev,
          [id]: persisted.nextFirstSlide,
        }));
        setHomeFirstSlideReplicaDeckThemeBySavedId((prev) => ({
          ...prev,
          [id]: normalizeDeckVisualTheme(persisted.saved.deckVisualTheme),
        }));
      } catch (e) {
        console.error(e);
        alert("No se pudo eliminar la portada.");
      } finally {
        setGeneratingCoverId(null);
      }
    },
    [persistUpdatedFirstSlide],
  );

  return {
    generatingCoverId,
    coverImageCache,
    setCoverImageCache,
    homeFirstSlideReplicaBySavedId,
    setHomeFirstSlideReplicaBySavedId,
    homeFirstSlideReplicaDeckThemeBySavedId,
    setHomeFirstSlideReplicaDeckThemeBySavedId,
    coverPrefetchSavedAtRef,
    handleGenerateCoverForPresentation,
    handleUploadCoverForPresentation,
    handleRemoveCoverForPresentation,
  };
}
