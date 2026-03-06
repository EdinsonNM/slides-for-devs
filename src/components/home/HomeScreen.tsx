import { useRef, useState, useCallback, useEffect } from "react";
import { motion } from "motion/react";
import {
  Loader2,
  MoreVertical,
  Plus,
  Mic,
  ArrowUp,
  ArrowLeft,
  ArrowRight,
  ImagePlus,
  Trash2,
} from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";

const CARD_GAP = 24;
/** Ancho base; en móvil se usa menor vía Tailwind (w-[260px] sm:w-[300px]) */
const CARD_WIDTH_DESKTOP = 300;
const CARD_WIDTH_MOBILE = 260;
const CARD_SLOT_PADDING = 16;

// Gradientes para tarjetas del historial (rotación por índice)
const CARD_GRADIENTS = [
  "from-rose-500/90 to-red-600/90",
  "from-blue-500/90 to-indigo-600/90",
  "from-emerald-500/90 to-teal-600/90",
  "from-violet-500/90 to-purple-600/90",
  "from-amber-500/90 to-orange-600/90",
];

type PresentationModel = { id: string; label: string };

// Input tipo píldora (fuera del componente para evitar re-mounts y permitir escribir)
function PromptInput({
  onSubmit,
  value,
  onChange,
  disabled,
  placeholder,
  minRows = 2,
  showPlan = true,
  className = "",
  presentationModelId,
  setPresentationModelId,
  presentationModels,
  compact = false,
}: {
  onSubmit: (e: React.FormEvent) => void;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  placeholder: string;
  minRows?: number;
  maxRows?: number;
  showPlan?: boolean;
  className?: string;
  presentationModelId?: string;
  setPresentationModelId?: (id: string) => void;
  presentationModels?: PresentationModel[];
  compact?: boolean;
}) {
  const showModel = presentationModelId != null && setPresentationModelId != null && presentationModels != null && presentationModels.length > 0;

  // Variante compacta: una línea que se expande al hacer focus (flotante)
  if (compact) {
    return (
      <form onSubmit={onSubmit} className={cn("w-full", className)}>
        <div
          className={cn(
            "group w-full rounded-[28px] border border-stone-200 bg-white overflow-hidden transition-all duration-200 ease-out",
            "min-h-[52px] focus-within:min-h-[120px]",
            "shadow-md focus-within:shadow-xl focus-within:ring-2 focus-within:ring-emerald-500/20"
          )}
          style={{ boxShadow: "0 2px 8px 0 rgba(0,0,0,0.06)" }}
        >
          <div className="flex flex-row items-center gap-2 px-4 py-2.5 focus-within:flex-col focus-within:items-stretch focus-within:py-4 transition-all duration-200">
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder={placeholder}
              rows={1}
              className="w-full min-h-[28px] max-h-32 resize-none bg-transparent text-stone-800 placeholder:text-stone-400 text-base focus:outline-none py-0 min-w-0 group-focus-within:min-h-[72px]"
              disabled={disabled}
            />
            <div className="flex items-center justify-between gap-2 shrink-0 focus-within:w-full focus-within:pt-1">
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  className="p-1.5 rounded-lg text-stone-600 hover:bg-stone-100 transition-colors"
                  title="Añadir"
                  aria-label="Añadir"
                >
                  <Plus size={20} />
                </button>
                {showPlan && (
                  <span className="text-sm text-stone-700 font-normal">Plan</span>
                )}
                <button
                  type="button"
                  className="p-1.5 rounded-lg text-stone-600 hover:bg-stone-100 transition-colors"
                  title="Entrada de voz"
                  aria-label="Micrófono"
                >
                  <Mic size={20} />
                </button>
                {showModel && (
                  <select
                    value={presentationModelId}
                    onChange={(e) => setPresentationModelId(e.target.value)}
                    disabled={disabled}
                    className="text-xs text-stone-600 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 cursor-pointer min-w-0 max-w-[180px]"
                    aria-label="Modelo para generar la presentación"
                  >
                    {presentationModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <button
                type="submit"
                disabled={disabled || !value.trim()}
                className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                aria-label="Enviar"
              >
                {disabled ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <ArrowUp size={18} />
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    );
  }

  // Variante expandida (página inicial)
  return (
    <form onSubmit={onSubmit} className={cn("w-full", className)}>
      <div
        className="w-full rounded-[28px] border border-stone-200 bg-white shadow-md overflow-hidden flex flex-col min-h-[120px]"
        style={{ boxShadow: "0 2px 8px 0 rgba(0,0,0,0.06), inset 0 1px 0 0 rgba(255,255,255,0.8)" }}
      >
        <div className="flex-1 flex flex-col px-4 pt-4 pb-1">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={placeholder}
            rows={minRows}
            className="w-full min-h-[72px] max-h-32 resize-none bg-transparent text-stone-800 placeholder:text-stone-400 text-base focus:outline-none py-0"
            disabled={disabled}
          />
        </div>
        <div className="flex items-center justify-between px-4 pb-3 pt-1 gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              className="p-1.5 rounded-lg text-stone-600 hover:bg-stone-100 transition-colors"
              title="Añadir"
              aria-label="Añadir"
            >
              <Plus size={20} />
            </button>
            {showPlan && (
              <span className="text-sm text-stone-700 font-normal">Plan</span>
            )}
            <button
              type="button"
              className="p-1.5 rounded-lg text-stone-600 hover:bg-stone-100 transition-colors"
              title="Entrada de voz"
              aria-label="Micrófono"
            >
              <Mic size={20} />
            </button>
            {showModel && (
              <select
                value={presentationModelId}
                onChange={(e) => setPresentationModelId(e.target.value)}
                disabled={disabled}
                className="text-xs text-stone-600 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 cursor-pointer min-w-0 max-w-[180px]"
                aria-label="Modelo para generar la presentación"
              >
                {presentationModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            )}
          </div>
          <button
            type="submit"
            disabled={disabled || !value.trim()}
            className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
            aria-label="Enviar"
          >
            {disabled ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <ArrowUp size={18} />
            )}
          </button>
        </div>
      </div>
    </form>
  );
}

interface HomeScreenProps {
  onOpenConfig?: () => void;
}

export function HomeScreen(props: HomeScreenProps) {
  const { onOpenConfig } = props;
  const {
    topic,
    setTopic,
    isLoading,
    handleGenerate,
    openSavedListModal,
    savedList,
    handleOpenSaved,
    handleDeleteSaved,
    generatingCoverId,
    handleGenerateCoverForPresentation,
    coverImageCache,
    presentationModelId,
    setPresentationModelId,
    presentationModels,
  } = usePresentation();

  const carouselRef = useRef<HTMLDivElement>(null);
  const firstSlotRef = useRef<HTMLDivElement>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [carouselStep, setCarouselStep] = useState(
    CARD_WIDTH_MOBILE + CARD_SLOT_PADDING + 16
  );

  useEffect(() => {
    const container = carouselRef.current;
    if (!container || savedList.length < 2) {
      if (firstSlotRef.current) setCarouselStep(firstSlotRef.current.offsetWidth + 16);
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
    el.scrollBy({ left: direction === "prev" ? -carouselStep : carouselStep, behavior: "smooth" });
  };

  const scrollToIndex = (index: number) => {
    const el = carouselRef.current;
    const slotEl = firstSlotRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(index, savedList.length - 1));
    const paddingLeft = slotEl ? slotEl.offsetLeft : 0;
    const slotWidth = slotEl ? slotEl.offsetWidth : 316;
    const targetScroll = paddingLeft + clamped * carouselStep - (el.clientWidth - slotWidth) / 2;
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
    const index = Math.round((center - paddingLeft - slotWidth / 2) / step);
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

  // Sin presentaciones: input centrado en la página (layout inicial)
  if (!hasItems) {
    return (
      <div className="min-h-screen flex flex-col font-sans relative bg-linear-to-br from-emerald-200/80 via-green-100 to-teal-200/80">
        {onOpenConfig && (
          <button
            type="button"
            onClick={onOpenConfig}
            className="absolute top-4 right-4 p-2 rounded-lg text-stone-500 hover:bg-emerald-100/80 hover:text-stone-700 transition-colors z-10"
            title="Configuración (API keys)"
          >
            <MoreVertical size={20} />
          </button>
        )}
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="max-w-2xl w-full text-center space-y-8"
          >
            <div className="space-y-4">
              <div className="inline-flex items-center justify-center w-64 h-64 rounded-3xl overflow-hidden mb-4 bg-transparent">
                <video
                  src="./video-logo.webm"
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-contain"
                  aria-hidden
                />
              </div>
              <h1 className="text-5xl font-medium tracking-tight text-stone-800 font-serif italic">
                Sl<span className="text-emerald-600">ai</span>m
              </h1>
              <p className="text-stone-600 text-lg max-w-md mx-auto">
                Transforma tus ideas en presentaciones profesionales con el poder
                de la Inteligencia Artificial.
              </p>
            </div>
            <PromptInput
              onSubmit={handleGenerate}
              value={topic}
              onChange={setTopic}
              disabled={isLoading}
              placeholder="¿Sobre qué quieres hablar hoy? Puedes escribir varias líneas."
              minRows={3}
              maxRows={6}
              showPlan={true}
              presentationModelId={presentationModelId}
              setPresentationModelId={setPresentationModelId}
              presentationModels={presentationModels}
            />
          </motion.div>
        </div>
      </div>
    );
  }

  // Con presentaciones: fondo blanco / degradé gris muy sutil
  return (
    <div className="min-h-screen flex flex-col font-sans bg-linear-to-br from-stone-50 via-white to-stone-100/70">
      <header className="flex items-start justify-between gap-3 sm:gap-4 px-4 sm:px-6 py-4 bg-transparent shrink-0">
        <div className="flex items-center gap-3 min-w-0 shrink-0 pt-0.5">
          <div className="shrink-0 w-10 h-10 rounded-xl overflow-hidden bg-white/80 flex items-center justify-center">
            <video
              src="./video-logo.webm"
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-contain"
              aria-hidden
            />
          </div>
          <span className="text-xl font-semibold text-stone-900 font-serif italic truncate">
            Sl<span className="text-emerald-600">ai</span>m
          </span>
        </div>

        <div className="flex-1 flex justify-center max-w-xl">
          <PromptInput
            onSubmit={handleGenerate}
            value={topic}
            onChange={setTopic}
            disabled={isLoading}
            placeholder="¿Sobre qué quieres hablar hoy? Puedes escribir varias líneas."
            minRows={1}
            maxRows={4}
            showPlan={true}
            className="max-w-xl"
            compact
            presentationModelId={presentationModelId}
            setPresentationModelId={setPresentationModelId}
            presentationModels={presentationModels}
          />
        </div>

        <div className="flex items-center min-w-[52px] justify-end shrink-0 pt-0.5">
          {onOpenConfig && (
            <button
              type="button"
              onClick={onOpenConfig}
              className="p-2 rounded-lg text-stone-600 hover:bg-white/50 hover:text-stone-800 transition-colors"
              title="Configuración (API keys)"
            >
              <MoreVertical size={22} />
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col justify-center min-h-0 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 overflow-visible">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="flex flex-col items-center w-full max-w-6xl mx-auto overflow-visible"
        >
          <div className="w-full py-4 sm:py-6 overflow-visible">
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
                    const slotWidthClass = "w-[276px] sm:w-[316px]"; // 260+16, 300+16
                    return (
                      <div
                        key={p.id}
                        ref={index === 0 ? firstSlotRef : undefined}
                        className={cn(
                          "shrink-0 snap-center py-4 px-1",
                          slotWidthClass,
                        )}
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
                            !coverImageCache[p.id] && cn("bg-linear-to-br", gradient),
                          )}
                          style={{ minHeight: 280 }}
                        >
                        {coverImageCache[p.id] && (
                          <div
                            className="absolute inset-0 bg-cover bg-center"
                            style={{ backgroundImage: `url(${coverImageCache[p.id]})` }}
                          />
                        )}
                        <div className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
                        <button
                          type="button"
                          onClick={() => handleOpenSaved(p.id)}
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
                        <div className="absolute top-5 right-5 flex flex-col gap-1 z-30 pointer-events-auto">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                handleGenerateCoverForPresentation(p.id);
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
                                handleDeleteSaved(p.id);
                              }}
                              onPointerDown={(e) => e.stopPropagation()}
                              className="p-2 rounded-lg bg-white/20 hover:bg-red-500/80 text-white transition-colors"
                              title="Eliminar presentación"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        {isGeneratingCover && (
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
                {hasItems && savedList.length > 1 && (
                  <div className="flex justify-center gap-1.5 mt-4" role="tablist" aria-label="Navegación del carrusel">
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
              </div>
          <button
            type="button"
            onClick={openSavedListModal}
            className="mt-6 text-sm text-stone-500 hover:text-emerald-600 transition-colors"
          >
            Explorar todo →
          </button>
        </motion.div>
      </main>

    </div>
  );
}
