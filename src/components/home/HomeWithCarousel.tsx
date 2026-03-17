import { useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { cn } from "../../utils/cn";
import { IconButton } from "../shared/IconButton";
import { AvatarMenu } from "../shared/AvatarMenu";
import { PromptInput } from "./PromptInput";
import { SavedCarousel } from "./SavedCarousel";
import type { PresentationModel } from "./PromptInput";
import type { SavedPresentationMeta } from "../../types";

const CARD_GRADIENTS = [
  "from-rose-500/90 to-red-600/90",
  "from-blue-500/90 to-indigo-600/90",
  "from-emerald-500/90 to-teal-600/90",
  "from-violet-500/90 to-purple-600/90",
  "from-amber-500/90 to-orange-600/90",
];

export interface HomeWithCarouselProps {
  onOpenConfig?: () => void;
  onCheckUpdates?: () => void;
  topic: string;
  setTopic: (v: string) => void;
  isLoading: boolean;
  onGenerate: (e: React.FormEvent) => void;
  presentationModelId?: string;
  setPresentationModelId?: (id: string) => void;
  presentationModels?: PresentationModel[];
  savedList: SavedPresentationMeta[];
  onOpenSaved: (id: string) => void;
  onDeleteSaved: (id: string) => void;
  onGenerateCover: (id: string) => void;
  generatingCoverId: string | null;
  coverImageCache: Record<string, string>;
}

/**
 * Pantalla principal cuando ya hay presentaciones guardadas.
 * Muestra header con logo, input compacto y carrusel de presentaciones.
 */
export function HomeWithCarousel({
  onOpenConfig,
  onCheckUpdates,
  topic,
  setTopic,
  isLoading,
  onGenerate,
  presentationModelId,
  setPresentationModelId,
  presentationModels,
  savedList,
  onOpenSaved,
  onDeleteSaved,
  onGenerateCover,
  generatingCoverId,
  coverImageCache,
}: HomeWithCarouselProps) {
  const [showExploreAll, setShowExploreAll] = useState(false);

  return (
    <div className="min-h-screen flex flex-col font-sans bg-gradient-to-br from-stone-50 via-white to-stone-100/70 dark:from-stone-900 dark:via-stone-900 dark:to-stone-800">
      <header className="flex items-start justify-between gap-3 sm:gap-4 px-4 sm:px-6 py-4 bg-transparent shrink-0">
        <div className="flex items-center gap-3 min-w-0 shrink-0 pt-0.5">
          <div className="shrink-0 w-10 h-10 rounded-xl overflow-hidden bg-white/80 dark:bg-stone-800/80 flex items-center justify-center">
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
          <span className="text-xl font-semibold text-stone-900 dark:text-stone-100 font-serif italic truncate">
            Sl<span className="text-emerald-600 dark:text-emerald-400">ai</span>m
          </span>
        </div>

        <div className="flex-1 flex justify-center max-w-xl">
          <PromptInput
            onSubmit={onGenerate}
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

        <div className="flex items-center min-w-0 justify-end shrink-0 pt-0.5">
          <AvatarMenu onOpenConfig={onOpenConfig} variant="home" />
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 overflow-auto">
        <div className="flex flex-col w-full max-w-6xl mx-auto flex-1 min-h-0">
          {showExploreAll ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col flex-1 min-h-0"
            >
              <button
                type="button"
                onClick={() => setShowExploreAll(false)}
                className="self-start flex items-center gap-2 text-sm text-stone-500 hover:text-emerald-600 mb-4 transition-colors"
              >
                <ArrowLeft size={18} />
                Volver
              </button>
              <h2 className="text-lg font-semibold text-stone-900 mb-4">
                Mis presentaciones
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto pb-8">
                {savedList.map((p, index) => {
                  const gradient = CARD_GRADIENTS[index % CARD_GRADIENTS.length];
                  const isGeneratingCover = generatingCoverId === p.id;
                  return (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.3,
                        delay: index * 0.04,
                        ease: [0.25, 0.46, 0.45, 0.94],
                      }}
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        "rounded-2xl overflow-hidden text-left relative",
                        "shadow-lg border border-white/10",
                        !coverImageCache[p.id] && cn("bg-linear-to-br", gradient)
                      )}
                      style={{ minHeight: 280 }}
                    >
                      {coverImageCache[p.id] && (
                        <div
                          className="absolute inset-0 bg-cover bg-center"
                          style={{
                            backgroundImage: `url(${coverImageCache[p.id]})`,
                          }}
                        />
                      )}
                      <div className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
                      <button
                        type="button"
                        onClick={() => onOpenSaved(p.id)}
                        className="absolute inset-0 w-full h-full flex flex-col p-6 pt-14 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-inset z-0"
                      >
                        <div className="flex-1" />
                        <div className="text-white text-left">
                          <h3 className="text-lg font-bold leading-snug line-clamp-2">
                            {p.topic}
                          </h3>
                          <p className="text-sm text-white/85 mt-1">
                            {p.slideCount} diapositivas
                          </p>
                          <p className="text-xs text-white/70 mt-0.5">
                            {new Date(p.savedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </button>
                      <div className="absolute top-5 right-5 flex flex-col gap-1 z-30 pointer-events-auto">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            onGenerateCover(p.id);
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          disabled={isGeneratingCover}
                          className="p-2 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors disabled:opacity-60"
                          title="Generar imagen de portada"
                        >
                          <ImagePlus size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            onDeleteSaved(p.id);
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          className="p-2 rounded-lg bg-white/20 hover:bg-red-500/80 text-white transition-colors"
                          title="Eliminar presentación"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                      {isGeneratingCover && (
                        <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center z-20">
                          <Loader2 className="w-10 h-10 text-white animate-spin" />
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="flex flex-col items-center justify-center flex-1 py-4 sm:py-6 overflow-visible"
            >
              <SavedCarousel
                savedList={savedList}
                onOpen={onOpenSaved}
                onDelete={onDeleteSaved}
                onGenerateCover={onGenerateCover}
                generatingCoverId={generatingCoverId}
                coverImageCache={coverImageCache}
                onOpenSavedListModal={() => setShowExploreAll(true)}
              />
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
