import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { SavedPresentationMeta, Slide } from "../../types";
import type { DeckVisualTheme } from "../../domain/entities";
import type { WebCloudEditSession } from "./webCloudSession";

export type PresentationSavedLibraryDeps = {
  queryClient: QueryClient;
  localAccountScope: string;
  savedList: SavedPresentationMeta[];
  user: { uid: string } | null;
  lastOpenedSessionKey: string;
  maybePullCloudPresentationBeforeLoad: (
    localId: string,
    meta: SavedPresentationMeta | undefined,
  ) => Promise<void>;
  openSavedPresentationRef: MutableRefObject<(id: string) => Promise<void>>;
  refetchSavedPresentationsForModal: () => Promise<unknown>;
  setShowSavedListModal: (open: boolean) => void;
  deletePresentationId: string | null;
  setDeletePresentationId: (id: string | null) => void;
  /** Metadatos capturados al abrir el modal de borrado (evita título genérico si la lista se refresca). */
  deletePresentationSnapshot: SavedPresentationMeta | null;
  setDeletePresentationSnapshot: (
    meta: SavedPresentationMeta | null,
  ) => void;
  currentSavedId: string | null;
  setCurrentSavedId: (
    id: string | null | ((prev: string | null) => string | null),
  ) => void;
  setTopic: (topic: string | ((prev: string) => string)) => void;
  setSlides: (slides: Slide[] | ((prev: Slide[]) => Slide[])) => void;
  slidesUndoRef: MutableRefObject<Slide[][]>;
  slidesRedoRef: MutableRefObject<Slide[][]>;
  setCurrentIndex: (index: number | ((prev: number) => number)) => void;
  setSelectedCharacterId: (
    id: string | null | ((prev: string | null) => string | null),
  ) => void;
  setDeckVisualThemeState: (
    theme: DeckVisualTheme | ((prev: DeckVisualTheme) => DeckVisualTheme),
  ) => void;
  setDeckNarrativePresetId: (id: string | ((prev: string) => string)) => void;
  setNarrativeNotes: (notes: string | ((prev: string) => string)) => void;
  coverPrefetchSavedAtRef: MutableRefObject<Record<string, string>>;
  setCoverImageCache: Dispatch<SetStateAction<Record<string, string>>>;
  setHomeFirstSlideReplicaBySavedId: Dispatch<
    SetStateAction<Record<string, Slide | undefined>>
  >;
  setHomeFirstSlideReplicaDeckThemeBySavedId: Dispatch<
    SetStateAction<Record<string, DeckVisualTheme | undefined>>
  >;
  refreshSavedList: () => Promise<void>;
  webCloudSessionRef: MutableRefObject<WebCloudEditSession | null>;
};
