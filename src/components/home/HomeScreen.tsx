import { usePresentation } from "../../context/PresentationContext";
import { HomeEmptyState } from "./HomeEmptyState";
import { HomeWithCarousel } from "./HomeWithCarousel";

export interface HomeScreenProps {
  onOpenConfig?: () => void;
  /** Solo en Tauri: al pulsar se busca actualización y se muestra diálogo con el resultado. */
  onCheckUpdates?: () => void;
}

/**
 * Pantalla principal del home. Delega en:
 * - HomeEmptyState: cuando no hay presentaciones guardadas.
 * - HomeWithCarousel: cuando hay al menos una presentación guardada.
 */
export function HomeScreen(props: HomeScreenProps) {
  const { onOpenConfig, onCheckUpdates } = props;
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
  } = usePresentation();

  const hasItems = savedList.length > 0;

  if (!hasItems) {
    return (
      <HomeEmptyState
        onOpenConfig={onOpenConfig}
        onCheckUpdates={onCheckUpdates}
        topic={topic}
        setTopic={setTopic}
        isLoading={isLoading}
        onGenerate={handleGenerate}
        presentationModelId={presentationModelId}
        setPresentationModelId={setPresentationModelId}
        presentationModels={presentationModels}
      />
    );
  }

  return (
    <HomeWithCarousel
      onOpenConfig={onOpenConfig}
      onCheckUpdates={onCheckUpdates}
      topic={topic}
      setTopic={setTopic}
      isLoading={isLoading}
      onGenerate={handleGenerate}
      presentationModelId={presentationModelId}
      setPresentationModelId={setPresentationModelId}
      presentationModels={presentationModels}
      savedList={savedList}
      onOpenSaved={handleOpenSaved}
      onDeleteSaved={handleDeleteSaved}
      onGenerateCover={handleGenerateCoverForPresentation}
      generatingCoverId={generatingCoverId}
      coverImageCache={coverImageCache}
    />
  );
}
