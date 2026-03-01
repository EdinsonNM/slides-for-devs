import { motion, AnimatePresence } from "motion/react";
import { RefreshCw, X, Loader2 } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";

export function RewriteSlideModal() {
  const {
    showRewriteModal,
    setShowRewriteModal,
    rewritePrompt,
    setRewritePrompt,
    isProcessing,
    handleRewriteSlide,
  } = usePresentation();

  return (
    <AnimatePresence>
      {showRewriteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            onClick={() => !isProcessing && setShowRewriteModal(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                  <RefreshCw size={20} />
                </div>
                <div>
                  <h3 className="font-medium text-stone-900">
                    Replantear Contenido
                  </h3>
                  <p className="text-xs text-stone-500">
                    Cambia el tono o enfoque del texto
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRewriteModal(false)}
                className="p-2 hover:bg-stone-100 rounded-lg transition-colors text-stone-400"
                disabled={isProcessing}
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-400">
                  Instrucciones para replantear
                </label>
                <textarea
                  value={rewritePrompt}
                  onChange={(e) => setRewritePrompt(e.target.value)}
                  placeholder="Ej: Haz que el tono sea más profesional y enfocado a ejecutivos..."
                  className="w-full h-32 p-4 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all resize-none text-sm"
                  disabled={isProcessing}
                />
              </div>
              <button
                onClick={handleRewriteSlide}
                disabled={isProcessing || !rewritePrompt.trim()}
                className="w-full py-4 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Reescribiendo...
                  </>
                ) : (
                  <>
                    <RefreshCw size={20} />
                    Actualizar Contenido
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
