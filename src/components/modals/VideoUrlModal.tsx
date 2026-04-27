import { motion, AnimatePresence } from "motion/react";
import { Video, X, Save } from "lucide-react";
import { usePresentation } from "@/presentation/contexts/PresentationContext";

export function VideoUrlModal() {
  const {
    showVideoModal,
    setShowVideoModal,
    videoUrlInput,
    setVideoUrlInput,
    handleSaveVideoUrl,
  } = usePresentation();

  return (
    <AnimatePresence>
      {showVideoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            onClick={() => setShowVideoModal(false)}
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
                  <Video size={20} />
                </div>
                <div>
                  <h3 className="font-medium text-stone-900">Agregar Video</h3>
                  <p className="text-xs text-stone-500">
                    YouTube, Vimeo o URL directa
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowVideoModal(false)}
                className="p-2 hover:bg-stone-100 rounded-lg transition-colors text-stone-400"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-400">
                  URL del Video
                </label>
                <input
                  type="text"
                  value={videoUrlInput}
                  onChange={(e) => setVideoUrlInput(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full p-4 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleSaveVideoUrl()}
                />
                <p className="text-[10px] text-stone-400">
                  Pega el link de YouTube, Vimeo o una URL directa a un archivo
                  de video.
                </p>
              </div>
              <button
                onClick={handleSaveVideoUrl}
                disabled={!videoUrlInput.trim()}
                className="w-full py-4 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                <Save size={20} />
                Guardar Video
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
