import { useCallback, useState } from "react";
import { SLIDE_TYPE } from "../../domain/entities";
import {
  patchSlideMediaPanelByElementId,
} from "../../domain/slideCanvas/slideCanvasApplyEditBuffers";
import {
  resolveMediaPanelDescriptor,
  Canvas3dMediaPanelDescriptor,
} from "../../domain/panelContent";
import { applyGeneratedImageToMediaPanelPayload } from "./presentationMediaHelpers";
import { optimizeImageDataUrl } from "../../utils/imageOptimize";
import { generateImage as generateImageUseCase } from "../../composition/container";
import { DEFAULT_OPENAI_IMAGE_MODEL_ID } from "../../constants/openaiImageModels";
import { presentationQueryKeys } from "../queryKeys";
import {
  listCharacters,
  saveCharacter as saveCharacterStorage,
  deleteCharacter as deleteCharacterStorage,
  setCharacterCloudState,
  addGeneratedResource,
  deleteGeneratedResource,
} from "../../services/storage";
import {
  pushCharacterToCloud,
  pullAllCharactersFromCloud,
  deleteCharacterFromCloud,
  CharacterCloudSyncConflictError,
} from "../../services/charactersCloud";
import { initFirebase } from "../../services/firebase";
import { trackEvent, ANALYTICS_EVENTS } from "../../services/analytics";
import type { SavedCharacter } from "../../types";
import type { PresentationCharactersResourcesDeps } from "./presentationCharactersResourcesDeps";

export function usePresentationCharactersResources(
  deps: PresentationCharactersResourcesDeps,
) {
  const [isSyncingCharactersCloud, setIsSyncingCharactersCloud] =
    useState(false);
  const [isGeneratingCharacterPreview, setIsGeneratingCharacterPreview] =
    useState(false);

  const refreshGeneratedResources = useCallback(async () => {
    await deps.queryClient.invalidateQueries({
      queryKey: presentationQueryKeys.generatedResources(deps.localAccountScope),
    });
  }, [deps.queryClient, deps.localAccountScope]);

  const refreshSavedCharacters = useCallback(() => {
    void deps.queryClient.invalidateQueries({
      queryKey: presentationQueryKeys.savedCharacters(deps.localAccountScope),
    });
  }, [deps.queryClient, deps.localAccountScope]);

  const deleteGeneratedResourceFromLibrary = useCallback(
    async (id: string) => {
      await deleteGeneratedResource(id, deps.localAccountScope);
      await refreshGeneratedResources();
    },
    [deps.localAccountScope, refreshGeneratedResources],
  );

  const recordGeneratedModel3d = useCallback(
    async (glbDataUrl: string, prompt: string | null) => {
      try {
        await addGeneratedResource(
          {
            kind: "model3d",
            payload: glbDataUrl,
            ...(prompt?.trim() ? { prompt: prompt.trim() } : {}),
            source: "meshy",
          },
          deps.localAccountScope,
        );
        await refreshGeneratedResources();
      } catch (e) {
        console.error(e);
      }
    },
    [deps.localAccountScope, refreshGeneratedResources],
  );

  const applyLibraryImageResource = useCallback(
    async (imageUrl: string, imagePromptLabel?: string) => {
      const slide =
        deps.slidesRef.current[deps.currentIndexRef.current];
      if (
        !slide ||
        (slide.type !== SLIDE_TYPE.CONTENT &&
          slide.type !== SLIDE_TYPE.CHAPTER)
      ) {
        alert(
          "Abre una diapositiva (Contenido o Capítulo) para aplicar una imagen desde Recursos.",
        );
        return;
      }
      if (
        resolveMediaPanelDescriptor(slide) instanceof
        Canvas3dMediaPanelDescriptor
      ) {
        alert(
          "El bloque seleccionado es Canvas 3D. Cambia a imagen (o otro panel) o usa un modelo 3D desde la sección inferior de Recursos.",
        );
        return;
      }
      const patchMediaPanelElementId =
        deps.canvasTextTargetsRef.current.mediaPanelElementId;
      const label = (imagePromptLabel?.trim() || "Desde biblioteca").slice(
        0,
        2000,
      );
      let nextDeck: typeof deps.slidesRef.current | null = null;
      deps.setSlides((prev) => {
        const updated = [...prev];
        const cur = updated[deps.currentIndexRef.current];
        if (!cur) return prev;
        updated[deps.currentIndexRef.current] = patchSlideMediaPanelByElementId(
          cur,
          patchMediaPanelElementId,
          (m) => applyGeneratedImageToMediaPanelPayload(m, imageUrl, label),
        );
        nextDeck = updated;
        return updated;
      });
      if (nextDeck && nextDeck.length > 0) {
        const savedId = await deps.savePresentationNow({
          topic: deps.topic || "Sin título",
          slides: nextDeck,
          characterId: deps.selectedCharacterId ?? undefined,
        });
        if (!savedId) {
          alert(
            "La imagen se aplicó pero no se pudo guardar la presentación. Pulsa Guardar si lo necesitas.",
          );
        }
      }
    },
    [
      deps.setSlides,
      deps.slidesRef,
      deps.currentIndexRef,
      deps.canvasTextTargetsRef,
      deps.savePresentationNow,
      deps.topic,
      deps.selectedCharacterId,
    ],
  );

  const applyLibraryModel3dResource = useCallback(
    async (glbUrl: string) => {
      const slide =
        deps.slidesRef.current[deps.currentIndexRef.current];
      if (
        !slide ||
        (slide.type !== SLIDE_TYPE.CONTENT &&
          slide.type !== SLIDE_TYPE.CHAPTER)
      ) {
        alert(
          "Abre una diapositiva (Contenido o Capítulo) para aplicar un modelo 3D desde Recursos.",
        );
        return;
      }
      if (
        !(
          resolveMediaPanelDescriptor(slide) instanceof
          Canvas3dMediaPanelDescriptor
        )
      ) {
        alert(
          "Selecciona un bloque Canvas 3D (o cambia el panel a Canvas 3D) para cargar un modelo guardado.",
        );
        return;
      }
      const trimmed = glbUrl.trim();
      let nextDeck: typeof deps.slidesRef.current | null = null;
      deps.setSlides((prev) => {
        const updated = [...prev];
        const cur = updated[deps.currentIndexRef.current];
        if (!cur) return prev;
        updated[deps.currentIndexRef.current] = patchSlideMediaPanelByElementId(
          cur,
          deps.canvasTextTargetsRef.current.mediaPanelElementId,
          (m) => ({
            ...m,
            canvas3dGlbUrl: trimmed || undefined,
            canvas3dViewState: undefined,
          }),
        );
        nextDeck = updated;
        return updated;
      });
      if (nextDeck && nextDeck.length > 0) {
        const savedId = await deps.savePresentationNow({
          topic: deps.topic || "Sin título",
          slides: nextDeck,
          characterId: deps.selectedCharacterId ?? undefined,
        });
        if (!savedId) {
          alert(
            "El modelo se aplicó pero no se pudo guardar la presentación. Pulsa Guardar si lo necesitas.",
          );
        }
      }
    },
    [
      deps.setSlides,
      deps.slidesRef,
      deps.currentIndexRef,
      deps.canvasTextTargetsRef,
      deps.savePresentationNow,
      deps.topic,
      deps.selectedCharacterId,
    ],
  );

  const handleSaveCharacter = useCallback(
    async (incoming: SavedCharacter) => {
      const existing = deps.savedCharacters.find((c) => c.id === incoming.id);
      let referenceImageDataUrl = incoming.referenceImageDataUrl;
      if (referenceImageDataUrl?.startsWith("data:")) {
        try {
          referenceImageDataUrl = await optimizeImageDataUrl(
            referenceImageDataUrl,
          );
        } catch {
          /* mantener */
        }
      }
      const toSave: SavedCharacter = {
        ...incoming,
        referenceImageDataUrl,
        cloudRevision: incoming.cloudRevision ?? existing?.cloudRevision,
        cloudSyncedAt: incoming.cloudSyncedAt ?? existing?.cloudSyncedAt,
      };
      await saveCharacterStorage(toSave, deps.localAccountScope);
      refreshSavedCharacters();
      trackEvent(ANALYTICS_EVENTS.CHARACTER_SAVED);

      if (
        deps.autoCloudSyncOnSave &&
        deps.user &&
        typeof window !== "undefined" &&
        (window as unknown as { __TAURI__?: unknown }).__TAURI__
      ) {
        const fb = await initFirebase();
        if (fb?.firestore) {
          try {
            const list = await listCharacters(deps.localAccountScope);
            const c = list.find((x) => x.id === toSave.id) ?? toSave;
            const { syncedAt, newRevision } = await pushCharacterToCloud(
              deps.user.uid,
              c,
              { localExpectedRevision: c.cloudRevision ?? null },
            );
            await setCharacterCloudState(
              c.id,
              syncedAt,
              newRevision,
              deps.localAccountScope,
            );
            void deps.queryClient.invalidateQueries({
              queryKey: presentationQueryKeys.savedCharacters(
                deps.localAccountScope,
              ),
            });
          } catch (e) {
            if (e instanceof CharacterCloudSyncConflictError) {
              console.warn(
                "Auto-sync personaje: conflicto de revisión",
                e.characterId,
              );
            } else {
              console.error("Auto-sync personaje:", e);
            }
          }
        }
      }
    },
    [
      deps.savedCharacters,
      deps.localAccountScope,
      deps.autoCloudSyncOnSave,
      deps.user,
      deps.queryClient,
      refreshSavedCharacters,
    ],
  );

  const handleDeleteCharacter = useCallback(
    async (id: string) => {
      const char = deps.savedCharacters.find((c) => c.id === id);
      if (
        deps.user &&
        (char?.cloudRevision != null || char?.cloudSyncedAt) &&
        typeof window !== "undefined" &&
        (window as unknown as { __TAURI__?: unknown }).__TAURI__
      ) {
        try {
          await deleteCharacterFromCloud(deps.user.uid, id);
        } catch (e) {
          console.error("Eliminar personaje en la nube:", e);
        }
      }
      await deleteCharacterStorage(id, deps.localAccountScope);
      if (deps.selectedCharacterId === id) deps.setSelectedCharacterId(null);
      refreshSavedCharacters();
    },
    [
      deps.savedCharacters,
      deps.user,
      deps.localAccountScope,
      deps.selectedCharacterId,
      deps.setSelectedCharacterId,
      refreshSavedCharacters,
    ],
  );

  const handlePushAllCharactersToCloud = useCallback(async () => {
    if (!deps.user) return;
    setIsSyncingCharactersCloud(true);
    try {
      const chars = await listCharacters(deps.localAccountScope);
      let ok = 0;
      const conflicts: string[] = [];
      for (const c of chars) {
        try {
          const { syncedAt, newRevision } = await pushCharacterToCloud(
            deps.user.uid,
            c,
            { localExpectedRevision: c.cloudRevision ?? null },
          );
          await setCharacterCloudState(
            c.id,
            syncedAt,
            newRevision,
            deps.localAccountScope,
          );
          ok++;
        } catch (e) {
          if (e instanceof CharacterCloudSyncConflictError) {
            conflicts.push(c.name);
          } else {
            throw e;
          }
        }
      }
      refreshSavedCharacters();
      if (conflicts.length) {
        alert(
          `Subidos ${ok} personaje(s). Conflicto de versión en: ${conflicts.join(", ")}. Trae desde la nube o vuelve a subir tras alinear.`,
        );
      } else if (ok > 0) {
        alert(`Subidos ${ok} personaje(s) a la nube.`);
      } else {
        alert("No hay personajes locales para subir.");
      }
    } catch (e) {
      console.error(e);
      alert(
        `Error al subir personajes: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setIsSyncingCharactersCloud(false);
    }
  }, [deps.user, deps.localAccountScope, refreshSavedCharacters]);

  const handlePullCharactersFromCloud = useCallback(async () => {
    if (!deps.user) return;
    setIsSyncingCharactersCloud(true);
    try {
      const remote = await pullAllCharactersFromCloud(deps.user.uid);
      for (const r of remote) {
        await saveCharacterStorage(r, deps.localAccountScope);
      }
      refreshSavedCharacters();
      alert(
        remote.length
          ? `Actualizados ${remote.length} personaje(s) desde la nube (por id). Los que solo existían localmente se mantienen.`
          : "No hay personajes en la nube.",
      );
    } catch (e) {
      console.error(e);
      alert(
        `Error al traer personajes: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setIsSyncingCharactersCloud(false);
    }
  }, [deps.user, deps.localAccountScope, refreshSavedCharacters]);

  const generateCharacterPreview = useCallback(
    async (
      characterDescription: string,
    ): Promise<string | undefined> => {
      if (!characterDescription.trim()) return undefined;
      setIsGeneratingCharacterPreview(true);
      try {
        const context =
          "Personaje aislado (avatar de referencia) para presentaciones: un solo diseño coherente en todas las escenas. Imagen sobre fondo blanco liso (sin rejilla de transparencia ni cuadritos); sin texto ni elementos decorativos de interfaz alrededor.";
        const providerId = deps.hasGemini ? "gemini" : deps.imageProvider;
        const imageModelId =
          providerId === "gemini"
            ? deps.geminiImageModelId
            : DEFAULT_OPENAI_IMAGE_MODEL_ID;
        return generateImageUseCase.run({
          providerId,
          slideContext: context,
          userPrompt: characterDescription.trim(),
          stylePrompt: deps.selectedStyle.prompt,
          includeBackground: true,
          modelId: imageModelId,
          characterPreviewOnly: true,
        });
      } finally {
        setIsGeneratingCharacterPreview(false);
      }
    },
    [
      deps.hasGemini,
      deps.imageProvider,
      deps.geminiImageModelId,
      deps.selectedStyle.prompt,
    ],
  );

  return {
    isSyncingCharactersCloud,
    isGeneratingCharacterPreview,
    refreshGeneratedResources,
    refreshSavedCharacters,
    deleteGeneratedResourceFromLibrary,
    recordGeneratedModel3d,
    applyLibraryImageResource,
    applyLibraryModel3dResource,
    saveCharacter: handleSaveCharacter,
    deleteCharacter: handleDeleteCharacter,
    handlePushAllCharactersToCloud,
    handlePullCharactersFromCloud,
    generateCharacterPreview,
  };
}
