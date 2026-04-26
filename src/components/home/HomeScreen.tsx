import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePresentation } from "../../presentation/contexts/PresentationContext";
import { isTauriRuntime } from "../../utils/isTauriRuntime";
import { HomeEmptyState } from "./HomeEmptyState";
import type { HomeMainTab } from "./homeMainTab";
import { HomeShell } from "./HomeShell";
import { HomeWithCarousel } from "./HomeWithCarousel";
import { PublicPresentationsMock } from "./PublicPresentationsMock";

export interface HomeScreenProps {
  activeTab: HomeMainTab;
  onTabChange: (tab: HomeMainTab) => void;
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
 * Pantalla principal del home. Barra lateral: Inicio (mock de presentaciones
 * públicas) y Mis proyectos (estado vacío o carrusel de decks propios, como
 * antes).
 */
export function HomeScreen(props: HomeScreenProps) {
  const {
    activeTab,
    onTabChange,
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
    handleUploadCoverForPresentation,
    handleRemoveCoverForPresentation,
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
  const openCloudCard = (cloudId: string, ownerUid?: string) => {
    void handleDownloadFromCloud(cloudId, ownerUid);
  };

  return (
    <HomeShell
      activeTab={activeTab}
      onTabChange={onTabChange}
      onOpenConfig={onOpenConfig}
    >
      {activeTab === "inicio" ? (
        <PublicPresentationsMock onOpenConfig={onOpenConfig} />
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          {hasItems ? (
            <motion.div
              key="home-with-deck"
              className="h-full min-h-0 min-w-0 flex flex-1 flex-col overflow-hidden"
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
                reduceMotion
                  ? { duration: 0.12 }
                  : { duration: 0.22, ease: "easeOut" }
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
                onUploadCover={handleUploadCoverForPresentation}
                onRemoveCover={handleRemoveCoverForPresentation}
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
                onDownloadFromCloud={openCloudCard}
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
              className="flex h-full min-h-0 min-w-0 flex-1 flex-col"
              initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{
                opacity: 0,
                transition: { duration: reduceMotion ? 0.12 : 0.16 },
              }}
              transition={
                reduceMotion
                  ? { duration: 0.12 }
                  : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }
              }
            >
              <HomeEmptyState
                embeddedLayout
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
      )}
    </HomeShell>
  );
}
