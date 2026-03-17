import { motion, AnimatePresence } from "motion/react";
import { Code2, X, Send, Loader2 } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { LANGUAGES } from "../../constants/languages";

export function CodeGenerationModal() {
  const {
    showCodeGenModal,
    setShowCodeGenModal,
    currentSlide,
    codeGenPrompt,
    setCodeGenPrompt,
    codeGenLanguage,
    setCodeGenLanguage,
    isGeneratingCode,
    handleGenerateCode,
    effectiveGeminiModelLabel,
  } = usePresentation();

  return (
    <AnimatePresence>
      {showCodeGenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            onClick={() => !isGeneratingCode && setShowCodeGenModal(false)}
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
                  <Code2 size={20} />
                </div>
                <div>
                  <h3 className="font-medium text-stone-900 dark:text-foreground">
                    Generar Código con IA
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-muted-foreground">
                    Código según el contexto del slide (opcional: indica más
                    detalle)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCodeGenModal(false)}
                className="p-2 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-lg transition-colors text-stone-400 dark:text-stone-500"
                disabled={isGeneratingCode}
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Modelo: <span className="font-medium text-stone-700 dark:text-foreground">{effectiveGeminiModelLabel}</span>
              </p>
              {currentSlide && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-muted-foreground">
                      Contexto del Slide
                    </label>
                    <div className="p-3 bg-stone-50 dark:bg-surface rounded-lg border border-stone-200 dark:border-border text-sm text-stone-600 dark:text-stone-300">
                      <p className="font-medium text-stone-800 dark:text-foreground not-italic">
                        {currentSlide.title}
                      </p>
                      <p className="mt-1 italic line-clamp-3">
                        {currentSlide.content.slice(0, 300)}
                        {currentSlide.content.length > 300 ? "…" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-muted-foreground">
                      Lenguaje
                    </label>
                    <select
                      value={codeGenLanguage}
                      onChange={(e) => setCodeGenLanguage(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white dark:bg-surface border border-stone-200 dark:border-border rounded-xl text-stone-700 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-medium"
                      disabled={isGeneratingCode}
                    >
                      {LANGUAGES.map((lang) => (
                        <option key={lang.id} value={lang.id}>
                          {lang.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-muted-foreground">
                      Instrucción opcional
                    </label>
                    <textarea
                      value={codeGenPrompt}
                      onChange={(e) => setCodeGenPrompt(e.target.value)}
                      placeholder="Ej: usa async/await, solo la función principal, incluye comentarios..."
                      className="w-full h-20 p-4 bg-white dark:bg-surface border border-stone-200 dark:border-border rounded-xl text-stone-900 dark:text-foreground placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none text-sm"
                      disabled={isGeneratingCode}
                    />
                  </div>
                </>
              )}
              <button
                onClick={handleGenerateCode}
                disabled={isGeneratingCode}
                className="w-full py-4 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 dark:hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {isGeneratingCode ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Generando código...
                  </>
                ) : (
                  <>
                    <Send size={20} />
                    Generar Código
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
