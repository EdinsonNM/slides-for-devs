import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { DeckVisualTheme } from "../../domain/entities";
import { normalizeDeckVisualTheme } from "../../domain/entities";
import { DEFAULT_DECK_NARRATIVE_PRESET_ID } from "../../constants/presentationNarrativePresets";
import { normalizeSlidesCanvasScenes } from "../../domain/slideCanvas/ensureSlideCanvasScene";
import { formatMarkdown } from "../../utils/markdown";
import { firstSlideHomePreviewImageUrl } from "../../constants/deckCover";
import type { SavedPresentation, Slide } from "../../types";

export type ApplySavedPresentationEditorContext = {
  slidesUndoRef: MutableRefObject<Slide[][]>;
  slidesRedoRef: MutableRefObject<Slide[][]>;
  setTopic: (topic: string | ((prev: string) => string)) => void;
  setSlides: (slides: Slide[] | ((prev: Slide[]) => Slide[])) => void;
  setCurrentIndex: (index: number | ((prev: number) => number)) => void;
  setCurrentSavedId: (
    id: string | null | ((prev: string | null) => string | null),
  ) => void;
  setSelectedCharacterId: (
    id: string | null | ((prev: string | null) => string | null),
  ) => void;
  setDeckVisualThemeState: (
    theme: DeckVisualTheme | ((prev: DeckVisualTheme) => DeckVisualTheme),
  ) => void;
  setDeckNarrativePresetId: (
    id: string | ((prev: string) => string),
  ) => void;
  setNarrativeNotes: (notes: string | ((prev: string) => string)) => void;
  coverPrefetchSavedAtRef: MutableRefObject<Record<string, string>>;
  setCoverImageCache: Dispatch<SetStateAction<Record<string, string>>>;
};

/**
 * Vuelca una presentación cargada desde storage al estado del editor (slides nuevos ids,
 * markdown del cuerpo, tema, portada en caché).
 */
export function applySavedPresentationToEditorState(
  saved: SavedPresentation,
  ctx: ApplySavedPresentationEditorContext,
): void {
  ctx.slidesUndoRef.current = [];
  ctx.slidesRedoRef.current = [];
  ctx.setTopic(saved.topic);
  ctx.setSlides(
    normalizeSlidesCanvasScenes(
      saved.slides.map((s) => ({
        ...s,
        id: crypto.randomUUID(),
        content: formatMarkdown(s.content ?? ""),
      })),
    ),
  );
  ctx.setCurrentIndex(0);
  ctx.setCurrentSavedId(saved.id);
  ctx.setSelectedCharacterId(saved.characterId ?? null);
  ctx.setDeckVisualThemeState(normalizeDeckVisualTheme(saved.deckVisualTheme));
  ctx.setDeckNarrativePresetId(
    saved.deckNarrativePresetId ?? DEFAULT_DECK_NARRATIVE_PRESET_ID,
  );
  ctx.setNarrativeNotes(saved.narrativeNotes ?? "");
  ctx.coverPrefetchSavedAtRef.current[saved.id] = saved.savedAt;
  const coverUrl = firstSlideHomePreviewImageUrl(saved.slides[0]);
  if (coverUrl) {
    ctx.setCoverImageCache((prev) => ({ ...prev, [saved.id]: coverUrl }));
  }
}
