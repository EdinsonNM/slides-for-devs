import { motion, AnimatePresence } from "motion/react";
import { Sparkles, X, Loader2 } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { SLIDE_TYPE } from "../../domain/entities";

export function GenerateSlideContentModal() {
  const {
    showGenerateSlideContentModal,
    setShowGenerateSlideContentModal,
    generateSlideContentPrompt,
    setGenerateSlideContentPrompt,
    isProcessing,
    handleGenerateSlideContentAi,
    topic,
    currentSlide,
  } = usePresentation();

  const isMatrixSlide = currentSlide?.type === SLIDE_TYPE.MATRIX;

  return (
    <AnimatePresence>
      {showGenerateSlideContentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            onClick={() => !isProcessing && setShowGenerateSlideContentModal(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-white dark:bg-surface-elevated rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-stone-100 dark:border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className="font-medium text-stone-900 dark:text-foreground">
                    {isMatrixSlide ? "Generar tabla con IA" : "Generar esta diapositiva"}
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-muted-foreground">
                    {topic.trim()
                      ? `Contexto del título de la presentación: «${topic.trim()}».`
                      : "Opcionalmente define el título de la presentación en la barra superior para dar más contexto."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGenerateSlideContentModal(false)}
                className="p-2 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-lg transition-colors text-stone-400 dark:text-stone-500"
                disabled={isProcessing}
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="slide-gen-prompt"
                  className="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-muted-foreground"
                >
                  {isMatrixSlide
                    ? "Describe la matriz o tabla que necesitas"
                    : "Qué debe incluir esta diapositiva"}
                </label>
                <textarea
                  id="slide-gen-prompt"
                  value={generateSlideContentPrompt}
                  onChange={(e) => setGenerateSlideContentPrompt(e.target.value)}
                  placeholder={
                    isMatrixSlide
                      ? "Ej: Matriz de decisión con columnas Criterio, Peso, Opción A, Opción B y 4 filas comparando dos arquitecturas…"
                      : "Ej: Explicar ventajas de los tests de contrato vs tests e2e, con 3 viñetas y un ejemplo breve…"
                  }
                  className="w-full h-32 p-4 bg-white dark:bg-surface border border-stone-200 dark:border-border rounded-xl text-stone-900 dark:text-foreground placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none text-sm"
                  disabled={isProcessing}
                />
              </div>
              <button
                type="button"
                onClick={() => void handleGenerateSlideContentAi()}
                disabled={isProcessing || !generateSlideContentPrompt.trim()}
                className="w-full py-4 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 dark:hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Generando…
                  </>
                ) : (
                  <>
                    <Sparkles size={20} />
                    {isMatrixSlide ? "Generar tabla" : "Generar contenido"}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
