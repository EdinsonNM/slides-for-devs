import { motion } from "motion/react";
import { Image as ImageIcon } from "lucide-react";
import { cn } from "../../utils/cn";
import { SlideMarkdown } from "../shared/SlideMarkdown";
import { CodeDisplay } from "../shared/CodeDisplay";
import { ExcalidrawViewer } from "../shared/ExcalidrawViewer";
import { getEmbedUrl } from "../../utils/video";
import type { Slide } from "../../types";

export interface PreviewSlideContentProps {
  slide: Slide;
  formatMarkdown: (content: string) => string;
  imageWidthPercent: number;
  /** Porcentaje de altura del panel en layout panel-full (resto = título). */
  panelHeightPercent?: number;
}

/**
 * Contenido de una diapositiva en vista previa (chapter o default con markdown + código/video/imagen).
 */
const DEFAULT_PANEL_HEIGHT_PERCENT = 85;

export function PreviewSlideContent({
  slide,
  formatMarkdown,
  imageWidthPercent,
  panelHeightPercent = DEFAULT_PANEL_HEIGHT_PERCENT,
}: PreviewSlideContentProps) {
  return (
    <motion.div
      key={slide.id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={cn(
        "preview-slide bg-white flex relative min-h-0",
        slide.type === "diagram"
          ? "w-full h-full max-w-none flex-col"
          : "w-full max-w-7xl 2xl:max-w-[1600px] aspect-video max-h-full",
        slide.type === "chapter" ? "justify-center items-center" : "",
        slide.contentLayout === "panel-full" ? "flex-col" : "",
      )}
    >
      {slide.type === "chapter" ? (
        <div className="text-center space-y-8">
          <div className="h-2 w-24 bg-emerald-600 mx-auto rounded-full" />
          <h1
            className="font-serif italic text-stone-900 leading-tight"
            style={{ fontSize: "var(--slide-title-chapter)" }}
          >
            {slide.title}
          </h1>
          {slide.subtitle && (
            <p
              className="text-stone-400 font-light tracking-widest uppercase"
              style={{ fontSize: "var(--slide-subtitle)" }}
            >
              {slide.subtitle}
            </p>
          )}
        </div>
      ) : slide.type === "diagram" ? (
        <div className="flex-1 min-h-0 min-w-0 w-full h-full overflow-hidden relative">
          <ExcalidrawViewer
            key={`${slide.id}-${slide.excalidrawData ? "dirty" : "empty"}`}
            excalidrawData={slide.excalidrawData}
            className="absolute inset-0 w-full h-full"
            fitToViewOnLoad
          />
        </div>
      ) : slide.contentLayout === "panel-full" ? (
        <>
          <div
            className="shrink-0 px-10 pt-8 pb-5 border-b border-stone-100 overflow-hidden flex flex-col justify-center"
            style={{ flex: `0 0 ${100 - panelHeightPercent}%` }}
          >
            <h2
              className="font-serif italic text-stone-900 leading-tight"
              style={{ fontSize: "var(--slide-title)" }}
            >
              {slide.title}
            </h2>
            {slide.subtitle && (
              <p
                className="text-stone-500 mt-1"
                style={{ fontSize: "var(--slide-subtitle)" }}
              >
                {slide.subtitle}
              </p>
            )}
            <div className="h-1.5 w-20 bg-emerald-600 rounded-full mt-4" />
          </div>
          <div
            className="min-h-0 min-w-0 p-8 flex items-center justify-center overflow-hidden"
            style={{ flex: `0 0 ${panelHeightPercent}%` }}
          >
            {slide.contentType === "code" ? (
              <CodeDisplay
                code={slide.code ?? ""}
                language={slide.language}
                fontSize={slide.fontSize ?? 14}
                showChrome={true}
                responsiveFontSize={true}
                className="w-full h-full"
              />
            ) : slide.contentType === "video" ? (
              <div className="w-full h-full bg-stone-900 rounded-2xl overflow-hidden border border-white/10">
                {slide.videoUrl ? (
                  <iframe
                    src={getEmbedUrl(slide.videoUrl)}
                    className="w-full h-full"
                    allowFullScreen
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-stone-500 italic">
                    // Sin video
                  </div>
                )}
              </div>
            ) : slide.imageUrl ? (
              <img
                src={slide.imageUrl}
                alt={slide.title}
                className="w-full h-full object-contain rounded-2xl"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-stone-300">
                <ImageIcon size={120} strokeWidth={1} />
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex-1 p-12 flex flex-col overflow-hidden min-h-0">
            <div className="shrink-0 mb-8">
              <h2
                className="font-serif italic text-stone-900 leading-tight mb-4"
                style={{ fontSize: "var(--slide-title)" }}
              >
                {slide.title}
              </h2>
              <div className="h-1.5 w-20 bg-emerald-600 rounded-full" />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto pr-4 scrollbar-on-hover">
              <SlideMarkdown>{formatMarkdown(slide.content)}</SlideMarkdown>
            </div>
          </div>
          <div
            className="flex flex-col relative"
            style={{ width: `${imageWidthPercent}%` }}
          >
            <div className="w-full h-full p-8 flex items-center justify-center">
              {slide.contentType === "code" ? (
                <CodeDisplay
                  code={slide.code ?? ""}
                  language={slide.language}
                  fontSize={slide.fontSize ?? 14}
                  showChrome={true}
                  responsiveFontSize={true}
                  className="w-full h-full"
                />
              ) : slide.contentType === "video" ? (
                <div className="w-full h-full bg-stone-900 rounded-2xl overflow-hidden border border-white/10">
                  {slide.videoUrl ? (
                    <iframe
                      src={getEmbedUrl(slide.videoUrl)}
                      className="w-full h-full"
                      allowFullScreen
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-stone-500 italic">
                      // Sin video
                    </div>
                  )}
                </div>
              ) : slide.imageUrl ? (
                <img
                  src={slide.imageUrl}
                  alt={slide.title}
                  className="w-full h-full object-cover rounded-2xl"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone-300">
                  <ImageIcon size={120} strokeWidth={1} />
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}
