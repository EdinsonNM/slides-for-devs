import type { MutableRefObject } from "react";
import type { SavedPresentationMeta, Slide } from "../../types";
import type { DeckVisualTheme } from "../../domain/entities";
import type { ApplySavedPresentationEditorContext } from "./applySavedPresentationToEditorState";
import type { WebCloudEditSession } from "./webCloudSession";

export type PresentationCloudSyncConflict = {
  localId: string;
  cloudId: string;
  expectedRevision: number;
  remoteRevision: number;
  localSlideCount?: number;
  remoteSlideCount?: number;
};

/** Lectura al resolver conflicto (remoto gana): estado del editor en el orquestador. */
export type PresentationCloudResolveRemoteEditorDeps = {
  currentSavedId: string | null;
  setTopic: (topic: string | ((prev: string) => string)) => void;
  slidesUndoRef: MutableRefObject<Slide[][]>;
  slidesRedoRef: MutableRefObject<Slide[][]>;
  setSlides: (slides: Slide[] | ((prev: Slide[]) => Slide[])) => void;
  setSelectedCharacterId: (id: string | null) => void;
  setDeckVisualThemeState: (theme: DeckVisualTheme) => void;
  setDeckNarrativePresetId: (id: string) => void;
  setNarrativeNotes: (notes: string) => void;
  formatMarkdown: (markdown: string) => string;
};

export type PresentationCloudPresentationDeps = {
  user: { uid: string } | null;
  localAccountScope: string;
  autoCloudSyncOnSave: boolean;
  savedList: SavedPresentationMeta[];
  refreshSavedList: () => Promise<void>;
  /** `handleOpenSaved` del orquestador (se asigna al ref cada render). */
  openSavedPresentationRef: MutableRefObject<(id: string) => Promise<void>>;
  resolveRemoteEditorDepsRef: MutableRefObject<PresentationCloudResolveRemoteEditorDeps | null>;
  /** Contexto para volcar una pull de nube al editor en navegador (sin SQLite). */
  applySavedPresentationForCloudWebRef: MutableRefObject<
    ApplySavedPresentationEditorContext | null
  >;
  /** Revisión y vínculo Firestore tras abrir “solo nube” en web. */
  webCloudSessionRef: MutableRefObject<WebCloudEditSession | null>;
};
