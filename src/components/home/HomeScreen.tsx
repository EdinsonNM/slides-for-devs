import { usePresentation } from "../../context/PresentationContext";
import { HomeEmptyState } from "./HomeEmptyState";
import { HomeWithCarousel } from "./HomeWithCarousel";
import { SignInInviteBar } from "./SignInInviteBar";

export interface HomeScreenProps {
  onOpenConfig?: () => void;
  /** Vuelve a la pantalla de bienvenida (modo sin cuenta en el home). */
  onBackToWelcome?: () => void;
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
    onBackToWelcome,
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
    presentationModelId,
    setPresentationModelId,
    presentationModels,
    cloudSyncAvailable,
    syncingToCloudId,
    handleSyncPresentationToCloud,
    openSharePresentationModal,
    homePresentationCards,
    handleDownloadFromCloud,
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

  const openSaved = onOpenSavedProp ?? handleOpenSaved;
  const generate = onGenerateProp ?? handleGenerate;
  const createBlank = onCreateBlankProp;
  const hasItems = homePresentationCards.length > 0;

  if (!hasItems) {
    return (
      <div className="flex min-h-dvh flex-col">
        <SignInInviteBar onBackToWelcome={onBackToWelcome} />
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
      </div>
    );
  }

  return (
    <div className="h-dvh min-h-0 flex flex-col overflow-hidden">
      <SignInInviteBar onBackToWelcome={onBackToWelcome} />
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
        cloudSyncAvailable={cloudSyncAvailable}
        onSyncToCloud={handleSyncPresentationToCloud}
        syncingToCloudId={syncingToCloudId}
        homeCloudSharedListWarning={homeCloudSharedListWarning}
        onSharePresentation={openSharePresentationModal}
        onDownloadFromCloud={handleDownloadFromCloud}
        downloadingCloudKey={downloadingCloudKey}
        promptAttachments={homePromptAttachments}
        onAddPromptAttachment={addHomePromptAttachment}
        onRemovePromptAttachment={removeHomePromptAttachment}
        deckNarrativePresetId={deckNarrativePresetId}
        onDeckNarrativePresetIdChange={setDeckNarrativePresetId}
        narrativeNotes={narrativeNotes}
        onNarrativeNotesChange={setNarrativeNotes}
      />
    </div>
  );
}
