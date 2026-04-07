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
    savedList,
    handleOpenSaved,
    handleDeleteSaved,
    generatingCoverId,
    handleGenerateCoverForPresentation,
    coverImageCache,
    presentationModelId,
    setPresentationModelId,
    presentationModels,
    cloudSyncAvailable,
    syncingToCloudId,
    handleSyncPresentationToCloud,
    openCloudPresentationsModal,
    openSharePresentationModal,
  } = usePresentation();

  const openSaved = onOpenSavedProp ?? handleOpenSaved;
  const generate = onGenerateProp ?? handleGenerate;
  const createBlank = onCreateBlankProp;
  const hasItems = savedList.length > 0;

  if (!hasItems) {
    return (
      <>
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
        cloudSyncAvailable={cloudSyncAvailable}
        onOpenCloudPresentations={openCloudPresentationsModal}
      />
      </>
    );
  }

  return (
    <>
      <SignInInviteBar onBackToWelcome={onBackToWelcome} />
      <HomeWithCarousel
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
      savedList={savedList}
      onOpenSaved={openSaved}
      onDeleteSaved={handleDeleteSaved}
      onGenerateCover={handleGenerateCoverForPresentation}
      generatingCoverId={generatingCoverId}
      coverImageCache={coverImageCache}
      cloudSyncAvailable={cloudSyncAvailable}
      onSyncToCloud={handleSyncPresentationToCloud}
      syncingToCloudId={syncingToCloudId}
      onOpenCloudPresentations={openCloudPresentationsModal}
      onSharePresentation={openSharePresentationModal}
    />
    </>
  );
}
