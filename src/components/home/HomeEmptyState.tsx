import { motion } from "motion/react";
import { MoreVertical, RefreshCw } from "lucide-react";
import { IconButton } from "../shared/IconButton";
import { PromptInput } from "./PromptInput";
import type { PresentationModel } from "./PromptInput";

export interface HomeEmptyStateProps {
  onOpenConfig?: () => void;
  onCheckUpdates?: () => void;
  topic: string;
  setTopic: (v: string) => void;
  isLoading: boolean;
  onGenerate: (e: React.FormEvent) => void;
  presentationModelId?: string;
  setPresentationModelId?: (id: string) => void;
  presentationModels?: PresentationModel[];
}

/**
 * Pantalla inicial cuando no hay presentaciones guardadas.
 * Muestra el logo centrado, mensaje de bienvenida y el input para generar la primera.
 */
export function HomeEmptyState({
  onOpenConfig,
  onCheckUpdates,
  topic,
  setTopic,
  isLoading,
  onGenerate,
  presentationModelId,
  setPresentationModelId,
  presentationModels,
}: HomeEmptyStateProps) {
  return (
    <div className="min-h-screen flex flex-col font-sans relative bg-gradient-to-br from-emerald-200/80 via-green-100 to-teal-200/80 dark:from-stone-900 dark:via-stone-800 dark:to-stone-900">
      <div className="absolute top-4 right-4 flex items-center gap-1 z-10">
        {onCheckUpdates && (
          <IconButton
            variant="default"
            icon={<RefreshCw size={20} />}
            aria-label="Buscar actualizaciones"
            title="Buscar actualizaciones"
            onClick={onCheckUpdates}
            className="rounded-lg hover:bg-emerald-100/80 dark:hover:bg-stone-700/80"
          />
        )}
        {onOpenConfig && (
          <IconButton
            variant="default"
            icon={<MoreVertical size={20} />}
            aria-label="Configuración (API keys)"
            title="Configuración (API keys)"
            onClick={onOpenConfig}
            className="rounded-lg hover:bg-emerald-100/80 dark:hover:bg-stone-700/80"
          />
        )}
      </div>
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
            <h1 className="text-5xl font-medium tracking-tight text-stone-800 dark:text-stone-100 font-serif italic">
              Sl<span className="text-emerald-600 dark:text-emerald-400">ai</span>m
            </h1>
            <p className="text-stone-600 dark:text-stone-400 text-lg max-w-md mx-auto">
              Transforma tus ideas en presentaciones profesionales con el poder
              de la Inteligencia Artificial.
            </p>
          </div>
          <PromptInput
            onSubmit={onGenerate}
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
