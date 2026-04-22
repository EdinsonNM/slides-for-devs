import { useLayoutEffect } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { Slide } from "../../types";
import type { DeckVisualTheme } from "../../domain/entities";
import type { PresentationCloudResolveRemoteEditorDeps } from "./presentationCloudPresentationDeps";
import type { ApplySavedPresentationEditorContext } from "./applySavedPresentationToEditorState";
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
  applySavedPresentationForCloudWebRef: MutableRefObject<
    ApplySavedPresentationEditorContext | null
  >;
  setCurrentIndex: (index: number | ((prev: number) => number)) => void;
  setCurrentSavedId: (
    id: string | null | ((prev: string | null) => string | null),
  ) => void;
  coverPrefetchSavedAtRef: MutableRefObject<Record<string, string>>;
  setCoverImageCache: Dispatch<SetStateAction<Record<string, string>>>;
  setHomeFirstSlideReplicaBySavedId: Dispatch<
    SetStateAction<Record<string, Slide | undefined>>
  >;
  setHomeFirstSlideReplicaDeckThemeBySavedId: Dispatch<
    SetStateAction<Record<string, DeckVisualTheme | undefined>>
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
    applySavedPresentationForCloudWebRef,
    setCurrentIndex,
    coverPrefetchSavedAtRef,
    setCoverImageCache,
    setHomeFirstSlideReplicaBySavedId,
    setHomeFirstSlideReplicaDeckThemeBySavedId,
    currentSavedId,
    setTopic,
    setCurrentSavedId,
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

  useLayoutEffect(() => {
    applySavedPresentationForCloudWebRef.current = {
      slidesUndoRef,
      slidesRedoRef,
      setTopic,
      setSlides,
      setCurrentIndex,
      setCurrentSavedId,
      setSelectedCharacterId,
      setDeckVisualThemeState,
      setDeckNarrativePresetId,
      setNarrativeNotes,
      coverPrefetchSavedAtRef,
      setCoverImageCache,
      setHomeFirstSlideReplicaBySavedId,
      setHomeFirstSlideReplicaDeckThemeBySavedId,
    };
  }, [
    applySavedPresentationForCloudWebRef,
    slidesUndoRef,
    slidesRedoRef,
    setTopic,
    setSlides,
    setCurrentIndex,
    setCurrentSavedId,
    setSelectedCharacterId,
    setDeckVisualThemeState,
    setDeckNarrativePresetId,
    setNarrativeNotes,
    coverPrefetchSavedAtRef,
    setCoverImageCache,
    setHomeFirstSlideReplicaBySavedId,
    setHomeFirstSlideReplicaDeckThemeBySavedId,
  ]);
}
