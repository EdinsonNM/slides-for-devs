import { motion } from "motion/react";
import { FilePlus } from "lucide-react";
import { AvatarMenu } from "../shared/AvatarMenu";
import { PromptInput } from "./PromptInput";
import { HomePresentationDeckCarousel } from "./HomePresentationDeckCarousel";
import type { PresentationModel } from "./PromptInput";
import type { DeckVisualTheme } from "../../domain/entities";
import type { HomePresentationCard, Slide } from "../../types";
import type { PromptAttachment } from "../../utils/promptAttachments";

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
  homeFirstSlideReplicaBySavedId?: Record<string, Slide | undefined>;
  homeFirstSlideReplicaDeckThemeBySavedId?: Record<
    string,
    DeckVisualTheme | undefined
  >;
  cloudSyncAvailable?: boolean;
  onSyncToCloud?: (id: string) => void;
  syncingToCloudId?: string | null;
  /** Aviso si falló el listado de compartidas (índice Firebase, etc.). */
  homeCloudSharedListWarning?: string | null;
  /** Compartir por UID (solo si la tarjeta tiene `cloudId`). */
  onSharePresentation?: (localId: string) => void;
  onDownloadFromCloud: (cloudId: string, ownerUid?: string) => void;
  downloadingCloudKey: string | null;
  /** En web las tarjetas solo-nube abren en el editor sin “descargar”. */
  cloudOnlyCardActionMode?: "download" | "open";
}

/**
 * Pantalla principal cuando ya hay presentaciones guardadas.
 * El prompt va al final del flex (no `position: fixed`) para reservar alto real al carrusel;
 * si hace falta, solo el `<main>` (título + descripción + carrusel) hace scroll.
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
  homeFirstSlideReplicaBySavedId,
  homeFirstSlideReplicaDeckThemeBySavedId,
  cloudSyncAvailable = false,
  onSyncToCloud,
  syncingToCloudId = null,
  homeCloudSharedListWarning = null,
  onSharePresentation,
  onDownloadFromCloud,
  downloadingCloudKey,
  cloudOnlyCardActionMode = "download",
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
      <header className="z-20 flex shrink-0 items-center justify-between gap-3 bg-stone-50/90 px-4 py-3 backdrop-blur-md dark:bg-stone-900/90 sm:gap-4 sm:px-6 sm:py-4">
        <div className="flex min-w-0 shrink-0 items-center gap-3 pt-0.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/80 dark:bg-stone-800/80">
            <img
              src="./logo.png"
              alt=""
              width={40}
              height={40}
              className="h-full w-full object-contain"
              draggable={false}
              aria-hidden
            />
          </div>
          <span className="truncate font-serif text-xl font-semibold italic text-stone-900 dark:text-stone-100">
            Sl<span className="text-emerald-600 dark:text-emerald-400">ai</span>
            m
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

      <main className="relative z-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain pt-4 sm:pt-5">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden"
          >
            <div className="shrink-0 px-3 sm:px-5 lg:px-7">
              <div className="mx-auto w-full min-w-0 max-w-6xl">
                {homeCloudSharedListWarning && (
                  <div
                    role="status"
                    className="mb-2 w-full rounded-xl border border-amber-200/80 bg-amber-50/95 px-2 py-2 text-center text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200"
                  >
                    {homeCloudSharedListWarning}
                  </div>
                )}
                <div className="mb-2 sm:mb-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-stone-400 dark:text-stone-500">
                    Tus presentaciones
                  </p>
                  <h2 className="mt-1 text-xl font-semibold leading-snug tracking-tight text-stone-900 dark:text-stone-50 sm:text-2xl">
                    Lo que imaginas merece salir al mundo
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600 dark:text-stone-400">
                    Esa primera idea —un curso, un producto, una charla que solo tú
                    sabes dar— empieza aquí. Crea, comparte lo que sabes y deja
                    que otros sueñen contigo.
                  </p>
                </div>
              </div>
            </div>
            <div className="isolate flex min-h-0 w-full min-w-0 flex-1 flex-col py-1 sm:py-2">
              <HomePresentationDeckCarousel
                homePresentationCards={homePresentationCards}
                coverImageCache={coverImageCache}
                homeFirstSlideReplicaBySavedId={homeFirstSlideReplicaBySavedId}
                homeFirstSlideReplicaDeckThemeBySavedId={
                  homeFirstSlideReplicaDeckThemeBySavedId
                }
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
                cloudOnlyCardActionMode={cloudOnlyCardActionMode}
              />
            </div>
          </motion.div>
      </main>

      <footer
        className="relative z-30 shrink-0 bg-transparent px-3 pt-1 sm:px-5"
        style={{
          paddingBottom: "max(0.65rem, env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="mx-auto w-full max-w-4xl drop-shadow-xl">
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
