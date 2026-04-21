import { useLayoutEffect } from "react";
import type { MutableRefObject } from "react";
import type { PresentationCloudResolveRemoteEditorDeps } from "./presentationCloudPresentationDeps";
import type { DeckNavigationActions } from "./usePresentationEditorKeyboard";

export type PresentationOrchestratorRefSyncArgs = {
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
 * Mantiene refs usadas por nube / teclado / callbacks asíncronos con el mismo valor
 * que antes se asignaba durante el render, pero con dependencias explícitas.
 *
 * `useLayoutEffect` evita un fotograma con refs obsoletas antes de pintar o de eventos.
 */
export function usePresentationOrchestratorRefSync(
  args: PresentationOrchestratorRefSyncArgs,
) {
  const {
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
