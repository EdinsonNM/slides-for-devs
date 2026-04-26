import { useCallback } from "react";
import { useLatestRef } from "./useLatestRef";
import {
  importSavedPresentation,
  savePresentation,
  setPresentationSyncState,
  setPresentationCloudState,
  updatePresentation,
} from "../../services/storage";
import {
  pushPresentationToCloud,
  CloudSyncConflictError,
} from "../../services/presentationCloud";
import { trackEvent, ANALYTICS_EVENTS } from "../../services/analytics";
import { formatCloudSyncUserMessage } from "../../utils/cloudSyncErrors";
import { isTauriRuntime } from "../../utils/isTauriRuntime";
import type { Presentation, SavedPresentation } from "../../types";
import type { SavePresentationNowPayload } from "./presentationDeckMutationsDeps";
import type { PresentationSavePresentationDeps } from "./presentationSavePresentationDeps";

export function usePresentationSavePresentation(
  deps: PresentationSavePresentationDeps,
) {
  const depsRef = useLatestRef(deps);

  const savePresentationNow = useCallback(
    async (presentation: SavePresentationNowPayload): Promise<string | null> => {
      const d = depsRef.current;
      if (presentation.slides.length === 0) return null;
      if (d.isCurrentPresentationReadOnly) {
        d.setSaveMessage("Esta presentación está en modo lectura.");
        setTimeout(() => d.setSaveMessage(null), 2500);
        return null;
      }
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
        presentationReadme:
          presentation.presentationReadme !== undefined
            ? presentation.presentationReadme?.trim() || undefined
            : d.presentationReadme.trim() || undefined,
      };
      const dirtySlideIds = full.slides.map((slide) => slide.id);
      let savedId: string | null = null;
      try {
        if (d.currentSavedId) {
          await updatePresentation(
            d.currentSavedId,
            full,
            d.localAccountScope,
          );
          savedId = d.currentSavedId;
          await setPresentationSyncState(
            d.currentSavedId,
            {
              dirtySlideIds,
              syncStatus: d.user ? "pending" : "offline",
            },
            d.localAccountScope,
          );
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
          const ws = d.webCloudSessionRef.current;
          if (!isTauriRuntime() && d.user) {
            const provisionalCloudId =
              ws?.cloudId ??
              (typeof crypto !== "undefined" && "randomUUID" in crypto
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`);
            const createdOptimisticSession = !ws?.cloudId;
            if (createdOptimisticSession) {
              d.webCloudSessionRef.current = {
                ownerUid: d.user.uid,
                cloudId: provisionalCloudId,
                cloudRevision: 0,
              };
            }
            const saved: SavedPresentation = {
              ...full,
              id: `${d.user.uid}::${provisionalCloudId}`,
              savedAt: new Date().toISOString(),
            };
            try {
              const { cloudId, newRevision } = await pushPresentationToCloud(
                d.user.uid,
                saved,
                provisionalCloudId,
                {
                  localExpectedRevision: ws?.cloudRevision ?? null,
                },
              );
              d.webCloudSessionRef.current = {
                ownerUid: d.user.uid,
                cloudId,
                cloudRevision: newRevision,
              };
              const localId = `${d.user.uid}::${cloudId}`;
              await importSavedPresentation(
                {
                  ...full,
                  id: localId,
                  savedAt: new Date().toISOString(),
                },
                d.localAccountScope,
              );
              await setPresentationCloudState(
                localId,
                cloudId,
                new Date().toISOString(),
                newRevision,
                d.localAccountScope,
              );
              await setPresentationSyncState(
                localId,
                {
                  dirtySlideIds: [],
                  syncStatus: "synced",
                  lastSyncedRevision: newRevision,
                },
                d.localAccountScope,
              );
              d.setCurrentSavedId(localId);
            } catch (e) {
              if (createdOptimisticSession) {
                d.webCloudSessionRef.current = null;
              }
              if (e instanceof CloudSyncConflictError) {
                d.setSaveMessage(
                  `Conflicto con la nube: remoto rev. ${e.remoteRevision}. Recarga la página o abre de nuevo desde el inicio.`,
                );
              } else {
                console.error(e);
                d.setSaveMessage(
                  `Error al guardar en la nube: ${formatCloudSyncUserMessage(e)}`,
                );
              }
              setTimeout(() => d.setSaveMessage(null), 4500);
              return null;
            }
            d.setSaveMessage("Guardado en la nube");
            try {
              sessionStorage.removeItem(d.lastOpenedSessionKey);
            } catch {
              /* ignore */
            }
            trackEvent(ANALYTICS_EVENTS.PRESENTATION_SAVED);
            setTimeout(() => d.setSaveMessage(null), 2000);
            return null;
          }
          const id = await savePresentation(full, d.localAccountScope);
          d.setCurrentSavedId(id);
          savedId = id;
          await setPresentationSyncState(
            id,
            {
              dirtySlideIds,
              syncStatus: d.user ? "pending" : "offline",
            },
            d.localAccountScope,
          );
          d.setSaveMessage("Guardado");
          try {
            sessionStorage.setItem(d.lastOpenedSessionKey, id);
          } catch {
            /* ignore */
          }
        }
        trackEvent(ANALYTICS_EVENTS.PRESENTATION_SAVED);
        setTimeout(() => d.setSaveMessage(null), 2000);
        if (savedId && d.user) {
          void d.maybeAutoSyncAfterLocalSave(savedId);
        }
      } catch (e) {
        console.error(e);
        if (
          !isTauriRuntime() &&
          !d.currentSavedId &&
          !d.webCloudSessionRef.current
        ) {
          d.setSaveMessage("Error al guardar en la nube.");
          setTimeout(() => d.setSaveMessage(null), 4500);
        } else {
          d.setSaveMessage("Error al guardar");
          setTimeout(() => d.setSaveMessage(null), 2500);
        }
        return null;
      }
      return savedId;
    },
    [],
  );

  return { savePresentationNow };
}
