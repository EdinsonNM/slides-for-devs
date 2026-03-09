import { motion } from "motion/react";
import { MoreVertical, RefreshCw } from "lucide-react";
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
    <div className="min-h-screen flex flex-col font-sans relative bg-linear-to-br from-emerald-200/80 via-green-100 to-teal-200/80">
      <div className="absolute top-4 right-4 flex items-center gap-1 z-10">
        {onCheckUpdates && (
          <button
            type="button"
            onClick={onCheckUpdates}
            className="p-2 rounded-lg text-stone-500 hover:bg-emerald-100/80 hover:text-stone-700 transition-colors"
            title="Buscar actualizaciones"
          >
            <RefreshCw size={20} />
          </button>
        )}
        {onOpenConfig && (
          <button
            type="button"
            onClick={onOpenConfig}
            className="p-2 rounded-lg text-stone-500 hover:bg-emerald-100/80 hover:text-stone-700 transition-colors"
            title="Configuración (API keys)"
          >
            <MoreVertical size={20} />
          </button>
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
            <h1 className="text-5xl font-medium tracking-tight text-stone-800 font-serif italic">
              Sl<span className="text-emerald-600">ai</span>m
            </h1>
            <p className="text-stone-600 text-lg max-w-md mx-auto">
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
