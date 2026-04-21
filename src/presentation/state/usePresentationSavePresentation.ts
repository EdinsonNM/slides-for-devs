import { useCallback, useRef } from "react";
import {
  savePresentation,
  updatePresentation,
} from "../../services/storage";
import { trackEvent, ANALYTICS_EVENTS } from "../../services/analytics";
import type { Presentation } from "../../types";
import type { SavePresentationNowPayload } from "./presentationDeckMutationsDeps";
import type { PresentationSavePresentationDeps } from "./presentationSavePresentationDeps";

export function usePresentationSavePresentation(
  deps: PresentationSavePresentationDeps,
) {
  const depsRef = useRef(deps);
  depsRef.current = deps;

  const savePresentationNow = useCallback(
    async (presentation: SavePresentationNowPayload): Promise<string | null> => {
      const d = depsRef.current;
      if (presentation.slides.length === 0) return null;
      const full: Presentation = {
        topic: presentation.topic,
        slides: presentation.slides,
        characterId: presentation.characterId,
        deckVisualTheme:
          presentation.deckVisualTheme ?? d.deckVisualTheme,
        deckNarrativePresetId:
          presentation.deckNarrativePresetId ?? d.deckNarrativePresetId,
        narrativeNotes:
          presentation.narrativeNotes !== undefined
            ? presentation.narrativeNotes?.trim() || undefined
            : d.narrativeNotes.trim() || undefined,
      };
      let savedId: string | null = null;
      try {
        if (d.currentSavedId) {
          await updatePresentation(
            d.currentSavedId,
            full,
            d.localAccountScope,
          );
          savedId = d.currentSavedId;
          d.setSaveMessage("Guardado");
          try {
            sessionStorage.setItem(
              d.lastOpenedSessionKey,
              d.currentSavedId,
            );
          } catch {
            /* ignore */
          }
        } else {
          const id = await savePresentation(full, d.localAccountScope);
          d.setCurrentSavedId(id);
          savedId = id;
          d.setSaveMessage("Guardado");
          try {
            sessionStorage.setItem(d.lastOpenedSessionKey, id);
          } catch {
            /* ignore */
          }
        }
        trackEvent(ANALYTICS_EVENTS.PRESENTATION_SAVED);
        setTimeout(() => d.setSaveMessage(null), 2000);
        if (
          savedId &&
          d.autoCloudSyncOnSave &&
          d.user &&
          typeof window !== "undefined" &&
          (window as unknown as { __TAURI__?: unknown }).__TAURI__
        ) {
          void d.maybeAutoSyncAfterLocalSave(savedId);
        }
      } catch (e) {
        console.error(e);
        d.setSaveMessage("Error al guardar");
        return null;
      }
      return savedId;
    },
    [],
  );

  return { savePresentationNow };
}
