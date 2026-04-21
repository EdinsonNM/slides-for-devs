import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { DeckVisualTheme } from "../../domain/entities";
import { normalizeDeckVisualTheme } from "../../domain/entities";
import { DEFAULT_DECK_NARRATIVE_PRESET_ID } from "../../constants/presentationNarrativePresets";
import { normalizeSlidesCanvasScenes } from "../../domain/slideCanvas/ensureSlideCanvasScene";
import { formatMarkdown } from "../../utils/markdown";
import { firstSlideDeckCoverImageUrl } from "../../constants/deckCover";
import type { SavedPresentation, Slide } from "../../types";
import { clampEditorSlideIndex } from "../../constants/editorNavigation";

export type ApplySavedPresentationOptions = {
  /** Índice 0-based del slide inicial (p. ej. desde `?slide=` en la URL). */
  initialSlideIndex?: number;
};

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
  setHomeFirstSlideReplicaBySavedId: Dispatch<
    SetStateAction<Record<string, Slide | undefined>>
  >;
  setHomeFirstSlideReplicaDeckThemeBySavedId: Dispatch<
    SetStateAction<Record<string, DeckVisualTheme | undefined>>
  >;
};

/**
 * Vuelca una presentación cargada desde storage al estado del editor (slides nuevos ids,
 * markdown del cuerpo, tema, portada en caché).
 */
export function applySavedPresentationToEditorState(
  saved: SavedPresentation,
  ctx: ApplySavedPresentationEditorContext,
  options?: ApplySavedPresentationOptions,
): void {
  ctx.slidesUndoRef.current = [];
  ctx.slidesRedoRef.current = [];
  ctx.setTopic(saved.topic);
  const normalizedSlides = normalizeSlidesCanvasScenes(
    saved.slides.map((s) => ({
      ...s,
      id: crypto.randomUUID(),
      content: formatMarkdown(s.content ?? ""),
    })),
  );
  ctx.setSlides(normalizedSlides);
  const slideCount = normalizedSlides.length;
  const initialIndex =
    options?.initialSlideIndex !== undefined && slideCount > 0
      ? clampEditorSlideIndex(options.initialSlideIndex, slideCount)
      : 0;
  ctx.setCurrentIndex(slideCount > 0 ? initialIndex : 0);
  ctx.setCurrentSavedId(saved.id);
  ctx.setSelectedCharacterId(saved.characterId ?? null);
  ctx.setDeckVisualThemeState(normalizeDeckVisualTheme(saved.deckVisualTheme));
  ctx.setDeckNarrativePresetId(
    saved.deckNarrativePresetId ?? DEFAULT_DECK_NARRATIVE_PRESET_ID,
  );
  ctx.setNarrativeNotes(saved.narrativeNotes ?? "");
  ctx.coverPrefetchSavedAtRef.current[saved.id] = saved.savedAt;
  const deckCoverUrl = firstSlideDeckCoverImageUrl(saved.slides[0]);
  if (deckCoverUrl) {
    ctx.setCoverImageCache((prev) => ({ ...prev, [saved.id]: deckCoverUrl }));
    ctx.setHomeFirstSlideReplicaBySavedId((prev) => {
      const next = { ...prev };
      delete next[saved.id];
      return next;
    });
    ctx.setHomeFirstSlideReplicaDeckThemeBySavedId((prev) => {
      const next = { ...prev };
      delete next[saved.id];
      return next;
    });
  } else if (saved.slides[0]) {
    ctx.setCoverImageCache((prev) => {
      const next = { ...prev };
      delete next[saved.id];
      return next;
    });
    ctx.setHomeFirstSlideReplicaBySavedId((prev) => ({
      ...prev,
      [saved.id]: { ...saved.slides[0] },
    }));
    ctx.setHomeFirstSlideReplicaDeckThemeBySavedId((prev) => ({
      ...prev,
      [saved.id]: normalizeDeckVisualTheme(saved.deckVisualTheme),
    }));
  }
}
