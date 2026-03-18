import { useRef, useState, useCallback, useEffect } from "react";
import { motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  ImagePlus,
  Trash2,
  Loader2,
  CloudUpload,
  Cloud,
} from "lucide-react";
import { cn } from "../../utils/cn";
import type { SavedPresentationMeta } from "../../types";

const CARD_GAP = 24;
const CARD_WIDTH_MOBILE = 260;
const CARD_SLOT_PADDING = 16;

const CARD_GRADIENTS = [
  "from-rose-500/90 to-red-600/90",
  "from-blue-500/90 to-indigo-600/90",
  "from-emerald-500/90 to-teal-600/90",
  "from-violet-500/90 to-purple-600/90",
  "from-amber-500/90 to-orange-600/90",
];

export interface SavedCarouselProps {
  savedList: SavedPresentationMeta[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onGenerateCover: (id: string) => void;
  generatingCoverId: string | null;
  coverImageCache: Record<string, string>;
  onOpenSavedListModal: () => void;
  cloudSyncAvailable?: boolean;
  onSyncToCloud?: (id: string) => void;
  syncingToCloudId?: string | null;
}

export function SavedCarousel({
  savedList,
  onOpen,
  onDelete,
  onGenerateCover,
  generatingCoverId,
  coverImageCache,
  onOpenSavedListModal,
  cloudSyncAvailable = false,
  onSyncToCloud,
  syncingToCloudId = null,
}: SavedCarouselProps) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const firstSlotRef = useRef<HTMLDivElement>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [carouselStep, setCarouselStep] = useState(
    CARD_WIDTH_MOBILE + CARD_SLOT_PADDING + 16
  );

  useEffect(() => {
    const container = carouselRef.current;
    if (!container || savedList.length < 2) {
      if (firstSlotRef.current)
        setCarouselStep(firstSlotRef.current.offsetWidth + 16);
      return;
    }
    const updateStep = () => {
      const children = container.children;
      if (children.length >= 2) {
        const first = (children[0] as HTMLElement).offsetLeft;
        const second = (children[1] as HTMLElement).offsetLeft;
        setCarouselStep(second - first);
      } else if (children.length === 1) {
        setCarouselStep((children[0] as HTMLElement).offsetWidth + 16);
      }
    };
    updateStep();
    const ro = new ResizeObserver(updateStep);
    ro.observe(container);
    return () => ro.disconnect();
  }, [savedList.length]);

  const scrollCarousel = (direction: "prev" | "next") => {
    const el = carouselRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction === "prev" ? -carouselStep : carouselStep,
      behavior: "smooth",
    });
  };

  const scrollToIndex = (index: number) => {
    const el = carouselRef.current;
    const slotEl = firstSlotRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(index, savedList.length - 1));
    const paddingLeft = slotEl ? slotEl.offsetLeft : 0;
    const slotWidth = slotEl ? slotEl.offsetWidth : 316;
    const targetScroll =
      paddingLeft + clamped * carouselStep - (el.clientWidth - slotWidth) / 2;
    el.scrollTo({ left: Math.max(0, targetScroll), behavior: "smooth" });
  };

  const updateCarouselIndex = useCallback(() => {
    const el = carouselRef.current;
    const slotEl = firstSlotRef.current;
    if (!el || savedList.length === 0) return;
    const scrollLeft = el.scrollLeft;
    const step = carouselStep || 1;
    const paddingLeft = slotEl ? slotEl.offsetLeft : 0;
    const slotWidth = slotEl ? slotEl.offsetWidth : 316;
    const center = scrollLeft + el.clientWidth / 2;
    const index = Math.round(
      (center - paddingLeft - slotWidth / 2) / step
    );
    setCarouselIndex((i) => {
      const next = Math.max(0, Math.min(index, savedList.length - 1));
      return next !== i ? next : i;
    });
  }, [savedList.length, carouselStep]);

  useEffect(() => {
    if (carouselIndex >= savedList.length && savedList.length > 0) {
      setCarouselIndex(Math.max(0, savedList.length - 1));
    }
  }, [savedList.length, carouselIndex]);

  const hasItems = savedList.length > 0;
  if (!hasItems) return null;

  return (
    <>
      <div className="flex items-center gap-2 sm:gap-3 w-full overflow-visible">
        {savedList.length > 2 && (
          <button
            type="button"
            onClick={() => scrollCarousel("prev")}
            disabled={carouselIndex === 0}
            className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/90 shadow-md border border-stone-200 flex items-center justify-center text-stone-600 hover:text-stone-900 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Anterior"
          >
            <ArrowLeft size={18} className="sm:w-5 sm:h-5" />
          </button>
        )}
        <div
          ref={carouselRef}
          onScroll={updateCarouselIndex}
          className="flex gap-3 sm:gap-4 overflow-x-auto overflow-y-visible scroll-smooth snap-x snap-mandatory flex-1 min-w-0 carousel-no-scrollbar py-2 pl-4 pr-[max(1.5rem,calc(50vw-10rem))] sm:pl-6 sm:pr-[max(1.5rem,calc(50vw-10.5rem))]"
          style={{
            scrollSnapType: "x mandatory",
            scrollbarWidth: "none",
            scrollPaddingInline: "0",
          }}
        >
          {savedList.map((p, index) => {
            const gradient = CARD_GRADIENTS[index % CARD_GRADIENTS.length];
            const isGeneratingCover = generatingCoverId === p.id;
            const isSyncingCloud = syncingToCloudId === p.id;
            const slotWidthClass = "w-[276px] sm:w-[316px]";
            return (
              <div
                key={p.id}
                ref={index === 0 ? firstSlotRef : undefined}
                className={cn("shrink-0 snap-center py-4 px-1", slotWidthClass)}
              >
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.3,
                    delay: index * 0.06,
                    ease: [0.25, 0.46, 0.45, 0.94],
                  }}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "rounded-2xl overflow-hidden text-left relative",
                    "shadow-lg border border-white/10 w-[260px] sm:w-[300px]",
                    !coverImageCache[p.id] && cn("bg-linear-to-br", gradient)
                  )}
                  style={{ minHeight: 280 }}
                >
                  {coverImageCache[p.id] && (
                    <div
                      className="absolute inset-0 bg-cover bg-center"
                      style={{
                        backgroundImage: `url(${coverImageCache[p.id]})`,
                      }}
                    />
                  )}
                  <div className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => onOpen(p.id)}
                    className="absolute inset-0 w-full h-full flex flex-col p-6 pt-14 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-inset z-0"
                  >
                    <div className="flex-1" />
                    <div className="text-white text-left">
                      <h3 className="text-lg font-bold leading-snug line-clamp-2">
                        {p.topic}
                      </h3>
                      <p className="text-sm text-white/85 mt-1">
                        {p.slideCount} diapositivas
                      </p>
                      <p className="text-xs text-white/70 mt-0.5">
                        {new Date(p.savedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </button>
                  {p.cloudId && (
                    <div
                      className="absolute top-5 left-5 z-30 flex items-center gap-1 rounded-lg bg-emerald-600/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white"
                      title="Sincronizada con la nube"
                    >
                      <Cloud size={12} />
                      Nube
                    </div>
                  )}
                  <div className="absolute top-5 right-5 flex flex-col gap-1 z-30 pointer-events-auto">
                    {cloudSyncAvailable && onSyncToCloud && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          onSyncToCloud(p.id);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        disabled={isGeneratingCover || isSyncingCloud}
                        className="p-2 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors disabled:opacity-60"
                        title="Sincronizar con la nube"
                      >
                        {isSyncingCloud ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <CloudUpload size={18} />
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onGenerateCover(p.id);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      disabled={isGeneratingCover}
                      className="p-2 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors disabled:opacity-60"
                      title="Generar imagen de portada"
                    >
                      <ImagePlus size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onDelete(p.id);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="p-2 rounded-lg bg-white/20 hover:bg-red-500/80 text-white transition-colors"
                      title="Eliminar presentación"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  {(isGeneratingCover || isSyncingCloud) && (
                    <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center z-20">
                      <Loader2 className="w-10 h-10 text-white animate-spin" />
                    </div>
                  )}
                </motion.div>
              </div>
            );
          })}
        </div>
        {savedList.length > 2 && (
          <button
            type="button"
            onClick={() => scrollCarousel("next")}
            disabled={carouselIndex >= savedList.length - 1}
            className="shrink-0 w-10 h-10 rounded-full bg-white/90 shadow-md border border-stone-200 flex items-center justify-center text-stone-600 hover:text-stone-900 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Siguiente"
          >
            <ArrowRight size={20} />
          </button>
        )}
      </div>
      {savedList.length > 1 && (
        <div
          className="flex justify-center gap-1.5 mt-4"
          role="tablist"
          aria-label="Navegación del carrusel"
        >
          {savedList.map((_, index) => (
            <button
              key={index}
              type="button"
              role="tab"
              aria-selected={carouselIndex === index}
              aria-label={`Ir a presentación ${index + 1}`}
              onClick={() => scrollToIndex(index)}
              className={cn(
                "rounded-full transition-all duration-200",
                carouselIndex === index
                  ? "w-6 h-2.5 bg-emerald-600"
                  : "w-2.5 h-2.5 bg-stone-300 hover:bg-stone-400"
              )}
            />
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={onOpenSavedListModal}
        className="mt-6 text-sm text-stone-500 hover:text-emerald-600 transition-colors"
      >
        Explorar todo →
      </button>
    </>
  );
}
