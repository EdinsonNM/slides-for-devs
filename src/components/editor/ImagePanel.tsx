import { useState, useRef, useEffect } from "react";
import { Image as ImageIcon, Sparkles, Upload, ChevronDown } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";
import { useMinWidthLg } from "../../hooks/useMatchMedia";
import type { Slide } from "../../types";

export interface ImagePanelProps {
  canvasPanelSlide?: Slide;
}

export function ImagePanel({ canvasPanelSlide }: ImagePanelProps = {}) {
  const { currentSlide, openImageModal, openImageUploadModal } = usePresentation();
  const isLgUp = useMinWidthLg();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuOpen]);

  if (!currentSlide) return null;

  const slide = canvasPanelSlide ?? currentSlide;

  const handleOpenGenerate = () => {
    setMenuOpen(false);
    openImageModal();
  };

  const handleOpenUpload = () => {
    setMenuOpen(false);
    openImageUploadModal();
  };

  if (isLgUp) {
    return (
      <div className="flex-1 flex items-center justify-center relative h-full min-h-0">
        {slide.imageUrl ? (
          <img
            src={slide.imageUrl}
            alt={slide.title}
            className="w-full h-full object-cover select-none"
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="text-center space-y-3 p-6 max-w-sm">
            <div className="w-16 h-16 rounded-full bg-stone-200 dark:bg-stone-700 flex items-center justify-center mx-auto text-stone-400 dark:text-stone-300">
              <ImageIcon size={32} />
            </div>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Usa el panel derecho <span className="font-medium">Propiedades del panel</span> para generar o
              subir una imagen.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={menuRef}
      className="flex-1 flex items-center justify-center relative cursor-pointer h-full"
      onClick={() => setMenuOpen((v) => !v)}
    >
      {slide.imageUrl ? (
        <img
          src={slide.imageUrl}
          alt={slide.title}
          className="w-full h-full object-cover select-none"
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="text-center space-y-3 p-6">
          <div className="w-16 h-16 rounded-full bg-stone-200 dark:bg-stone-700 flex items-center justify-center mx-auto text-stone-400 dark:text-stone-300 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/50 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
            <ImageIcon size={32} />
          </div>
          <p className="text-sm text-stone-400 dark:text-stone-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 font-medium transition-colors">
            Click para generar o subir imagen
          </p>
        </div>
      )}
      <div className="absolute inset-0 bg-emerald-600/0 group-hover:bg-emerald-600/5 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
        <div className="px-4 py-2 bg-white dark:bg-surface-elevated rounded-full shadow-lg text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-2 transform translate-y-2 group-hover:translate-y-0 transition-transform border border-stone-200 dark:border-border">
          <ChevronDown size={16} />
          {slide.imageUrl ? "Cambiar imagen" : "Añadir imagen"}
        </div>
      </div>

      {menuOpen && (
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 mt-2 w-52 bg-white dark:bg-surface-elevated rounded-xl shadow-xl border border-stone-200 dark:border-border py-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={handleOpenGenerate}
            className={cn(
              "w-full px-4 py-3 text-left text-sm font-medium text-stone-700 dark:text-foreground hover:bg-emerald-50 dark:hover:bg-emerald-900/40 hover:text-emerald-700 dark:hover:text-emerald-400 flex items-center gap-3 rounded-t-xl transition-colors",
            )}
          >
            <Sparkles size={18} className="text-emerald-500 dark:text-emerald-400" />
            Generar imagen
          </button>
          <button
            type="button"
            onClick={handleOpenUpload}
            className={cn(
              "w-full px-4 py-3 text-left text-sm font-medium text-stone-700 dark:text-foreground hover:bg-emerald-50 dark:hover:bg-emerald-900/40 hover:text-emerald-700 dark:hover:text-emerald-400 flex items-center gap-3 rounded-b-xl transition-colors border-t border-stone-100 dark:border-border",
            )}
          >
            <Upload size={18} className="text-emerald-500" />
            Cargar imagen
          </button>
        </div>
      )}
    </div>
  );
}
