import type { MutableRefObject } from "react";
import type { User } from "firebase/auth";
import type { DeckVisualTheme } from "../../domain/entities";
import type { WebCloudEditSession } from "./webCloudSession";

export type PresentationSavePresentationDeps = {
  currentSavedId: string | null;
  setCurrentSavedId: (
    id: string | null | ((prev: string | null) => string | null),
  ) => void;
  deckVisualTheme: DeckVisualTheme;
  deckNarrativePresetId: string;
  narrativeNotes: string;
  setSaveMessage: (msg: string | null) => void;
  localAccountScope: string;
  lastOpenedSessionKey: string;
  autoCloudSyncOnSave: boolean;
  user: User | null;
  maybeAutoSyncAfterLocalSave: (localId: string) => Promise<void>;
  /** Solo web: push a Firestore sin fila SQLite. */
  webCloudSessionRef: MutableRefObject<WebCloudEditSession | null>;
};
