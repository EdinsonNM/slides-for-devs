import { Video } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { getEmbedUrl } from "../../utils/video";
import { useMinWidthLg } from "../../hooks/useMatchMedia";
import { cn } from "../../utils/cn";
import type { Slide } from "../../types";

export interface VideoPanelProps {
  canvasPanelSlide?: Slide;
}

export function VideoPanel({ canvasPanelSlide }: VideoPanelProps = {}) {
  const { currentSlide } = usePresentation();
  const isLgUp = useMinWidthLg();

  if (!currentSlide) return null;

  const slide = canvasPanelSlide ?? currentSlide;

  const hasEmbed = Boolean(slide.videoUrl?.trim());

  const outerFill =
    "relative flex min-h-0 w-full flex-1 flex-col overflow-hidden";

  if (hasEmbed) {
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
            "relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-stone-900",
          )}
        >
          <iframe
            src={getEmbedUrl(slide.videoUrl!)}
            className="absolute inset-0 h-full w-full border-0"
            allowFullScreen
            title="Vídeo incrustado"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        outerFill,
        "h-full items-center justify-center",
        isLgUp ? "p-0" : "p-4",
      )}
    >
      <div className="flex max-w-sm flex-col items-center gap-4 px-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-stone-100 text-stone-300 dark:bg-stone-800 dark:text-stone-600">
          <Video size={40} strokeWidth={1.25} aria-hidden />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-stone-600 dark:text-stone-300">
            Panel de vídeo
          </p>
          <p className="text-xs leading-relaxed text-stone-400 dark:text-stone-500">
            Selecciona el bloque del panel en el lienzo y usa la{" "}
            <span className="font-medium text-stone-500 dark:text-stone-400">
              barra superior
            </span>
            : icono de vídeo (URL de YouTube, Vimeo o directa).
          </p>
        </div>
      </div>
    </div>
  );
}
