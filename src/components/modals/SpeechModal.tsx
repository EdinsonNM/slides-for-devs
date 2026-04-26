import { motion, AnimatePresence } from "motion/react";
import { Mic, X, Loader2 } from "lucide-react";
import { usePresentation } from "../../presentation/contexts/PresentationContext";

export function SpeechModal() {
  const {
    showSpeechModal,
    setShowSpeechModal,
    speechGeneralPrompt,
    setSpeechGeneralPrompt,
    isGeneratingSpeech,
    handleGenerateSpeechForAll,
    effectiveGeminiModelLabel,
  } = usePresentation();

  return (
    <AnimatePresence>
      {showSpeechModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            onClick={() => !isGeneratingSpeech && setShowSpeechModal(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-white dark:bg-surface-elevated rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-stone-100 dark:border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                  <Mic size={20} />
                </div>
                <div>
                  <h3 className="font-medium text-stone-900 dark:text-foreground">
                    Notas / speech para todas
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-muted-foreground">
                    Prompt general para rellenar las notas del presentador en
                    todas las diapositivas
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSpeechModal(false)}
                className="p-2 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-lg transition-colors text-stone-400 dark:text-stone-500"
                disabled={isGeneratingSpeech}
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Modelo: <span className="font-medium text-stone-700 dark:text-foreground">{effectiveGeminiModelLabel}</span>
              </p>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-muted-foreground">
                  Instrucciones (tono, audiencia, duración, etc.)
                </label>
                <textarea
                  value={speechGeneralPrompt}
                  onChange={(e) => setSpeechGeneralPrompt(e.target.value)}
                  placeholder="Ej: Tono informal para desarrolladores. Máximo 2 frases por slide. Incluir un dato curioso cuando sea relevante."
                  className="w-full h-32 p-4 bg-white dark:bg-surface border border-stone-200 dark:border-border rounded-xl text-stone-900 dark:text-foreground placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all resize-none text-sm"
                  disabled={isGeneratingSpeech}
                />
              </div>
              <button
                onClick={handleGenerateSpeechForAll}
                disabled={isGeneratingSpeech || !speechGeneralPrompt.trim()}
                className="w-full py-4 bg-violet-600 text-white rounded-xl font-medium hover:bg-violet-700 dark:hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {isGeneratingSpeech ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Generando speech...
                  </>
                ) : (
                  <>
                    <Mic size={20} />
                    Generar para todas las diapositivas
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
