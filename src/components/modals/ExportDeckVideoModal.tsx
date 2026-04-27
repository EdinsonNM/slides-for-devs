import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Player } from "@remotion/player";
import { Clapperboard, Loader2, X } from "lucide-react";
import { usePresentation } from "@/presentation/contexts/PresentationContext";
import { deckThemeToExportBackgroundCss } from "../../domain/entities";
import { DeckVideoComposition } from "../../remotion/DeckVideoComposition";
import {
  DECK_VIDEO_FPS,
  DECK_VIDEO_FRAMES_PER_SLIDE,
  DECK_VIDEO_HEIGHT,
  DECK_VIDEO_WIDTH,
  getDeckVideoDurationInFrames,
} from "../../remotion/deckVideoConstants";
import { mapSlidesForDeckVideoExport } from "../../remotion/deckVideoTypes";
import { downloadDeckPresentationMp4 } from "../../services/exportDeckVideo";
import { openExternalLink } from "../../utils/openExternalLink";

const REMOTION_CSR_DOC = "https://www.remotion.dev/docs/client-side-rendering";

export function ExportDeckVideoModal() {
  const {
    showExportDeckVideoModal,
    setShowExportDeckVideoModal,
    slides,
    topic,
    deckVisualTheme,
  } = usePresentation();

  const [progress01, setProgress01] = useState(0);
  const [isRendering, setIsRendering] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const deckSlides = useMemo(() => mapSlidesForDeckVideoExport(slides), [slides]);
  const exportBackdropCss = useMemo(
    () => deckThemeToExportBackgroundCss(deckVisualTheme),
    [deckVisualTheme],
  );
  const durationInFrames = getDeckVideoDurationInFrames(slides.length);
  const secondsPerSlide = DECK_VIDEO_FRAMES_PER_SLIDE / DECK_VIDEO_FPS;

  const handleClose = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setShowExportDeckVideoModal(false);
    setProgress01(0);
    setIsRendering(false);
  };

  const handleExportMp4 = async () => {
    if (slides.length === 0) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setIsRendering(true);
    setProgress01(0);
    try {
      await downloadDeckPresentationMp4({
        topic: topic || "Presentación",
        slidesPayload: deckSlides,
        signal: abortRef.current.signal,
        onProgress: (p) => setProgress01(p),
        exportBackdropCss,
      });
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      console.error(e);
      alert(
        "No se pudo generar el vídeo. Prueba con Chrome o Edge (render en navegador con WebCodecs). Si el fallo persiste, revisa la consola.",
      );
    } finally {
      setIsRendering(false);
      abortRef.current = null;
    }
  };

  return (
    <AnimatePresence>
      {showExportDeckVideoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            onClick={() => !isRendering && handleClose()}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-surface-elevated"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-stone-100 px-5 py-4 dark:border-border sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-600 dark:bg-sky-900/50 dark:text-sky-400">
                  <Clapperboard size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-medium text-stone-900 dark:text-foreground">
                    Exportar presentación a vídeo
                  </h3>
                  <p className="truncate text-xs text-stone-500 dark:text-muted-foreground">
                    Remotion en el navegador · {slides.length} diapositivas · ~
                    {secondsPerSlide.toFixed(0)} s por slide (título → texto →
                    imágenes)
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isRendering}
                onClick={handleClose}
                className="rounded-lg p-2 text-stone-400 transition-colors hover:bg-stone-100 disabled:opacity-40 dark:hover:bg-stone-700 dark:text-stone-500"
              >
                <X size={20} />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">
              <div
                className="relative w-full overflow-hidden rounded-xl border border-stone-200 bg-stone-950 dark:border-stone-700"
                style={{ aspectRatio: `${DECK_VIDEO_WIDTH} / ${DECK_VIDEO_HEIGHT}` }}
              >
                {slides.length > 0 ? (
                  <Player
                    key={`${slides.map((s) => s.id).join("\0")}\0${exportBackdropCss}`}
                    component={DeckVideoComposition}
                    inputProps={{
                      slides: deckSlides,
                      exportBackdropCss,
                    }}
                    durationInFrames={durationInFrames}
                    compositionWidth={DECK_VIDEO_WIDTH}
                    compositionHeight={DECK_VIDEO_HEIGHT}
                    fps={DECK_VIDEO_FPS}
                    controls
                    loop
                    style={{ width: "100%", height: "100%" }}
                  />
                ) : (
                  <div className="flex h-full min-h-[200px] items-center justify-center text-sm text-stone-500">
                    No hay diapositivas.
                  </div>
                )}
              </div>

              {isRendering ? (
                <div className="space-y-2">
                  <div className="h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
                    <div
                      className="h-full rounded-full bg-sky-500 transition-[width] duration-200"
                      style={{
                        width: `${Math.round(Math.min(1, Math.max(0, progress01)) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-center text-xs text-stone-500 dark:text-stone-400">
                    Codificando vídeo… {Math.round(progress01 * 100)}%
                  </p>
                </div>
              ) : null}

              <p className="text-[11px] leading-relaxed text-stone-500 dark:text-stone-500">
                El fondo del vídeo es una versión estática de tu tema (sin
                animación WebGL). La exportación usa el renderizado experimental de
                Remotion en el cliente (WebCodecs). Funciona mejor en{" "}
                <span className="font-medium">Chrome u Edge</span>. Presentaciones
                largas pueden tardar varios minutos.{" "}
                <a
                  href={REMOTION_CSR_DOC}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-emerald-600 underline-offset-2 hover:underline dark:text-emerald-400"
                  onClick={(e) => {
                    e.preventDefault();
                    void openExternalLink(REMOTION_CSR_DOC);
                  }}
                >
                  Documentación
                </a>
              </p>

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={isRendering}
                  onClick={handleClose}
                  className="rounded-xl border border-stone-200 px-4 py-3 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-50 dark:border-stone-600 dark:text-stone-200 dark:hover:bg-stone-800"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  disabled={isRendering || slides.length === 0}
                  onClick={() => void handleExportMp4()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-sky-600 dark:hover:bg-sky-500"
                >
                  {isRendering ? (
                    <Loader2 size={18} className="animate-spin" aria-hidden />
                  ) : (
                    <Clapperboard size={18} aria-hidden />
                  )}
                  {isRendering ? "Generando MP4…" : "Descargar MP4"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
