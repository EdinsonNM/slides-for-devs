import { motion } from "motion/react";
import { FilePlus } from "lucide-react";
import { cn } from "../../utils/cn";
import { AvatarMenu } from "../shared/AvatarMenu";
import { PromptInput } from "./PromptInput";
import type { PresentationModel } from "./PromptInput";
import type { PromptAttachment } from "../../utils/promptAttachments";

export interface HomeEmptyStateProps {
  /** Si true, ocupa el alto del contenedor (home con barra lateral) en lugar de `min-h-dvh`. */
  embeddedLayout?: boolean;
  onOpenConfig?: () => void;
  onCheckUpdates?: () => void;
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
}

/**
 * Pantalla inicial cuando no hay presentaciones guardadas.
 * Contenido centrado; el prompt queda en un footer fijo.
 */
export function HomeEmptyState({
  embeddedLayout = false,
  onOpenConfig,
  onCheckUpdates,
  topic,
  setTopic,
  isLoading,
  onGenerate,
  onCreateBlank,
  presentationModelId,
  setPresentationModelId,
  presentationModels,
  promptAttachments,
  onAddPromptAttachment,
  onRemovePromptAttachment,
  deckNarrativePresetId,
  onDeckNarrativePresetIdChange,
  narrativeNotes,
  onNarrativeNotesChange,
}: HomeEmptyStateProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col bg-linear-to-br from-emerald-200/80 via-green-100 to-teal-200/80 font-sans dark:from-stone-900 dark:via-stone-800 dark:to-stone-900",
        embeddedLayout
          ? "h-full min-h-0 min-w-0 flex-1"
          : "min-h-dvh",
      )}
    >
      <div className="absolute right-4 top-4 z-20">
        <AvatarMenu onOpenConfig={onOpenConfig} variant="home" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6 pb-52 pt-10 sm:pb-56 sm:pt-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="max-w-2xl space-y-8 text-center"
        >
          <div className="space-y-4">
            <div className="mb-4 inline-flex h-64 w-64 items-center justify-center overflow-hidden rounded-3xl bg-transparent">
              <img
                src="./logo.png"
                alt=""
                width={256}
                height={256}
                className="h-full w-full object-contain"
                draggable={false}
                aria-hidden
              />
            </div>
            <h1 className="font-serif text-5xl font-medium italic tracking-tight text-stone-800 dark:text-stone-100">
              Sl<span className="text-emerald-600 dark:text-emerald-400">ai</span>m
            </h1>
            <p className="mx-auto max-w-md text-lg text-stone-600 dark:text-stone-400">
              Transforma tus ideas en presentaciones profesionales con el poder
              de la Inteligencia Artificial.
            </p>
          </div>
          {onCreateBlank && (
            <button
              type="button"
              onClick={() => void onCreateBlank()}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white/90 px-4 py-2.5 text-sm font-medium text-stone-700 shadow-sm hover:bg-white disabled:opacity-50 dark:border-stone-600 dark:bg-stone-800/90 dark:text-stone-200 dark:hover:bg-stone-800"
            >
              <FilePlus size={18} />
              Presentación en blanco
            </button>
          )}
        </motion.div>
      </div>

      <footer
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30"
        style={{
          paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="pointer-events-auto mx-auto w-full max-w-3xl px-4 drop-shadow-xl sm:px-5">
          <PromptInput
            onSubmit={onGenerate}
            value={topic}
            onChange={setTopic}
            disabled={isLoading}
            placeholder="¿Sobre qué quieres hablar hoy? Si pegas un texto muy largo, se añade como documento."
            minRows={2}
            maxRows={6}
            showPlan={true}
            className="w-full"
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
