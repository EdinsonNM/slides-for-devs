import type { Slide } from "../../types";
import type { DeckVisualTheme } from "../../domain/entities";

/** Clave para persistir el id de la última presentación abierta (restaurar al refrescar en /editor). */
export const LAST_OPENED_PRESENTATION_KEY = "slides-for-devs-last-opened";

export type HomeTab = "recent" | "mine" | "templates";

/** Estado de una pestaña del editor (varias presentaciones abiertas en memoria). */
export type EditorWorkspaceSnapshot = {
  topic: string;
  slides: Slide[];
  currentIndex: number;
  currentSavedId: string | null;
  selectedCharacterId: string | null;
  deckVisualTheme: DeckVisualTheme;
  deckNarrativePresetId?: string;
  narrativeNotes?: string;
};

export type EditorTab = {
  id: string;
  title: string;
};
