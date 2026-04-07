import { Video, Pencil } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { getEmbedUrl } from "../../utils/video";
import { useMinWidthLg } from "../../hooks/useMatchMedia";

export function VideoPanel() {
  const { currentSlide, setVideoUrlInput, setShowVideoModal } =
    usePresentation();
  const isLgUp = useMinWidthLg();

  if (!currentSlide) return null;

  if (currentSlide.videoUrl) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center">
        <div className="w-full aspect-video bg-stone-900 rounded-2xl overflow-hidden border border-white/10 relative group/video">
          <iframe
            src={getEmbedUrl(currentSlide.videoUrl)}
            className="w-full h-full"
            allowFullScreen
          />
          {!isLgUp && (
            <button
              onClick={() => {
                setVideoUrlInput(currentSlide.videoUrl || "");
                setShowVideoModal(true);
              }}
              className="absolute bottom-4 right-4 p-2 bg-white/80 backdrop-blur-sm border border-stone-200 rounded-lg text-stone-600 hover:text-emerald-600 transition-all shadow-lg opacity-0 group-hover/video:opacity-100"
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
    <div className="flex-1 p-8 flex items-center justify-center">
      <button
        onClick={() => setShowVideoModal(true)}
        className="w-full max-w-md aspect-video border-2 border-dashed border-stone-200 rounded-2xl flex flex-col items-center justify-center gap-4 text-stone-400 hover:border-emerald-300 hover:text-emerald-500 hover:bg-emerald-50/50 transition-all group"
      >
        <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
          <Video size={32} />
        </div>
        <div className="text-center">
          <p className="font-medium">Agregar Video</p>
          <p className="text-xs">YouTube, Vimeo o URL directa</p>
        </div>
      </button>
    </div>
  );
}
