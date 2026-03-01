import { Code2, Video, Image as ImageIcon } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";
import { CodeBlock } from "./CodeBlock";
import { ImagePanel } from "./ImagePanel";
import { VideoPanel } from "./VideoPanel";

export function SlideRightPanel() {
  const {
    currentSlide,
    imageWidthPercent,
    isResizing,
    setIsResizing,
    toggleContentType,
  } = usePresentation();

  if (!currentSlide) return null;

  return (
    <div
      className="bg-white border-l border-stone-200 flex flex-col relative group"
      style={{ width: `${imageWidthPercent}%` }}
    >
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-emerald-500/30 transition-colors z-30 flex items-center justify-center group/handle"
      >
        <div className="w-0.5 h-8 bg-stone-300 group-hover/handle:bg-emerald-500 rounded-full" />
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleContentType();
        }}
        className="absolute top-4 right-4 z-20 p-2 bg-white/80 backdrop-blur-sm border border-stone-200 rounded-lg text-stone-600 hover:text-emerald-600 hover:border-emerald-200 transition-all shadow-sm opacity-0 group-hover:opacity-100 flex items-center gap-2"
        title="Cambiar tipo de contenido"
      >
        {currentSlide.contentType === "code" ? (
          <>
            <Video size={18} />
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Video
            </span>
          </>
        ) : currentSlide.contentType === "video" ? (
          <>
            <ImageIcon size={18} />
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Imagen
            </span>
          </>
        ) : (
          <>
            <Code2 size={18} />
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Código
            </span>
          </>
        )}
      </button>

      {currentSlide.contentType === "code" ? (
        <CodeBlock />
      ) : currentSlide.contentType === "video" ? (
        <VideoPanel />
      ) : (
        <ImagePanel />
      )}
    </div>
  );
}
