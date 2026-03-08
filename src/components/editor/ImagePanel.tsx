import { Image as ImageIcon, Sparkles } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";

export function ImagePanel() {
  const { currentSlide, openImageModal } = usePresentation();

  if (!currentSlide) return null;

  return (
    <div
      className="flex-1 flex items-center justify-center relative cursor-pointer h-full"
      onClick={openImageModal}
    >
      {currentSlide.imageUrl ? (
        <img
          src={currentSlide.imageUrl}
          alt={currentSlide.title}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="text-center space-y-3 p-6">
          <div className="w-16 h-16 rounded-full bg-stone-200 flex items-center justify-center mx-auto text-stone-400 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors">
            <ImageIcon size={32} />
          </div>
          <p className="text-sm text-stone-400 group-hover:text-emerald-600 font-medium transition-colors">
            Click para generar o subir imagen
          </p>
        </div>
      )}
      <div className="absolute inset-0 bg-emerald-600/0 group-hover:bg-emerald-600/5 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
        <div className="px-4 py-2 bg-white rounded-full shadow-lg text-emerald-600 font-medium flex items-center gap-2 transform translate-y-2 group-hover:translate-y-0 transition-transform">
          <Sparkles size={16} />
          {currentSlide.imageUrl ? "Cambiar Imagen" : "Añadir Imagen"}
        </div>
      </div>
    </div>
  );
}
