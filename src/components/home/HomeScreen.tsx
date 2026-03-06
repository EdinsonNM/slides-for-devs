import { motion } from "motion/react";
import { MoreVertical } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { PromptInput } from "./PromptInput";
import { SavedCarousel } from "./SavedCarousel";

export interface HomeScreenProps {
  onOpenConfig?: () => void;
}

export function HomeScreen(props: HomeScreenProps) {
  const { onOpenConfig } = props;
  const {
    topic,
    setTopic,
    isLoading,
    handleGenerate,
    openSavedListModal,
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
      <div className="min-h-screen flex flex-col font-sans relative bg-linear-to-br from-emerald-200/80 via-green-100 to-teal-200/80">
        {onOpenConfig && (
          <button
            type="button"
            onClick={onOpenConfig}
            className="absolute top-4 right-4 p-2 rounded-lg text-stone-500 hover:bg-emerald-100/80 hover:text-stone-700 transition-colors z-10"
            title="Configuración (API keys)"
          >
            <MoreVertical size={20} />
          </button>
        )}
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="max-w-2xl w-full text-center space-y-8"
          >
            <div className="space-y-4">
              <div className="inline-flex items-center justify-center w-64 h-64 rounded-3xl overflow-hidden mb-4 bg-transparent">
                <video
                  src="./video-logo.webm"
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-contain"
                  aria-hidden
                />
              </div>
              <h1 className="text-5xl font-medium tracking-tight text-stone-800 font-serif italic">
                Sl<span className="text-emerald-600">ai</span>m
              </h1>
              <p className="text-stone-600 text-lg max-w-md mx-auto">
                Transforma tus ideas en presentaciones profesionales con el poder
                de la Inteligencia Artificial.
              </p>
            </div>
            <PromptInput
              onSubmit={handleGenerate}
              value={topic}
              onChange={setTopic}
              disabled={isLoading}
              placeholder="¿Sobre qué quieres hablar hoy? Puedes escribir varias líneas."
              minRows={3}
              maxRows={6}
              showPlan={true}
              presentationModelId={presentationModelId}
              setPresentationModelId={setPresentationModelId}
              presentationModels={presentationModels}
            />
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col font-sans bg-linear-to-br from-stone-50 via-white to-stone-100/70">
      <header className="flex items-start justify-between gap-3 sm:gap-4 px-4 sm:px-6 py-4 bg-transparent shrink-0">
        <div className="flex items-center gap-3 min-w-0 shrink-0 pt-0.5">
          <div className="shrink-0 w-10 h-10 rounded-xl overflow-hidden bg-white/80 flex items-center justify-center">
            <video
              src="./video-logo.webm"
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-contain"
              aria-hidden
            />
          </div>
          <span className="text-xl font-semibold text-stone-900 font-serif italic truncate">
            Sl<span className="text-emerald-600">ai</span>m
          </span>
        </div>

        <div className="flex-1 flex justify-center max-w-xl">
          <PromptInput
            onSubmit={handleGenerate}
            value={topic}
            onChange={setTopic}
            disabled={isLoading}
            placeholder="¿Sobre qué quieres hablar hoy? Puedes escribir varias líneas."
            minRows={1}
            maxRows={4}
            showPlan={true}
            className="max-w-xl"
            compact
            presentationModelId={presentationModelId}
            setPresentationModelId={setPresentationModelId}
            presentationModels={presentationModels}
          />
        </div>

        <div className="flex items-center min-w-[52px] justify-end shrink-0 pt-0.5">
          {onOpenConfig && (
            <button
              type="button"
              onClick={onOpenConfig}
              className="p-2 rounded-lg text-stone-600 hover:bg-white/50 hover:text-stone-800 transition-colors"
              title="Configuración (API keys)"
            >
              <MoreVertical size={22} />
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col justify-center min-h-0 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 overflow-visible">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="flex flex-col items-center w-full max-w-6xl mx-auto overflow-visible"
        >
          <div className="w-full py-4 sm:py-6 overflow-visible">
            <SavedCarousel
              savedList={savedList}
              onOpen={handleOpenSaved}
              onDelete={handleDeleteSaved}
              onGenerateCover={handleGenerateCoverForPresentation}
              generatingCoverId={generatingCoverId}
              coverImageCache={coverImageCache}
              onOpenSavedListModal={openSavedListModal}
            />
          </div>
        </motion.div>
      </main>
    </div>
  );
}
