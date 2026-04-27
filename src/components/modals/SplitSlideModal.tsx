import { motion, AnimatePresence } from "motion/react";
import { Split, X, Loader2, Wand2 } from "lucide-react";
import { usePresentation } from "@/presentation/contexts/PresentationContext";

export function SplitSlideModal() {
  const {
    showSplitModal,
    setShowSplitModal,
    splitPrompt,
    setSplitPrompt,
    isProcessing,
    handleSplitSlide,
  } = usePresentation();

  return (
    <AnimatePresence>
      {showSplitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            onClick={() => !isProcessing && setShowSplitModal(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-white dark:bg-surface-elevated rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-stone-100 dark:border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Split size={20} />
                </div>
                <div>
                  <h3 className="font-medium text-stone-900 dark:text-foreground">
                    Dividir Diapositiva
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-muted-foreground">
                    Profundiza en este tema dividiéndolo
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSplitModal(false)}
                className="p-2 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-lg transition-colors text-stone-400 dark:text-stone-500"
                disabled={isProcessing}
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-muted-foreground">
                  Instrucciones para dividir
                </label>
                <textarea
                  value={splitPrompt}
                  onChange={(e) => setSplitPrompt(e.target.value)}
                  placeholder="Ej: Divide esto en 3 diapositivas detallando los beneficios técnicos, económicos y sociales..."
                  className="w-full h-32 p-4 bg-white dark:bg-surface border border-stone-200 dark:border-border rounded-xl text-stone-900 dark:text-foreground placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none text-sm"
                  disabled={isProcessing}
                />
              </div>
              <button
                onClick={handleSplitSlide}
                disabled={isProcessing || !splitPrompt.trim()}
                className="w-full py-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 dark:hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Wand2 size={20} />
                    Dividir y Profundizar
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
