import { Video, Pencil } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { getEmbedUrl } from "../../utils/video";
import { useMinWidthLg } from "../../hooks/useMatchMedia";
import { cn } from "../../utils/cn";

export function VideoPanel() {
  const { currentSlide, setVideoUrlInput, setShowVideoModal } =
    usePresentation();
  const isLgUp = useMinWidthLg();

  if (!currentSlide) return null;

  const openVideoModal = () => {
    setVideoUrlInput(currentSlide.videoUrl || "");
    setShowVideoModal(true);
  };

  /** Misma idea que `ImagePanel`: el panel llena el alto del `SlideRightPanel` / bloque. */
  const outerFill =
    "flex min-h-0 w-full flex-1 flex-col overflow-hidden";

  if (currentSlide.videoUrl) {
    return (
      <div
        className={cn(
          outerFill,
          "h-full",
          isLgUp ? "p-0" : "p-3",
        )}
      >
        <div
          className={cn(
            "group/video relative min-h-0 w-full flex-1 overflow-hidden rounded-2xl border border-white/10 bg-stone-900",
          )}
        >
          <iframe
            src={getEmbedUrl(currentSlide.videoUrl)}
            className="absolute inset-0 h-full w-full border-0"
            allowFullScreen
            title="Vídeo incrustado"
          />
          {!isLgUp && (
            <button
              type="button"
              onClick={openVideoModal}
              className="absolute bottom-4 right-4 rounded-lg border border-stone-200 bg-white/80 p-2 text-stone-600 shadow-lg backdrop-blur-sm transition-all hover:text-emerald-600 opacity-0 group-hover/video:opacity-100"
              title="Cambiar vídeo"
            >
              <Pencil size={16} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        outerFill,
        "h-full items-stretch justify-stretch p-4 md:p-6",
      )}
    >
      <button
        type="button"
        onClick={() => setShowVideoModal(true)}
        className="group flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-stone-200 text-stone-400 transition-all hover:border-emerald-300 hover:bg-emerald-50/50 hover:text-emerald-500 dark:border-stone-600 dark:hover:border-emerald-600 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-400"
      >
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-stone-100 transition-colors group-hover:bg-emerald-100 dark:bg-stone-800 dark:group-hover:bg-emerald-900/40">
          <Video size={32} />
        </div>
        <div className="text-center">
          <p className="font-medium">Agregar video</p>
          <p className="text-xs">YouTube, Vimeo o URL directa</p>
        </div>
      </button>
    </div>
  );
}
