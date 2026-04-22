import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePresentation } from "../../context/PresentationContext";
import { isTauriRuntime } from "../../utils/isTauriRuntime";
import { HomeEmptyState } from "./HomeEmptyState";
import { HomeWithCarousel } from "./HomeWithCarousel";

export interface HomeScreenProps {
  onOpenConfig?: () => void;
  /** Solo en Tauri: al pulsar se busca actualización y se muestra diálogo con el resultado. */
  onCheckUpdates?: () => void;
  /** Si se proporciona, se usa en lugar del contexto al abrir una presentación guardada (p. ej. para navegar a /editor). */
  onOpenSaved?: (id: string) => void | Promise<void>;
  /** Si se proporciona, se usa en lugar del contexto al generar una nueva presentación (p. ej. para navegar a /editor). */
  onGenerate?: (e: React.FormEvent) => void | Promise<void>;
  /** Crear presentación en blanco y navegar al editor (p. ej. ruta /editor). */
  onCreateBlank?: () => void | Promise<void>;
}

/**
 * Pantalla principal del home. Delega en:
 * - HomeEmptyState: cuando no hay presentaciones guardadas.
 * - HomeWithCarousel: cuando hay al menos una presentación guardada.
 */
export function HomeScreen(props: HomeScreenProps) {
  const {
    onOpenConfig,
    onCheckUpdates,
    onOpenSaved: onOpenSavedProp,
    onGenerate: onGenerateProp,
    onCreateBlank: onCreateBlankProp,
  } = props;
  const {
    topic,
    setTopic,
    isLoading,
    handleGenerate,
    handleOpenSaved,
    requestDeletePresentation,
    generatingCoverId,
    handleGenerateCoverForPresentation,
    coverImageCache,
    homeFirstSlideReplicaBySavedId,
    homeFirstSlideReplicaDeckThemeBySavedId,
    presentationModelId,
    setPresentationModelId,
    presentationModels,
    cloudSyncAvailable,
    syncingToCloudId,
    handleSyncPresentationToCloud,
    openSharePresentationModal,
    homePresentationCards,
    handleDownloadFromCloud,
    handleDeleteCloudOnlyMine,
    downloadingCloudKey,
    homeCloudSharedListWarning,
    homePromptAttachments,
    addHomePromptAttachment,
    removeHomePromptAttachment,
    deckNarrativePresetId,
    setDeckNarrativePresetId,
    narrativeNotes,
    setNarrativeNotes,
  } = usePresentation();

  const reduceMotion = useReducedMotion();

  const openSaved = onOpenSavedProp ?? handleOpenSaved;
  const generate = onGenerateProp ?? handleGenerate;
  const createBlank = onCreateBlankProp;
  const hasItems = homePresentationCards.length > 0;
  const cloudOnlyCardActionMode = isTauriRuntime() ? "download" : "open";

  return (
    <AnimatePresence mode="wait" initial={false}>
      {hasItems ? (
        <motion.div
          key="home-with-deck"
          className="h-dvh min-h-0 flex flex-col overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={
            reduceMotion
              ? { opacity: 0, transition: { duration: 0.16 } }
              : {
                  opacity: 0,
                  scale: 0.992,
                  transition: { duration: 0.26, ease: [0.22, 1, 0.36, 1] },
                }
          }
          transition={
            reduceMotion ? { duration: 0.12 } : { duration: 0.22, ease: "easeOut" }
          }
        >
          <HomeWithCarousel
            onOpenConfig={onOpenConfig}
            topic={topic}
            setTopic={setTopic}
            isLoading={isLoading}
            onGenerate={generate}
            onCreateBlank={createBlank}
            presentationModelId={presentationModelId}
            setPresentationModelId={setPresentationModelId}
            presentationModels={presentationModels}
            homePresentationCards={homePresentationCards}
            onOpenSaved={openSaved}
            onDeleteSaved={requestDeletePresentation}
            onGenerateCover={handleGenerateCoverForPresentation}
            generatingCoverId={generatingCoverId}
            coverImageCache={coverImageCache}
            homeFirstSlideReplicaBySavedId={homeFirstSlideReplicaBySavedId}
            homeFirstSlideReplicaDeckThemeBySavedId={
              homeFirstSlideReplicaDeckThemeBySavedId
            }
            cloudSyncAvailable={cloudSyncAvailable}
            onSyncToCloud={handleSyncPresentationToCloud}
            syncingToCloudId={syncingToCloudId}
            homeCloudSharedListWarning={homeCloudSharedListWarning}
            onSharePresentation={openSharePresentationModal}
            onDownloadFromCloud={handleDownloadFromCloud}
            onDeleteCloudOnlyMine={handleDeleteCloudOnlyMine}
            downloadingCloudKey={downloadingCloudKey}
            cloudOnlyCardActionMode={cloudOnlyCardActionMode}
            promptAttachments={homePromptAttachments}
            onAddPromptAttachment={addHomePromptAttachment}
            onRemovePromptAttachment={removeHomePromptAttachment}
            deckNarrativePresetId={deckNarrativePresetId}
            onDeckNarrativePresetIdChange={setDeckNarrativePresetId}
            narrativeNotes={narrativeNotes}
            onNarrativeNotesChange={setNarrativeNotes}
          />
        </motion.div>
      ) : (
        <motion.div
          key="home-empty"
          className="flex min-h-dvh flex-col"
          initial={
            reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }
          }
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: reduceMotion ? 0.12 : 0.16 } }}
          transition={
            reduceMotion
              ? { duration: 0.12 }
              : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }
          }
        >
          <HomeEmptyState
            onOpenConfig={onOpenConfig}
            onCheckUpdates={onCheckUpdates}
            topic={topic}
            setTopic={setTopic}
            isLoading={isLoading}
            onGenerate={generate}
            onCreateBlank={createBlank}
            presentationModelId={presentationModelId}
            setPresentationModelId={setPresentationModelId}
            presentationModels={presentationModels}
            promptAttachments={homePromptAttachments}
            onAddPromptAttachment={addHomePromptAttachment}
            onRemovePromptAttachment={removeHomePromptAttachment}
            deckNarrativePresetId={deckNarrativePresetId}
            onDeckNarrativePresetIdChange={setDeckNarrativePresetId}
            narrativeNotes={narrativeNotes}
            onNarrativeNotesChange={setNarrativeNotes}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
