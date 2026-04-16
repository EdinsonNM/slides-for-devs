import { motion } from "motion/react";
import { FilePlus } from "lucide-react";
import { AvatarMenu } from "../shared/AvatarMenu";
import { PromptInput } from "./PromptInput";
import { HomePresentationCardTile } from "./HomePresentationCardTile";
import type { PresentationModel } from "./PromptInput";
import type { HomePresentationCard } from "../../types";
import { homePresentationCardKey } from "../../types";
import type { PromptAttachment } from "../../utils/promptAttachments";

/** Velo inferior: mitad inferior casi opaca + suavizado (alineado con PromptInput bg-white / stone-900). */
const HOME_LIST_BOTTOM_VEIL_LIGHT =
  "linear-gradient(to top, #ffffff 0%, #ffffff 52%, rgba(255,255,255,0.97) 66%, rgba(250,250,249,0.42) 84%, rgba(255,255,255,0) 100%)";
const HOME_LIST_BOTTOM_VEIL_DARK =
  "linear-gradient(to top, rgb(28 25 23) 0%, rgb(28 25 23) 50%, rgba(28,25,23,0.93) 65%, rgba(28,25,23,0.38) 83%, rgba(28,25,23,0) 100%)";

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
  promptAttachments?: PromptAttachment[];
  onAddPromptAttachment?: (a: PromptAttachment) => void;
  onRemovePromptAttachment?: (id: string) => void;
  deckNarrativePresetId?: string;
  onDeckNarrativePresetIdChange?: (id: string) => void;
  narrativeNotes?: string;
  onNarrativeNotesChange?: (v: string) => void;
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
 * Parrilla de tarjetas; el prompt compacto flota en la parte inferior.
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
  promptAttachments,
  onAddPromptAttachment,
  onRemovePromptAttachment,
  deckNarrativePresetId,
  onDeckNarrativePresetIdChange,
  narrativeNotes,
  onNarrativeNotesChange,
}: HomeWithCarouselProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-linear-to-br from-stone-50 via-white to-stone-100/70 font-sans dark:from-stone-900 dark:via-stone-900 dark:to-stone-800">
      <header className="z-20 flex shrink-0 items-center justify-between gap-3 border-b border-stone-200/70 bg-stone-50/90 px-4 py-3 backdrop-blur-md dark:border-stone-700/60 dark:bg-stone-900/90 sm:gap-4 sm:px-6 sm:py-4">
        <div className="flex min-w-0 shrink-0 items-center gap-3 pt-0.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/80 dark:bg-stone-800/80">
            <video
              src="./video-logo.webm"
              autoPlay
              loop
              muted
              playsInline
              className="h-full w-full object-contain"
              aria-hidden
            />
          </div>
          <span className="truncate font-serif text-xl font-semibold italic text-stone-900 dark:text-stone-100">
            Sl<span className="text-emerald-600 dark:text-emerald-400">ai</span>m
          </span>
        </div>

        <div className="flex min-w-0 shrink-0 items-center justify-end gap-2 pt-0.5">
          {onCreateBlank && (
            <button
              type="button"
              onClick={() => void onCreateBlank()}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white/80 px-2.5 py-2 text-xs font-medium text-stone-700 hover:bg-white disabled:opacity-50 dark:border-stone-600 dark:bg-stone-800/80 dark:text-stone-200 dark:hover:bg-stone-800 sm:px-3"
              title="Abrir el editor sin generar contenido"
            >
              <FilePlus size={16} />
              <span className="hidden min-[400px]:inline">En blanco</span>
            </button>
          )}
          <AvatarMenu onOpenConfig={onOpenConfig} variant="home" />
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <main className="relative z-0 min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-4 py-6 pb-40 sm:px-6 sm:py-8 sm:pb-44 lg:px-8">
          <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col overflow-visible">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="flex min-h-0 flex-1 flex-col overflow-visible"
            >
              {homeCloudSharedListWarning && (
                <div
                  role="status"
                  className="mb-3 w-full rounded-xl border border-amber-200/80 bg-amber-50/95 px-2 py-2.5 text-center text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200"
                >
                  {homeCloudSharedListWarning}
                </div>
              )}
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
                  Mis presentaciones
                </h2>
                <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                  Borde continuo claro: copia local y nube. Punteado claro: solo
                  este equipo. Punteado azul: tu nube sin copia local. Punteado
                  violeta e icono de personas: compartida contigo (toca para
                  copiar aquí).
                </p>
              </div>
              <div className="isolate grid grid-cols-2 gap-5 overflow-visible px-1 py-3 sm:grid-cols-3 sm:gap-6 sm:px-2 lg:grid-cols-4">
                {homePresentationCards.map((card, index) => (
                  <div
                    key={homePresentationCardKey(card)}
                    className="relative z-0 flex min-h-[280px] p-1.5 sm:p-2"
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
              <div className="pb-6 sm:pb-8" />
            </motion.div>
          </div>
        </main>
      </div>

      {/*
        `fixed` + z por debajo del footer: en WebKit a veces el scroll de `main` compone
        por encima de un hermano `absolute`, y las cards con hover z-30 quedaban encima del velo.
      */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[25] h-[min(30dvh,14rem)] dark:hidden sm:h-[min(31dvh,15rem)]"
        style={{ background: HOME_LIST_BOTTOM_VEIL_LIGHT }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[25] hidden h-[min(30dvh,14rem)] sm:h-[min(31dvh,15rem)] dark:block"
        style={{ background: HOME_LIST_BOTTOM_VEIL_DARK }}
      />

      <footer
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30"
        style={{
          paddingBottom: "max(0.65rem, env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="pointer-events-auto mx-auto w-full max-w-4xl px-3 drop-shadow-xl sm:px-5">
          <PromptInput
            onSubmit={onGenerate}
            value={topic}
            onChange={setTopic}
            disabled={isLoading}
            placeholder="¿Sobre qué quieres hablar hoy? Texto largo al pegar → documento."
            minRows={1}
            maxRows={4}
            showPlan={true}
            className="w-full"
            compact
            presentationModelId={presentationModelId}
            setPresentationModelId={setPresentationModelId}
            presentationModels={presentationModels}
            attachments={promptAttachments}
            onAddAttachment={onAddPromptAttachment}
            onRemoveAttachment={onRemovePromptAttachment}
            deckNarrativePresetId={deckNarrativePresetId}
            onDeckNarrativePresetIdChange={onDeckNarrativePresetIdChange}
            narrativeNotes={narrativeNotes}
            onNarrativeNotesChange={onNarrativeNotesChange}
          />
        </div>
      </footer>
    </div>
  );
}
