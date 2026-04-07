import { motion, AnimatePresence } from "motion/react";
import { Sparkles, X, Loader2 } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";

export function GenerateFullDeckModal() {
  const {
    showGenerateFullDeckModal,
    setShowGenerateFullDeckModal,
    generateFullDeckTopic,
    setGenerateFullDeckTopic,
    handleConfirmGenerateFullDeck,
    pendingGeneration: pending,
  } = usePresentation();

  const busy = pending !== null;

  return (
    <AnimatePresence>
      {showGenerateFullDeckModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            onClick={() => !busy && setShowGenerateFullDeckModal(false)}
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
                    Generar toda la presentación
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-muted-foreground">
                    Se generará el conjunto de diapositivas a partir del tema (se
                    reemplaza el contenido actual).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGenerateFullDeckModal(false)}
                className="p-2 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-lg transition-colors text-stone-400 dark:text-stone-500"
                disabled={busy}
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="full-deck-topic"
                  className="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-muted-foreground"
                >
                  Tema o instrucción
                </label>
                <textarea
                  id="full-deck-topic"
                  value={generateFullDeckTopic}
                  onChange={(e) => setGenerateFullDeckTopic(e.target.value)}
                  placeholder="Ej: Introducción a Rust para equipo de backend, 8 diapositivas…"
                  className="w-full h-32 p-4 bg-white dark:bg-surface border border-stone-200 dark:border-border rounded-xl text-stone-900 dark:text-foreground placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none text-sm"
                  disabled={busy}
                />
              </div>
              <button
                type="button"
                onClick={handleConfirmGenerateFullDeck}
                disabled={busy || !generateFullDeckTopic.trim()}
                className="w-full py-4 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 dark:hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {busy ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Generando…
                  </>
                ) : (
                  <>
                    <Sparkles size={20} />
                    Generar presentación
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
