import { useLayoutEffect } from "react";
import type { MutableRefObject } from "react";
import type { Slide } from "../../types";
import type { PresentationCloudResolveRemoteEditorDeps } from "./presentationCloudPresentationDeps";
import type { DeckNavigationActions } from "./usePresentationEditorKeyboard";

export type PresentationOrchestratorRefSyncArgs = {
  slidesRef: MutableRefObject<Slide[]>;
  slides: Slide[];
  openSavedPresentationRef: MutableRefObject<(id: string) => Promise<void>>;
  handleOpenSaved: (id: string) => Promise<void>;
  runAutoSyncAfterSaveRef: MutableRefObject<(id: string) => Promise<void>>;
  maybeAutoSyncAfterLocalSave: (id: string) => Promise<void>;
  deckNavigationRef: MutableRefObject<DeckNavigationActions>;
  nextSlide: () => void;
  prevSlide: () => void;
  cloudResolveRemoteEditorDepsRef: MutableRefObject<
    PresentationCloudResolveRemoteEditorDeps | null
  >;
} & PresentationCloudResolveRemoteEditorDeps;

/**
 * Mantiene refs usadas por nube, listados guardados, teclado y callbacks asíncronos
 * alineadas con el estado actual, con dependencias explícitas.
 *
 * Incluye el espejo de `slides` en `slidesRef` y `handleOpenSaved` en
 * `openSavedPresentationRef` (antes mutados en el render o en sub-hooks).
 *
 * `useLayoutEffect` evita un fotograma con refs obsoletas antes de pintar o de eventos.
 */
export function usePresentationOrchestratorRefSync(
  args: PresentationOrchestratorRefSyncArgs,
) {
  const {
    slidesRef,
    slides,
    openSavedPresentationRef,
    handleOpenSaved,
    runAutoSyncAfterSaveRef,
    maybeAutoSyncAfterLocalSave,
    deckNavigationRef,
    nextSlide,
    prevSlide,
    cloudResolveRemoteEditorDepsRef,
    currentSavedId,
    setTopic,
    slidesUndoRef,
    slidesRedoRef,
    setSlides,
    setSelectedCharacterId,
    setDeckVisualThemeState,
    setDeckNarrativePresetId,
    setNarrativeNotes,
    formatMarkdown,
  } = args;

  useLayoutEffect(() => {
    slidesRef.current = slides;
  }, [slidesRef, slides]);

  useLayoutEffect(() => {
    openSavedPresentationRef.current = handleOpenSaved;
  }, [openSavedPresentationRef, handleOpenSaved]);

  useLayoutEffect(() => {
    runAutoSyncAfterSaveRef.current = maybeAutoSyncAfterLocalSave;
  }, [runAutoSyncAfterSaveRef, maybeAutoSyncAfterLocalSave]);

  useLayoutEffect(() => {
    deckNavigationRef.current = { nextSlide, prevSlide };
  }, [deckNavigationRef, nextSlide, prevSlide]);

  useLayoutEffect(() => {
    cloudResolveRemoteEditorDepsRef.current = {
      currentSavedId,
      setTopic,
      slidesUndoRef,
      slidesRedoRef,
      setSlides,
      setSelectedCharacterId,
      setDeckVisualThemeState,
      setDeckNarrativePresetId,
      setNarrativeNotes,
      formatMarkdown,
    };
  }, [
    cloudResolveRemoteEditorDepsRef,
    currentSavedId,
    setTopic,
    slidesUndoRef,
    slidesRedoRef,
    setSlides,
    setSelectedCharacterId,
    setDeckVisualThemeState,
    setDeckNarrativePresetId,
    setNarrativeNotes,
    formatMarkdown,
  ]);
}
