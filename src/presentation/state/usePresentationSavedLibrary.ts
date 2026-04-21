import { useCallback, useMemo, useRef } from "react";
import {
  clearPresentationLocalBody,
  deletePresentation,
  listPresentations,
  loadPresentation,
} from "../../services/storage";
import { deleteOwnerPresentationFromCloud } from "../../services/presentationCloud";
import { formatCloudSyncUserMessage } from "../../utils/cloudSyncErrors";
import { DEFAULT_DECK_VISUAL_THEME } from "../../domain/entities";
import { presentationQueryKeys } from "../queryKeys";
import {
  applySavedPresentationToEditorState,
  type ApplySavedPresentationEditorContext,
} from "./applySavedPresentationToEditorState";
import { trackEvent, ANALYTICS_EVENTS } from "../../services/analytics";
import type { SavedPresentationMeta } from "../../types";
import type { PresentationSavedLibraryDeps } from "./presentationSavedLibraryDeps";

export function usePresentationSavedLibrary(deps: PresentationSavedLibraryDeps) {
  const depsRef = useRef(deps);
  depsRef.current = deps;

  const applySavedEditorCtxRef = useRef(
    {} as ApplySavedPresentationEditorContext,
  );
  applySavedEditorCtxRef.current = {
    slidesUndoRef: deps.slidesUndoRef,
    slidesRedoRef: deps.slidesRedoRef,
    setTopic: deps.setTopic,
    setSlides: deps.setSlides,
    setCurrentIndex: deps.setCurrentIndex,
    setCurrentSavedId: deps.setCurrentSavedId,
    setSelectedCharacterId: deps.setSelectedCharacterId,
    setDeckVisualThemeState: deps.setDeckVisualThemeState,
    setDeckNarrativePresetId: deps.setDeckNarrativePresetId,
    setNarrativeNotes: deps.setNarrativeNotes,
    coverPrefetchSavedAtRef: deps.coverPrefetchSavedAtRef,
    setCoverImageCache: deps.setCoverImageCache,
  };

  const openSavedListModal = useCallback(async () => {
    const x = depsRef.current;
    x.setShowSavedListModal(true);
    try {
      await x.refetchSavedPresentationsForModal();
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleOpenSaved = useCallback(async (id: string) => {
    const x = depsRef.current;
    try {
      let metaOpen: SavedPresentationMeta | undefined;
      try {
        const listFresh = await listPresentations(x.localAccountScope);
        metaOpen = listFresh.find((p) => p.id === id);
        x.queryClient.setQueryData(
          presentationQueryKeys.savedPresentations(x.localAccountScope),
          listFresh,
        );
      } catch {
        metaOpen = x.savedList.find((p) => p.id === id);
      }
      if (metaOpen?.localBodyCleared && !x.user) {
        alert("Inicia sesión para recuperar la copia desde la nube.");
        return;
      }
      try {
        await x.maybePullCloudPresentationBeforeLoad(id, metaOpen);
      } catch (e) {
        if (metaOpen?.localBodyCleared) {
          console.error(e);
          alert(
            `No se pudo recuperar desde la nube: ${formatCloudSyncUserMessage(e)}`,
          );
          return;
        }
      }
      const saved = await loadPresentation(id, x.localAccountScope);
      applySavedPresentationToEditorState(saved, applySavedEditorCtxRef.current);
      x.setShowSavedListModal(false);
      try {
        sessionStorage.setItem(x.lastOpenedSessionKey, id);
      } catch {
        // ignore
      }
      trackEvent(ANALYTICS_EVENTS.PRESENTATION_OPENED);
    } catch (e) {
      console.error(e);
      alert("No se pudo abrir la presentación.");
    }
  }, []);

  const restoreLastOpenedPresentation =
    useCallback(async (): Promise<boolean> => {
      const x = depsRef.current;
      let id: string | null = null;
      try {
        id = sessionStorage.getItem(x.lastOpenedSessionKey);
      } catch {
        return false;
      }
      if (!id) return false;
      try {
        if (x.user) {
          let metaRestore: SavedPresentationMeta | undefined;
          try {
            const list = await listPresentations(x.localAccountScope);
            metaRestore = list.find((p) => p.id === id);
          } catch {
            metaRestore = undefined;
          }
          try {
            await x.maybePullCloudPresentationBeforeLoad(id, metaRestore);
          } catch {
            /* cuerpo vacío: sin sesión o fallo de red; se sigue con copia local si existe */
          }
        }
        const saved = await loadPresentation(id, x.localAccountScope);
        applySavedPresentationToEditorState(
          saved,
          applySavedEditorCtxRef.current,
        );
        return true;
      } catch {
        try {
          sessionStorage.removeItem(x.lastOpenedSessionKey);
        } catch {
          // ignore
        }
        return false;
      }
    }, []);

  const requestDeletePresentation = useCallback((id: string) => {
    depsRef.current.setDeletePresentationId(id);
  }, []);

  const closeDeletePresentationModal = useCallback(() => {
    depsRef.current.setDeletePresentationId(null);
  }, []);

  const deletePresentationTarget = useMemo((): SavedPresentationMeta | null => {
    const id = depsRef.current.deletePresentationId;
    if (!id) return null;
    return depsRef.current.savedList.find((p) => p.id === id) ?? null;
  }, [deps.deletePresentationId, deps.savedList]);

  const confirmDeletePresentationLocalOnly = useCallback(async () => {
    const x = depsRef.current;
    const id = x.deletePresentationId;
    if (!id) return;
    try {
      await deletePresentation(id, x.localAccountScope);
      if (x.currentSavedId === id) {
        x.setCurrentSavedId(null);
        x.setTopic("");
        x.slidesUndoRef.current = [];
        x.slidesRedoRef.current = [];
        x.setSlides([]);
        x.setDeckVisualThemeState(DEFAULT_DECK_VISUAL_THEME);
      }
      x.queryClient.setQueryData(
        presentationQueryKeys.savedPresentations(x.localAccountScope),
        (prev: SavedPresentationMeta[] | undefined) =>
          (prev ?? []).filter((p) => p.id !== id),
      );
      delete x.coverPrefetchSavedAtRef.current[id];
      x.setCoverImageCache((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (e) {
      console.error(e);
      alert("Error al eliminar.");
    } finally {
      x.setDeletePresentationId(null);
    }
  }, []);

  const confirmClearPresentationLocalKeepCloud = useCallback(async () => {
    const x = depsRef.current;
    const id = x.deletePresentationId;
    if (!id) return;
    try {
      await clearPresentationLocalBody(id, x.localAccountScope);
      await x.refreshSavedList();
      if (x.currentSavedId === id) {
        x.setCurrentSavedId(null);
        x.setTopic("");
        x.slidesUndoRef.current = [];
        x.slidesRedoRef.current = [];
        x.setSlides([]);
        x.setDeckVisualThemeState(DEFAULT_DECK_VISUAL_THEME);
      }
      delete x.coverPrefetchSavedAtRef.current[id];
      x.setCoverImageCache((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (e) {
      console.error(e);
      alert(
        e instanceof Error && e.message
          ? e.message
          : "No se pudo quitar la copia local.",
      );
    } finally {
      x.setDeletePresentationId(null);
    }
  }, []);

  const confirmDeletePresentationLocalAndCloud = useCallback(async () => {
    const x = depsRef.current;
    const id = x.deletePresentationId;
    if (!id) return;
    try {
      let cloudId: string | null = null;
      try {
        const list = await listPresentations(x.localAccountScope);
        cloudId = list.find((p) => p.id === id)?.cloudId?.trim() ?? null;
      } catch {
        /* ignore */
      }
      if (cloudId && x.user) {
        await deleteOwnerPresentationFromCloud(x.user.uid, cloudId);
      }
      await deletePresentation(id, x.localAccountScope);
      if (x.currentSavedId === id) {
        x.setCurrentSavedId(null);
        x.setTopic("");
        x.slidesUndoRef.current = [];
        x.slidesRedoRef.current = [];
        x.setSlides([]);
        x.setDeckVisualThemeState(DEFAULT_DECK_VISUAL_THEME);
      }
      x.queryClient.setQueryData(
        presentationQueryKeys.savedPresentations(x.localAccountScope),
        (prev: SavedPresentationMeta[] | undefined) =>
          (prev ?? []).filter((p) => p.id !== id),
      );
      delete x.coverPrefetchSavedAtRef.current[id];
      x.setCoverImageCache((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (e) {
      console.error(e);
      alert(`Error al eliminar: ${formatCloudSyncUserMessage(e)}`);
    } finally {
      x.setDeletePresentationId(null);
    }
  }, []);

  return {
    openSavedListModal,
    handleOpenSaved,
    restoreLastOpenedPresentation,
    requestDeletePresentation,
    closeDeletePresentationModal,
    deletePresentationTarget,
    confirmDeletePresentationLocalOnly,
    confirmClearPresentationLocalKeepCloud,
    confirmDeletePresentationLocalAndCloud,
  };
}
