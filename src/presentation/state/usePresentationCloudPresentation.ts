import { useCallback, useRef, useState } from "react";
import { useLatestRef } from "./useLatestRef";
import {
  importSavedPresentation,
  listPresentations,
  loadPresentation,
  setPresentationCloudState,
  setPresentationSyncState,
  setPresentationSharedCloudSource,
  updatePresentation,
} from "../../services/storage";
import {
  deleteOwnerPresentationFromCloud,
  pushPresentationToCloud,
  pullPresentationFromCloud,
  CloudSyncConflictError,
  getCloudPresentationRevision,
  resolvePresentationCloudRef,
  type PulledPresentation,
} from "../../services/presentationCloud";
import { initFirebase } from "../../services/firebase";
import { formatCloudSyncUserMessage } from "../../utils/cloudSyncErrors";
import { isTauriRuntime } from "../../utils/isTauriRuntime";
import { normalizeDeckVisualTheme } from "../../domain/entities";
import { normalizeSlidesCanvasScenes } from "../../domain/slideCanvas/ensureSlideCanvasScene";
import type { SavedPresentation, SavedPresentationMeta } from "../../types";
import { applySavedPresentationToEditorState } from "./applySavedPresentationToEditorState";
import { readEditorSlideIndexFromHash } from "../../constants/editorNavigation";
import type {
  PresentationCloudPresentationDeps,
  PresentationCloudSyncConflict,
} from "./presentationCloudPresentationDeps";
import { DEFAULT_DECK_NARRATIVE_PRESET_ID } from "../../constants/presentationNarrativePresets";

export function usePresentationCloudPresentation(
  deps: PresentationCloudPresentationDeps,
) {
  const depsRef = useLatestRef(deps);

  const [syncingToCloudId, setSyncingToCloudId] = useState<string | null>(null);
  const [downloadingCloudKey, setDownloadingCloudKey] = useState<string | null>(
    null,
  );
  const [sharePresentationLocalId, setSharePresentationLocalId] = useState<
    string | null
  >(null);
  const [cloudSyncConflict, setCloudSyncConflict] =
    useState<PresentationCloudSyncConflict | null>(null);
  const cloudSyncConflictRef = useLatestRef(cloudSyncConflict);

  const conflictResolvingRef = useRef(false);
  const presentationCloudPushTailRef = useRef(
    new Map<string, Promise<void>>(),
  );

  const enqueuePresentationCloudPush = useCallback(
    (localId: string, task: () => Promise<void>): Promise<void> => {
      const map = presentationCloudPushTailRef.current;
      const prev = map.get(localId) ?? Promise.resolve();
      const next = prev.catch(() => {}).then(() => task());
      map.set(localId, next);
      return next;
    },
    [],
  );

  const maybeAutoSyncAfterLocalSave = useCallback(async (localId: string) => {
    const d = depsRef.current;
    if (!d.user) return;
    if (conflictResolvingRef.current) return;
    if (typeof window === "undefined") return;
    const fb = await initFirebase();
    if (!fb?.firestore) return;
    void enqueuePresentationCloudPush(localId, async () => {
      try {
        const list = await listPresentations(d.localAccountScope);
        const meta = list.find((p) => p.id === localId);
        if (!meta || meta.slideCount === 0 || meta.localBodyCleared) return;
        const saved = await loadPresentation(localId, d.localAccountScope);
        const existingCloudId = meta?.cloudId ?? null;
        const { cloudId, syncedAt, newRevision } =
          await pushPresentationToCloud(d.user.uid, saved, existingCloudId, {
            localExpectedRevision:
              existingCloudId != null ? (meta?.cloudRevision ?? 0) : null,
          });
        await setPresentationCloudState(
          localId,
          cloudId,
          syncedAt,
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
        await d.refreshSavedList();
      } catch (e) {
        if (e instanceof CloudSyncConflictError) {
          try {
            const list2 = await listPresentations(d.localAccountScope);
            const meta2 = list2.find((p) => p.id === localId);
            const cid = meta2?.cloudId;
            if (!cid) return;
            const saved = await loadPresentation(localId, d.localAccountScope);
            const { cloudId, syncedAt, newRevision } =
              await pushPresentationToCloud(d.user.uid, saved, cid, {
                localExpectedRevision: 0,
                force: true,
              });
            await setPresentationCloudState(
              localId,
              cloudId,
              syncedAt,
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
            await d.refreshSavedList();
          } catch (retryErr) {
            console.error("Auto-sync retry tras conflicto:", retryErr);
            await setPresentationSyncState(
              localId,
              { syncStatus: "conflict" },
              d.localAccountScope,
            ).catch(() => {});
          }
        } else {
          console.error("Auto-sync nube:", e);
          await setPresentationSyncState(
            localId,
            { syncStatus: "offline" },
            d.localAccountScope,
          ).catch(() => {});
        }
      }
    });
  }, [enqueuePresentationCloudPush]);

  const handleSyncPresentationToCloud = useCallback(
    async (localId: string) => {
      const d = depsRef.current;
      if (!d.user) {
        alert("Inicia sesión para sincronizar con la nube.");
        return;
      }
      const fb = await initFirebase();
      if (!fb?.firestore) {
        alert("Firebase no está configurado.");
        return;
      }
      try {
        const listPre = await listPresentations(d.localAccountScope);
        const preMeta = listPre.find((p) => p.id === localId);
        if (preMeta?.localBodyCleared) {
          alert(
            "Recupera la caché offline desde la nube (abre la tarjeta) antes de sincronizar.",
          );
          return;
        }
      } catch {
        /* continuar; el push volverá a leer */
      }
      try {
        await enqueuePresentationCloudPush(localId, async () => {
          setSyncingToCloudId(localId);
          try {
            const list = await listPresentations(d.localAccountScope);
            const meta = list.find((p) => p.id === localId);
            const saved = await loadPresentation(localId, d.localAccountScope);
            const existingCloudId = meta?.cloudId ?? null;
            const { cloudId, syncedAt, newRevision } =
              await pushPresentationToCloud(d.user.uid, saved, existingCloudId, {
                localExpectedRevision:
                  existingCloudId != null ? (meta?.cloudRevision ?? 0) : null,
              });
            await setPresentationCloudState(
              localId,
              cloudId,
              syncedAt,
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
            await d.refreshSavedList();
          } catch (e) {
            if (e instanceof CloudSyncConflictError) {
              const list = await listPresentations(d.localAccountScope).catch(
                () => [],
              );
              const meta = list.find((p) => p.id === localId);
              setCloudSyncConflict({
                localId,
                cloudId: meta?.cloudId ?? "",
                expectedRevision: e.expectedRevision,
                remoteRevision: e.remoteRevision,
                localSlideCount: meta?.slideCount,
                remoteSlideCount: e.remoteSlideCount,
              });
              await setPresentationSyncState(
                localId,
                { syncStatus: "conflict" },
                d.localAccountScope,
              ).catch(() => {});
            } else {
              console.error(e);
              await setPresentationSyncState(
                localId,
                { syncStatus: "offline" },
                d.localAccountScope,
              ).catch(() => {});
              alert(
                `No se pudo sincronizar: ${formatCloudSyncUserMessage(e)}`,
              );
            }
          } finally {
            setSyncingToCloudId(null);
          }
        });
      } catch (e) {
        console.error(e);
      }
    },
    [enqueuePresentationCloudPush],
  );

  const rehydratePresentationFromMyCloud = useCallback(
    async (localId: string, cloudId: string, presentationOwnerUid?: string) => {
      const d = depsRef.current;
      if (!d.user) {
        throw new Error("Inicia sesión para recuperar desde la nube.");
      }
      const owner = presentationOwnerUid ?? d.user.uid;
      const { presentation: pulled, cloudRevision } =
        await pullPresentationFromCloud(owner, cloudId);
      await importSavedPresentation(
        {
          ...pulled,
          id: localId,
        },
        d.localAccountScope,
      );
      if (owner !== d.user.uid) {
        await setPresentationCloudState(
          localId,
          null,
          new Date().toISOString(),
          cloudRevision,
          d.localAccountScope,
        );
        await setPresentationSharedCloudSource(
          localId,
          `${owner}::${cloudId}`,
          d.localAccountScope,
        );
      } else {
        await setPresentationCloudState(
          localId,
          cloudId,
          new Date().toISOString(),
          cloudRevision,
          d.localAccountScope,
        );
      }
      await setPresentationSyncState(
        localId,
        {
          dirtySlideIds: [],
          syncStatus: "synced",
          lastSyncedRevision: cloudRevision,
        },
        d.localAccountScope,
      );
      await d.refreshSavedList();
    },
    [],
  );

  const maybePullCloudPresentationBeforeLoad = useCallback(
    async (localId: string, meta: SavedPresentationMeta | undefined) => {
      const d = depsRef.current;
      if (!d.user || !meta) return;
      const ref = resolvePresentationCloudRef(meta, d.user.uid);
      if (!ref) return;
      try {
        if (meta.localBodyCleared) {
          await rehydratePresentationFromMyCloud(
            localId,
            ref.cloudId,
            ref.ownerUid === d.user.uid ? undefined : ref.ownerUid,
          );
          return;
        }
        const remoteRev = await getCloudPresentationRevision(
          ref.ownerUid,
          ref.cloudId,
        );
        const localRev = meta.cloudRevision ?? 0;
        if (remoteRev > localRev) {
          await rehydratePresentationFromMyCloud(
            localId,
            ref.cloudId,
            ref.ownerUid === d.user.uid ? undefined : ref.ownerUid,
          );
        }
      } catch (e) {
        if (meta.localBodyCleared) throw e;
        console.warn(
          "No se pudo comprobar o bajar la versión en la nube al abrir:",
          e,
        );
      }
    },
    [rehydratePresentationFromMyCloud],
  );

  const handleDownloadFromCloud = useCallback(
    async (cloudId: string, ownerUid?: string) => {
      const d = depsRef.current;
      if (!d.user) return;
      const owner = ownerUid ?? d.user.uid;
      const isSharedFromOther = owner !== d.user.uid;
      const existing =
        !isSharedFromOther &&
        d.savedList.find((p) => p.cloudId === cloudId);

      const applyPulledToWebEditor = (
        pulled: PulledPresentation,
        cloudRevision: number,
        localId: string,
      ) => {
        const ctx = d.applySavedPresentationForCloudWebRef.current;
        if (!ctx) {
          throw new Error(
            "El editor aún no está listo. Espera un segundo y vuelve a intentarlo.",
          );
        }
        const synthetic: SavedPresentation = {
          ...pulled,
          id: localId,
          savedAt: pulled.savedAt ?? new Date().toISOString(),
        };
        const urlSlide = readEditorSlideIndexFromHash();
        applySavedPresentationToEditorState(
          synthetic,
          ctx,
          urlSlide !== null ? { initialSlideIndex: urlSlide } : undefined,
        );
        ctx.setCurrentSavedId(localId);
        if (!isSharedFromOther && owner === d.user.uid) {
          d.webCloudSessionRef.current = {
            ownerUid: owner,
            cloudId,
            cloudRevision,
          };
        } else {
          d.webCloudSessionRef.current = null;
        }
      };

      if (existing) {
        if (!isTauriRuntime()) {
          const dlKey = `${owner}::${cloudId}`;
          setDownloadingCloudKey(dlKey);
          try {
            const { presentation: pulled, cloudRevision } =
              await pullPresentationFromCloud(owner, cloudId);
            await updatePresentation(
              existing.id,
              {
                topic: pulled.topic,
                slides: pulled.slides,
                characterId: pulled.characterId,
                deckVisualTheme: pulled.deckVisualTheme,
                deckNarrativePresetId: pulled.deckNarrativePresetId,
                narrativeNotes: pulled.narrativeNotes,
                presentationReadme: pulled.presentationReadme,
              },
              d.localAccountScope,
            );
            await setPresentationCloudState(
              existing.id,
              isSharedFromOther ? null : cloudId,
              new Date().toISOString(),
              cloudRevision,
              d.localAccountScope,
            );
            applyPulledToWebEditor(pulled, cloudRevision, existing.id);
            await d.refreshSavedList();
          } catch (e) {
            console.error(e);
            alert(`Error al abrir: ${formatCloudSyncUserMessage(e)}`);
          } finally {
            setDownloadingCloudKey(null);
          }
          return;
        }
        try {
          await rehydratePresentationFromMyCloud(existing.id, cloudId);
        } catch (e) {
          console.error(e);
          alert(`No se pudo recuperar: ${formatCloudSyncUserMessage(e)}`);
          return;
        }
        await d.openSavedPresentationRef.current(existing.id);
        return;
      }
      const dlKey = `${owner}::${cloudId}`;
      setDownloadingCloudKey(dlKey);
      try {
        const { presentation: pulled, cloudRevision } =
          await pullPresentationFromCloud(owner, cloudId);
        if (!isTauriRuntime()) {
          const localId = `${owner}::${cloudId}`;
          await importSavedPresentation(
            {
              ...pulled,
              id: localId,
            },
            d.localAccountScope,
          );
          if (isSharedFromOther) {
            await setPresentationCloudState(
              localId,
              null,
              new Date().toISOString(),
              cloudRevision,
              d.localAccountScope,
            );
            await setPresentationSharedCloudSource(
              localId,
              `${owner}::${cloudId}`,
              d.localAccountScope,
            );
          } else {
            await setPresentationCloudState(
              localId,
              cloudId,
              new Date().toISOString(),
              cloudRevision,
              d.localAccountScope,
            );
          }
          applyPulledToWebEditor(pulled, cloudRevision, localId);
          await d.refreshSavedList();
          return;
        }
        const localId = crypto.randomUUID();
        await importSavedPresentation(
          {
            ...pulled,
            id: localId,
          },
          d.localAccountScope,
        );
        if (isSharedFromOther) {
          await setPresentationCloudState(
            localId,
            null,
            null,
            null,
            d.localAccountScope,
          );
          await setPresentationSharedCloudSource(
            localId,
            `${owner}::${cloudId}`,
            d.localAccountScope,
          );
        } else {
          await setPresentationCloudState(
            localId,
            cloudId,
            new Date().toISOString(),
            cloudRevision,
            d.localAccountScope,
          );
        }
        await d.refreshSavedList();
        await d.openSavedPresentationRef.current(localId);
      } catch (e) {
        console.error(e);
        alert(
          isTauriRuntime()
            ? `Error al descargar: ${formatCloudSyncUserMessage(e)}`
            : `Error al abrir: ${formatCloudSyncUserMessage(e)}`,
        );
      } finally {
        setDownloadingCloudKey(null);
      }
    },
    [rehydratePresentationFromMyCloud],
  );

  const handleDeleteCloudOnlyMine = useCallback(
    async (cloudId: string, ownerUid?: string) => {
      const d = depsRef.current;
      if (!d.user) {
        alert("Inicia sesión para eliminar en la nube.");
        return;
      }
      const owner = ownerUid ?? d.user.uid;
      if (owner !== d.user.uid) {
        alert("Solo puedes eliminar presentaciones de tu propia nube.");
        return;
      }
      try {
        await deleteOwnerPresentationFromCloud(owner, cloudId);
        await d.refreshSavedList();
      } catch (e) {
        console.error(e);
        alert(`No se pudo eliminar: ${formatCloudSyncUserMessage(e)}`);
      }
    },
    [],
  );

  const openSharePresentationModal = useCallback((localId: string) => {
    setSharePresentationLocalId(localId);
  }, []);

  const closeSharePresentationModal = useCallback(() => {
    setSharePresentationLocalId(null);
  }, []);

  const dismissCloudSyncConflict = useCallback(
    () => setCloudSyncConflict(null),
    [],
  );

  const resolveCloudConflictUseRemote = useCallback(async () => {
    const d = depsRef.current;
    const ed = d.resolveRemoteEditorDepsRef.current;
    const conflict = cloudSyncConflictRef.current;
    if (!conflict || !d.user || !ed) return;
    const { localId, cloudId } = conflict;
    if (!cloudId) {
      alert("No hay vínculo con la nube. Sincroniza manualmente primero.");
      setCloudSyncConflict(null);
      return;
    }
    setCloudSyncConflict(null);
    conflictResolvingRef.current = true;
    try {
      const { presentation, cloudRevision } = await pullPresentationFromCloud(
        d.user.uid,
        cloudId,
      );
      await updatePresentation(
        localId,
        {
          topic: presentation.topic,
          slides: presentation.slides,
          characterId: presentation.characterId,
          deckVisualTheme: normalizeDeckVisualTheme(
            presentation.deckVisualTheme,
          ),
          deckNarrativePresetId: presentation.deckNarrativePresetId,
          narrativeNotes: presentation.narrativeNotes,
          presentationReadme: presentation.presentationReadme,
        },
        d.localAccountScope,
      );
      await setPresentationCloudState(
        localId,
        cloudId,
        new Date().toISOString(),
        cloudRevision,
        d.localAccountScope,
      );
      await setPresentationSyncState(
        localId,
        {
          dirtySlideIds: [],
          syncStatus: "synced",
          lastSyncedRevision: cloudRevision,
        },
        d.localAccountScope,
      );
      if (ed.currentSavedId === localId) {
        ed.setTopic(presentation.topic);
        ed.slidesUndoRef.current = [];
        ed.slidesRedoRef.current = [];
        ed.setSlides(
          normalizeSlidesCanvasScenes(
            presentation.slides.map((s) => ({
              ...s,
              id: crypto.randomUUID(),
              content: ed.formatMarkdown(s.content ?? ""),
            })),
          ),
        );
        ed.setSelectedCharacterId(presentation.characterId ?? null);
        ed.setDeckVisualThemeState(
          normalizeDeckVisualTheme(presentation.deckVisualTheme),
        );
        ed.setDeckNarrativePresetId(
          presentation.deckNarrativePresetId ??
            DEFAULT_DECK_NARRATIVE_PRESET_ID,
        );
        ed.setNarrativeNotes(presentation.narrativeNotes ?? "");
        ed.setPresentationReadme(presentation.presentationReadme ?? "");
      }
      await d.refreshSavedList();
    } catch (e) {
      console.error(e);
      alert(
        `No se pudo traer la versión de la nube: ${formatCloudSyncUserMessage(e)}`,
      );
    } finally {
      conflictResolvingRef.current = false;
    }
  }, []);

  const resolveCloudConflictForceLocal = useCallback(async () => {
    const d = depsRef.current;
    const conflict = cloudSyncConflictRef.current;
    if (!conflict || !d.user) return;
    const { localId, cloudId } = conflict;
    setCloudSyncConflict(null);
    conflictResolvingRef.current = true;
    try {
      const saved = await loadPresentation(localId, d.localAccountScope);
      const cid =
        cloudId ||
        (await listPresentations(d.localAccountScope)).find(
          (p) => p.id === localId,
        )?.cloudId;
      if (!cid) {
        alert("Falta vínculo con la nube.");
        return;
      }
      const {
        cloudId: outId,
        syncedAt,
        newRevision,
      } = await pushPresentationToCloud(d.user.uid, saved, cid, {
        localExpectedRevision: 0,
        force: true,
      });
      await setPresentationCloudState(
        localId,
        outId,
        syncedAt,
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
      await d.refreshSavedList();
    } catch (e) {
      console.error(e);
      alert(`No se pudo forzar la subida: ${formatCloudSyncUserMessage(e)}`);
    } finally {
      conflictResolvingRef.current = false;
    }
  }, []);

  return {
    maybeAutoSyncAfterLocalSave,
    handleSyncPresentationToCloud,
    maybePullCloudPresentationBeforeLoad,
    handleDownloadFromCloud,
    handleDeleteCloudOnlyMine,
    openSharePresentationModal,
    closeSharePresentationModal,
    dismissCloudSyncConflict,
    resolveCloudConflictUseRemote,
    resolveCloudConflictForceLocal,
    syncingToCloudId,
    downloadingCloudKey,
    sharePresentationLocalId,
    cloudSyncConflict,
  };
}
