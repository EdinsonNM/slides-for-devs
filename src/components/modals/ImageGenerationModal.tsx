import { motion, AnimatePresence } from "motion/react";
import { Sparkles, X, Send, Loader2 } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { IMAGE_STYLES } from "../../constants/imageStyles";
import { cn } from "../../utils/cn";

export function ImageGenerationModal() {
  const {
    showImageModal,
    setShowImageModal,
    currentSlide,
    imagePrompt,
    setImagePrompt,
    selectedStyle,
    setSelectedStyle,
    includeBackground,
    setIncludeBackground,
    isGeneratingImage,
    handleImageGenerate,
  } = usePresentation();

  return (
    <AnimatePresence>
      {showImageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            onClick={() => !isGeneratingImage && setShowImageModal(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className="font-medium text-stone-900">
                    Generar Imagen con IA
                  </h3>
                  <p className="text-xs text-stone-500">
                    Describe lo que quieres ver en este slide
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowImageModal(false)}
                className="p-2 hover:bg-stone-100 rounded-lg transition-colors text-stone-400"
                disabled={isGeneratingImage}
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-400">
                  Estilo de Imagen
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {IMAGE_STYLES.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setSelectedStyle(style)}
                      className={cn(
                        "px-3 py-2 rounded-lg text-xs font-medium border transition-all",
                        selectedStyle.id === style.id
                          ? "bg-emerald-600 border-emerald-600 text-white shadow-md"
                          : "bg-white border-stone-200 text-stone-600 hover:border-emerald-500"
                      )}
                    >
                      {style.name}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={includeBackground}
                  onChange={(e) => setIncludeBackground(e.target.checked)}
                  disabled={isGeneratingImage}
                  className="w-4 h-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-stone-600 group-hover:text-stone-900">
                  Incluir fondo
                </span>
              </label>

              {currentSlide && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-stone-400">
                      Contexto del Slide
                    </label>
                    <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 text-sm text-stone-600 italic">
                      &quot;{currentSlide.title}&quot;
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-stone-400">
                      Tu Prompt
                    </label>
                    <textarea
                      value={imagePrompt}
                      onChange={(e) => setImagePrompt(e.target.value)}
                      placeholder="Ej: Un astronauta plantando una bandera en Marte..."
                      className="w-full h-24 p-4 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none text-sm"
                      disabled={isGeneratingImage}
                    />
                  </div>
                </>
              )}
              <button
                onClick={handleImageGenerate}
                disabled={isGeneratingImage || !imagePrompt.trim()}
                className="w-full py-4 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {isGeneratingImage ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Generando Obra Maestra...
                  </>
                ) : (
                  <>
                    <Send size={20} />
                    Generar Imagen
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
