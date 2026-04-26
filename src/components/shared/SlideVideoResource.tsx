import { isDirectVideoFileResourceUrl } from "../../utils/directVideoUrl";
import { getEmbedUrl } from "../../utils/video";
import { cn } from "../../utils/cn";

export function SlideVideoResource({
  videoUrl,
  className,
  videoClassName,
  iframeTitle = "Vídeo incrustado",
}: {
  videoUrl: string;
  className?: string;
  /** Clases en el nodo de vídeo o iframe. */
  videoClassName?: string;
  iframeTitle?: string;
}) {
  const trimmed = videoUrl.trim();
  if (isDirectVideoFileResourceUrl(trimmed)) {
    return (
      <div
        className={cn(
          "flex h-full min-h-0 w-full min-w-0 items-center justify-center overflow-hidden bg-transparent",
          className,
        )}
      >
        <video
          className={cn(
            "max-h-full max-w-full object-contain object-center",
            videoClassName,
          )}
          src={trimmed}
          controls
          playsInline
          preload="metadata"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative h-full min-h-0 w-full min-w-0 overflow-hidden",
        className,
      )}
    >
      <iframe
        title={iframeTitle}
        src={getEmbedUrl(trimmed)}
        className={cn(
          "absolute inset-0 h-full w-full max-h-full min-h-0 min-w-0 border-0",
          videoClassName,
        )}
        allowFullScreen
      />
    </div>
  );
}
