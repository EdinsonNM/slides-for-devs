import { motion, AnimatePresence } from "motion/react";
import { Frame, X, Save } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";

export function IframeEmbedUrlModal() {
  const {
    showIframeEmbedModal,
    setShowIframeEmbedModal,
    iframeEmbedUrlInput,
    setIframeEmbedUrlInput,
    handleSaveIframeEmbedUrl,
  } = usePresentation();

  return (
    <AnimatePresence>
      {showIframeEmbedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm dark:bg-black/65"
            onClick={() => setShowIframeEmbedModal(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-surface-elevated dark:shadow-black/40"
          >
            <div className="flex items-center justify-between border-b border-stone-100 p-6 dark:border-border">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:text-slate-200">
                  <Frame size={20} />
                </div>
                <div>
                  <h3 className="font-medium text-stone-900 dark:text-foreground">
                    Iframe incrustado
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-muted-foreground">
                    URL https (algunos sitios bloquean iframes)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIframeEmbedModal(false)}
                className="rounded-lg p-2 text-stone-400 transition-colors hover:bg-stone-100 dark:text-stone-500 dark:hover:bg-stone-700"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-muted-foreground">
                  URL
                </label>
                <input
                  type="url"
                  value={iframeEmbedUrlInput}
                  onChange={(e) => setIframeEmbedUrlInput(e.target.value)}
                  placeholder="https://ejemplo.com/ruta"
                  className="w-full rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-900 transition-all placeholder:text-stone-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/20 dark:border-border dark:bg-surface dark:text-foreground dark:placeholder:text-stone-500 dark:focus:border-slate-400 dark:focus:ring-slate-400/25"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleSaveIframeEmbedUrl()}
                />
                <p className="text-[10px] text-stone-400 dark:text-muted-foreground">
                  Solo se aceptan enlaces <span className="font-medium">http</span> o{" "}
                  <span className="font-medium">https</span>.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveIframeEmbedUrl}
                disabled={!iframeEmbedUrlInput.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-700 py-4 font-medium text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-600 dark:hover:bg-slate-500"
              >
                <Save size={20} />
                Guardar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
