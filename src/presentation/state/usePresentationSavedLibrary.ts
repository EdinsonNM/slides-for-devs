import { useCallback, useMemo, useRef } from "react";
import { useLatestRef } from "./useLatestRef";
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
import { readEditorSlideIndexFromHash } from "../../constants/editorNavigation";
import type { SavedPresentationMeta } from "../../types";
import type { PresentationSavedLibraryDeps } from "./presentationSavedLibraryDeps";

export function usePresentationSavedLibrary(deps: PresentationSavedLibraryDeps) {
  const depsRef = useLatestRef(deps);

  const applySavedEditorCtxRef = useLatestRef<ApplySavedPresentationEditorContext>(
    {
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
      setPresentationReadme: deps.setPresentationReadme,
      coverPrefetchSavedAtRef: deps.coverPrefetchSavedAtRef,
      setCoverImageCache: deps.setCoverImageCache,
      setHomeFirstSlideReplicaBySavedId: deps.setHomeFirstSlideReplicaBySavedId,
      setHomeFirstSlideReplicaDeckThemeBySavedId:
        deps.setHomeFirstSlideReplicaDeckThemeBySavedId,
    },
  );

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
    x.webCloudSessionRef.current = null;
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
      const urlSlide = readEditorSlideIndexFromHash();
      applySavedPresentationToEditorState(
        saved,
        applySavedEditorCtxRef.current,
        urlSlide !== null ? { initialSlideIndex: urlSlide } : undefined,
      );
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
      x.webCloudSessionRef.current = null;
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
        const urlSlide = readEditorSlideIndexFromHash();
        applySavedPresentationToEditorState(
          saved,
          applySavedEditorCtxRef.current,
          urlSlide !== null ? { initialSlideIndex: urlSlide } : undefined,
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
    const x = depsRef.current;
    const meta = x.savedList.find((p) => p.id === id);
    x.setDeletePresentationSnapshot(
      meta ?? {
        id,
        topic: "Presentación",
        savedAt: new Date().toISOString(),
        slideCount: 0,
      },
    );
    x.setDeletePresentationId(id);
  }, []);

  const closeDeletePresentationModal = useCallback(() => {
    const x = depsRef.current;
    x.setDeletePresentationId(null);
    x.setDeletePresentationSnapshot(null);
  }, []);

  const deletePresentationTarget = useMemo((): SavedPresentationMeta | null => {
    const id = deps.deletePresentationId;
    if (!id) return null;
    const snap = deps.deletePresentationSnapshot;
    if (snap && snap.id === id) return snap;
    const fromList = deps.savedList.find((p) => p.id === id);
    if (fromList) return fromList;
    return {
      id,
      topic: "Presentación",
      savedAt: new Date().toISOString(),
      slideCount: 0,
    };
  }, [
    deps.deletePresentationId,
    deps.deletePresentationSnapshot,
    deps.savedList,
  ]);

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
      x.setDeletePresentationSnapshot(null);
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
          : "No se pudo quitar la caché offline.",
      );
    } finally {
      x.setDeletePresentationId(null);
      x.setDeletePresentationSnapshot(null);
    }
  }, []);

  const confirmDeletePresentationLocalAndCloud = useCallback(async () => {
    const x = depsRef.current;
    const id = x.deletePresentationId;
    if (!id) return;
    try {
      const snapCloud = x.deletePresentationSnapshot?.cloudId?.trim();
      let cloudId: string | null = snapCloud ?? null;
      if (!cloudId) {
        try {
          const list = await listPresentations(x.localAccountScope);
          cloudId = list.find((p) => p.id === id)?.cloudId?.trim() ?? null;
        } catch {
          /* ignore */
        }
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
      x.setDeletePresentationSnapshot(null);
    }
  }, []);

  const confirmDeletePresentationEverywhere = useCallback(async () => {
    await confirmDeletePresentationLocalAndCloud();
  }, [confirmDeletePresentationLocalAndCloud]);

  return {
    openSavedListModal,
    handleOpenSaved,
    restoreLastOpenedPresentation,
    requestDeletePresentation,
    closeDeletePresentationModal,
    deletePresentationTarget,
    confirmDeletePresentationEverywhere,
  };
}
