import { motion } from "motion/react";
import { FilePlus } from "lucide-react";
import { AvatarMenu } from "../shared/AvatarMenu";
import { PromptInput } from "./PromptInput";
import { HomePresentationCardTile } from "./HomePresentationCardTile";
import type { PresentationModel } from "./PromptInput";
import type { HomePresentationCard } from "../../types";
import { homePresentationCardKey } from "../../types";

export interface HomeWithCarouselProps {
  onOpenConfig?: () => void;
  topic: string;
  setTopic: (v: string) => void;
  isLoading: boolean;
  onGenerate: (e: React.FormEvent) => void;
  onCreateBlank?: () => void | Promise<void>;
  presentationModelId?: string;
  setPresentationModelId?: (id: string) => void;
  presentationModels?: PresentationModel[];
  homePresentationCards: HomePresentationCard[];
  onOpenSaved: (id: string) => void;
  onDeleteSaved: (id: string) => void;
  onGenerateCover: (id: string) => void;
  generatingCoverId: string | null;
  coverImageCache: Record<string, string>;
  cloudSyncAvailable?: boolean;
  onSyncToCloud?: (id: string) => void;
  syncingToCloudId?: string | null;
  /** Aviso si falló el listado de compartidas (índice Firebase, etc.). */
  homeCloudSharedListWarning?: string | null;
  /** Compartir por UID (solo si la tarjeta tiene `cloudId`). */
  onSharePresentation?: (localId: string) => void;
  onDownloadFromCloud: (cloudId: string, ownerUid?: string) => void;
  downloadingCloudKey: string | null;
}

/**
 * Pantalla principal cuando ya hay presentaciones guardadas.
 * Header con logo, input compacto y parrilla de tarjetas.
 */
export function HomeWithCarousel({
  onOpenConfig,
  topic,
  setTopic,
  isLoading,
  onGenerate,
  onCreateBlank,
  presentationModelId,
  setPresentationModelId,
  presentationModels,
  homePresentationCards,
  onOpenSaved,
  onDeleteSaved,
  onGenerateCover,
  generatingCoverId,
  coverImageCache,
  cloudSyncAvailable = false,
  onSyncToCloud,
  syncingToCloudId = null,
  homeCloudSharedListWarning = null,
  onSharePresentation,
  onDownloadFromCloud,
  downloadingCloudKey,
}: HomeWithCarouselProps) {
  return (
    <div className="min-h-screen flex flex-col font-sans bg-linear-to-br from-stone-50 via-white to-stone-100/70 dark:from-stone-900 dark:via-stone-900 dark:to-stone-800">
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

        <div className="flex items-center gap-2 min-w-0 justify-end shrink-0 pt-0.5">
          {onCreateBlank && (
            <button
              type="button"
              onClick={() => void onCreateBlank()}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-medium text-stone-700 dark:text-stone-200 bg-white/80 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-600 hover:bg-white dark:hover:bg-stone-800 disabled:opacity-50"
              title="Abrir el editor sin generar contenido"
            >
              <FilePlus size={16} />
              <span className="hidden min-[400px]:inline">En blanco</span>
            </button>
          )}
          <AvatarMenu onOpenConfig={onOpenConfig} variant="home" />
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 overflow-auto">
        <div className="flex flex-col w-full max-w-6xl mx-auto flex-1 min-h-0 overflow-visible">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col flex-1 min-h-0 overflow-visible"
          >
            {homeCloudSharedListWarning && (
              <div
                role="status"
                className="w-full mb-3 text-center text-xs text-amber-800 dark:text-amber-200 bg-amber-50/95 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 rounded-xl py-2.5 px-2"
              >
                {homeCloudSharedListWarning}
              </div>
            )}
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
                Mis presentaciones
              </h2>
              <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                Verde: copia local y nube. Punteado claro: solo este equipo.
                Punteado azul: tu nube sin copia local. Punteado violeta e icono
                de personas: compartida contigo (toca para copiar aquí).
              </p>
            </div>
            <div className="isolate grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-6 px-1 sm:px-2 py-3 pb-12 overflow-visible">
              {homePresentationCards.map((card, index) => (
                <div
                  key={homePresentationCardKey(card)}
                  className="relative z-0 min-h-[280px] p-1.5 sm:p-2 flex"
                >
                  <HomePresentationCardTile
                    card={card}
                    index={index}
                    coverImageCache={coverImageCache}
                    generatingCoverId={generatingCoverId}
                    syncingToCloudId={syncingToCloudId}
                    onOpenSaved={onOpenSaved}
                    onDeleteSaved={onDeleteSaved}
                    onGenerateCover={onGenerateCover}
                    cloudSyncAvailable={cloudSyncAvailable}
                    onSyncToCloud={onSyncToCloud}
                    onSharePresentation={onSharePresentation}
                    onDownloadFromCloud={onDownloadFromCloud}
                    downloadingCloudKey={downloadingCloudKey}
                    frameClassName="w-full min-w-0"
                  />
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
