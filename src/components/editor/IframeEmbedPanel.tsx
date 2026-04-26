import { Frame } from "lucide-react";
import { usePresentation } from "../../presentation/contexts/PresentationContext";
import { useMinWidthLg } from "../../presentation/hooks/global/useMatchMedia";
import { cn } from "../../utils/cn";
import { sanitizeIframeEmbedSrc } from "../../utils/iframeEmbedUrl";
import type { Slide } from "../../types";

export interface IframeEmbedPanelProps {
  canvasPanelSlide?: Slide;
}

export function IframeEmbedPanel({ canvasPanelSlide }: IframeEmbedPanelProps = {}) {
  const { currentSlide } = usePresentation();
  const isLgUp = useMinWidthLg();

  if (!currentSlide) return null;

  const slide = canvasPanelSlide ?? currentSlide;
  const src = sanitizeIframeEmbedSrc(slide.iframeEmbedUrl ?? "");
  const hasEmbed = Boolean(src);

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
            "relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white dark:border-stone-300/40 dark:bg-stone-100",
          )}
        >
          <iframe
            src={src!}
            className="absolute inset-0 h-full w-full border-0"
            title="Contenido incrustado"
            referrerPolicy="strict-origin-when-cross-origin"
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
          <Frame size={40} strokeWidth={1.25} aria-hidden />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-stone-600 dark:text-stone-300">
            Iframe incrustado
          </p>
          <p className="text-xs leading-relaxed text-stone-400 dark:text-stone-500">
            Selecciona el bloque del panel en el lienzo y usa la{" "}
            <span className="font-medium text-stone-500 dark:text-stone-400">
              barra superior
            </span>
            : icono de marco (URL https de la página a incrustar).
          </p>
        </div>
      </div>
    </div>
  );
}
