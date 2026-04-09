import { Image as ImageIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "../../utils/cn";
import { getEmbedUrl } from "../../utils/video";
import type { Slide } from "../../types";
import {
  SLIDE_TYPE,
  createEmptySlideMatrixData,
  normalizeSlideMatrixData,
} from "../../domain/entities";
import type { SlideCanvasElement } from "../../domain/entities";
import { ensureSlideCanvasScene } from "../../domain/slideCanvas/ensureSlideCanvasScene";
import { SlideMarkdown } from "../shared/SlideMarkdown";
import { CodeDisplay } from "../shared/CodeDisplay";
import { ExcalidrawViewer } from "../shared/ExcalidrawViewer";
import { Device3DViewport } from "../shared/Device3DViewport";
import { SlideMatrixTable } from "../shared/SlideMatrixTable";

export interface SlideCanvasViewProps {
  slide: Slide;
  formatMarkdown: (md: string) => string;
  /** Contenedor ya en 16:9; el lienzo llena el área útil. */
  className?: string;
}

function mediaBlock(slide: Slide) {
  if (slide.contentType === "code") {
    return (
      <CodeDisplay
        code={slide.code ?? ""}
        language={slide.language}
        fontSize={slide.fontSize ?? 14}
        showChrome
        responsiveFontSize
        className="h-full min-h-0 w-full"
      />
    );
  }
  if (slide.contentType === "video") {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-stone-900">
        {slide.videoUrl ? (
          <iframe
            src={getEmbedUrl(slide.videoUrl)}
            className="h-full w-full"
            allowFullScreen
            title="Video"
          />
        ) : (
          <span className="text-stone-500 italic">Sin video</span>
        )}
      </div>
    );
  }
  if (slide.contentType === "presenter3d") {
    return (
      <div className="h-full min-h-0 w-full overflow-hidden rounded-xl">
        <Device3DViewport
          slideId={slide.id}
          deviceId={slide.presenter3dDeviceId}
          screenMedia={slide.presenter3dScreenMedia ?? "image"}
          imageUrl={slide.imageUrl}
          videoUrl={slide.videoUrl}
          viewState={slide.presenter3dViewState}
          showInteractionHint={false}
          className="h-full min-h-[120px]"
        />
      </div>
    );
  }
  if (slide.imageUrl) {
    return (
      <img
        src={slide.imageUrl}
        alt={slide.title}
        className="h-full w-full object-contain"
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <div className="flex h-full w-full items-center justify-center text-stone-300">
      <ImageIcon size={64} strokeWidth={1} />
    </div>
  );
}

function CanvasElementReadOnly({
  element,
  slide,
  formatMarkdown,
}: {
  element: SlideCanvasElement;
  slide: Slide;
  formatMarkdown: (md: string) => string;
}) {
  const { rect, kind, z } = element;
  const rotation = element.rotation ?? 0;
  const box: CSSProperties = {
    left: `${rect.x}%`,
    top: `${rect.y}%`,
    width: `${rect.w}%`,
    height: `${rect.h}%`,
    zIndex: z,
  };
  const shell = "absolute min-h-0 min-w-0 overflow-hidden";

  const rotated = (className: string, children: ReactNode) => (
    <div
      className={cn("min-h-0 min-w-0", className)}
      style={
        rotation
          ? {
              transform: `rotate(${rotation}deg)`,
              transformOrigin: "center center",
            }
          : undefined
      }
    >
      {children}
    </div>
  );

  switch (kind) {
    case "sectionLabel":
      return null;
    case "title":
      return (
        <div style={box} className={shell}>
          {rotated(
            "flex h-full min-h-0 w-full flex-col overflow-hidden px-2 py-1",
            <>
              <h2
                className="min-w-0 w-full max-w-full font-serif italic leading-tight text-stone-900 dark:text-stone-100 whitespace-pre-wrap wrap-break-word"
                style={{ fontSize: "var(--slide-title)" }}
              >
                {slide.title}
              </h2>
              <div className="mt-2 h-1.5 w-20 shrink-0 rounded-full bg-emerald-600" />
            </>,
          )}
        </div>
      );
    case "subtitle":
      if (!slide.subtitle) return null;
      return (
        <div style={box} className={shell}>
          {rotated(
            "flex h-full min-h-0 w-full flex-col overflow-hidden px-2 py-0.5",
            <p
              className="min-w-0 w-full max-w-full text-stone-500 dark:text-stone-300 whitespace-pre-wrap wrap-break-word"
              style={{ fontSize: "var(--slide-subtitle)" }}
            >
              {slide.subtitle}
            </p>,
          )}
        </div>
      );
    case "chapterTitle":
      return (
        <div style={box} className={shell}>
          {rotated(
            "flex h-full min-h-0 w-full flex-col items-center justify-start overflow-hidden px-3 text-center",
            <>
              <div className="mb-3 h-1 w-14 shrink-0 rounded-full bg-emerald-600 md:mb-4" />
              <h1
                className="min-w-0 w-full max-w-full font-serif italic leading-tight text-stone-900 dark:text-stone-100 whitespace-pre-wrap wrap-break-word"
                style={{ fontSize: "var(--slide-title-chapter)" }}
              >
                {slide.title}
              </h1>
            </>,
          )}
        </div>
      );
    case "chapterSubtitle":
      if (!slide.subtitle) return null;
      return (
        <div style={box} className={shell}>
          {rotated(
            "flex h-full min-h-0 w-full items-start justify-center overflow-hidden px-3 text-center text-stone-400 dark:text-stone-400",
            <p
              className="min-w-0 w-full max-w-full font-light uppercase tracking-widest whitespace-pre-wrap wrap-break-word"
              style={{ fontSize: "var(--slide-subtitle)" }}
            >
              {slide.subtitle}
            </p>,
          )}
        </div>
      );
    case "markdown":
      return (
        <div style={box} className={shell}>
          {rotated(
            "h-full overflow-y-auto px-2 py-1 scrollbar-on-hover",
            slide.content?.trim() ? (
              <SlideMarkdown>{formatMarkdown(slide.content)}</SlideMarkdown>
            ) : null,
          )}
        </div>
      );
    case "mediaPanel":
      if (slide.type !== SLIDE_TYPE.CONTENT) return null;
      return (
        <div style={box} className={shell}>
          {rotated("h-full p-1 md:p-2", mediaBlock(slide))}
        </div>
      );
    case "matrix":
      if (slide.type !== SLIDE_TYPE.MATRIX) return null;
      return (
        <div style={box} className={shell}>
          {rotated(
            "h-full overflow-y-auto px-1 py-1 scrollbar-on-hover",
            <SlideMatrixTable
              presentationDensity="preview"
              data={normalizeSlideMatrixData(
                slide.matrixData ?? createEmptySlideMatrixData(),
              )}
            />,
          )}
        </div>
      );
    case "matrixNotes":
      if (slide.type !== SLIDE_TYPE.MATRIX || !slide.content?.trim()) return null;
      return (
        <div style={box} className={shell}>
          {rotated(
            "h-full overflow-y-auto border-t border-stone-100 px-2 py-1 dark:border-border",
            <SlideMarkdown>{formatMarkdown(slide.content)}</SlideMarkdown>,
          )}
        </div>
      );
    case "excalidraw":
      return (
        <div style={box} className={cn(shell, "bg-white dark:bg-surface-elevated")}>
          {rotated(
            "absolute inset-0 min-h-0",
            <ExcalidrawViewer
              key={`${slide.id}-${slide.excalidrawData ? "x" : "empty"}`}
              excalidrawData={slide.excalidrawData}
              className="absolute inset-0 h-full w-full"
              fitToViewOnLoad
            />,
          )}
        </div>
      );
    default:
      return null;
  }
}

/** Vista previa / presentador: lienzo a partir de `canvasScene` (migra si hace falta). */
export function SlideCanvasView({
  slide,
  formatMarkdown,
  className,
}: SlideCanvasViewProps) {
  const ensured = ensureSlideCanvasScene(slide);
  const scene = ensured.canvasScene!;
  const sorted = [...scene.elements].sort((a, b) => a.z - b.z);

  return (
    <div className={cn("relative h-full min-h-0 w-full min-w-0", className)}>
      {sorted.map((el) => (
        <CanvasElementReadOnly
          key={el.id}
          element={el}
          slide={ensured}
          formatMarkdown={formatMarkdown}
        />
      ))}
    </div>
  );
}
