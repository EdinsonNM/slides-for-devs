import { motion, AnimatePresence } from "motion/react";
import { Mic, X, Loader2 } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";

export function SpeechModal() {
  const {
    showSpeechModal,
    setShowSpeechModal,
    speechGeneralPrompt,
    setSpeechGeneralPrompt,
    isGeneratingSpeech,
    handleGenerateSpeechForAll,
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
            className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center">
                  <Mic size={20} />
                </div>
                <div>
                  <h3 className="font-medium text-stone-900">
                    Notas / speech para todas
                  </h3>
                  <p className="text-xs text-stone-500">
                    Prompt general para rellenar las notas del presentador en
                    todas las diapositivas
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSpeechModal(false)}
                className="p-2 hover:bg-stone-100 rounded-lg transition-colors text-stone-400"
                disabled={isGeneratingSpeech}
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-400">
                  Instrucciones (tono, audiencia, duración, etc.)
                </label>
                <textarea
                  value={speechGeneralPrompt}
                  onChange={(e) => setSpeechGeneralPrompt(e.target.value)}
                  placeholder="Ej: Tono informal para desarrolladores. Máximo 2 frases por slide. Incluir un dato curioso cuando sea relevante."
                  className="w-full h-32 p-4 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all resize-none text-sm"
                  disabled={isGeneratingSpeech}
                />
              </div>
              <button
                onClick={handleGenerateSpeechForAll}
                disabled={isGeneratingSpeech || !speechGeneralPrompt.trim()}
                className="w-full py-4 bg-violet-600 text-white rounded-xl font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
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
