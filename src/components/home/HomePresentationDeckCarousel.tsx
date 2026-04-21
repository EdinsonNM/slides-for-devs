import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import type { PanInfo } from "motion/react";
import { HomePresentationCardTile } from "./HomePresentationCardTile";
import type { DeckVisualTheme } from "../../domain/entities";
import type { HomePresentationCard, Slide } from "../../types";
import { homePresentationCardKey } from "../../types";
import { cn } from "../../utils/cn";

const GAP_PX = 12;
/**
 * Fracción del ancho del carril por tarjeta (filas: varias visibles; la activa escala encima).
 * ~0,58 ≈ tamaño “correcto” previo con buen peek lateral.
 */
const CARD_WIDTH_RATIO = 0.58;
/** 16:9 — la tarjeta usa `aspect-video` (alto = ancho × 9/16). */
const CARD_VIDEO_ASPECT_H_OVER_W = 9 / 16;
/**
 * Padding vertical aproximado del carril (`py-3` / `py-5`) + margen para escala activa.
 * Evita que el ancho objetivo exija más alto del que cabe (UI ancha y baja).
 */
const TRACK_PAD_Y_PX = 56;

const TRACK_SPRING = {
  type: "spring" as const,
  stiffness: 400,
  damping: 32,
  mass: 0.8,
};

const SLIDE_SPRING = {
  type: "spring" as const,
  stiffness: 360,
  damping: 28,
  mass: 0.78,
};

const DOT_SPRING = {
  type: "spring" as const,
  stiffness: 420,
  damping: 24,
};

/** Velo muy fino en el borde del layout (solo suaviza el recorte, no tapa vecinos). */
const EDGE_FADE_WIDTH = "min(2.5%, 1.25rem)";

export interface HomePresentationDeckCarouselProps {
  homePresentationCards: HomePresentationCard[];
  coverImageCache: Record<string, string>;
  homeFirstSlideReplicaBySavedId?: Record<string, Slide | undefined>;
  homeFirstSlideReplicaDeckThemeBySavedId?: Record<
    string,
    DeckVisualTheme | undefined
  >;
  generatingCoverId: string | null;
  syncingToCloudId: string | null;
  onOpenSaved: (id: string) => void;
  onDeleteSaved: (id: string) => void;
  onGenerateCover: (id: string) => void;
  cloudSyncAvailable: boolean;
  onSyncToCloud?: (id: string) => void;
  onSharePresentation?: (id: string) => void;
  onDownloadFromCloud: (cloudId: string, ownerUid: string) => void;
  onDeleteCloudOnlyMine?: (cloudId: string, ownerUid: string) => void;
  downloadingCloudKey: string | null;
  cloudOnlyCardActionMode?: "download" | "open";
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function HomePresentationDeckCarousel({
  homePresentationCards,
  coverImageCache,
  homeFirstSlideReplicaBySavedId,
  homeFirstSlideReplicaDeckThemeBySavedId,
  generatingCoverId,
  syncingToCloudId,
  onOpenSaved,
  onDeleteSaved,
  onGenerateCover,
  cloudSyncAvailable,
  onSyncToCloud,
  onSharePresentation,
  onDownloadFromCloud,
  onDeleteCloudOnlyMine,
  downloadingCloudKey,
  cloudOnlyCardActionMode = "download",
}: HomePresentationDeckCarouselProps) {
  const reduceMotion = useReducedMotion();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportW, setViewportW] = useState(0);
  const [viewportH, setViewportH] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const x = useMotionValue(0);

  const count = homePresentationCards.length;

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const sync = () => {
      setViewportW(el.clientWidth);
      setViewportH(el.clientHeight);
    };
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    sync();
    return () => ro.disconnect();
  }, []);

  const { cardWidth, paddingX, step } = useMemo(() => {
    const w = viewportW;
    if (w <= 0) {
      return { cardWidth: 0, paddingX: 0, step: 0 };
    }
    const idealW = Math.round(w * CARD_WIDTH_RATIO);
    const innerH = Math.max(0, viewportH - TRACK_PAD_Y_PX);
    const maxWFromHeight =
      viewportH > 0 && innerH > 0
        ? Math.floor(innerH / CARD_VIDEO_ASPECT_H_OVER_W)
        : idealW;
    const cw = Math.max(1, Math.min(idealW, maxWFromHeight, Math.floor(w * 0.92)));
    const pad = Math.max(0, (w - cw) / 2);
    return { cardWidth: cw, paddingX: pad, step: cw + GAP_PX };
  }, [viewportW, viewportH]);

  useEffect(() => {
    setActiveIndex((i) => clamp(i, 0, Math.max(0, count - 1)));
  }, [count]);

  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  const wheelAccumRef = useRef(0);

  useEffect(() => {
    wheelAccumRef.current = 0;
  }, [activeIndex]);

  const moveTo = useCallback(
    (next: number) => {
      const clamped = clamp(next, 0, Math.max(0, count - 1));
      setActiveIndex(clamped);
      if (step <= 0) return;
      const target = -clamped * step;
      if (reduceMotion) {
        x.set(target);
        return;
      }
      void animate(x, target, TRACK_SPRING);
    },
    [count, reduceMotion, step, x],
  );

  useEffect(() => {
    if (count === 0) return;
    const max = count - 1;
    if (activeIndexRef.current > max) moveTo(max);
  }, [count, moveTo]);

  useEffect(() => {
    if (viewportW <= 0 || step <= 0) return;
    x.set(-activeIndexRef.current * step);
  }, [viewportW, step, x]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el || count <= 1) return;
    const TH = 52;
    const onWheel = (e: WheelEvent) => {
      if (reduceMotion) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      wheelAccumRef.current += e.deltaY;
      if (wheelAccumRef.current >= TH) {
        moveTo(activeIndexRef.current + 1);
        wheelAccumRef.current = 0;
      } else if (wheelAccumRef.current <= -TH) {
        moveTo(activeIndexRef.current - 1);
        wheelAccumRef.current = 0;
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [count, moveTo, reduceMotion]);

  const onDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (count <= 1 || step <= 0) return;
      let raw = -x.get() / step;
      if (info.velocity.x < -320) raw = Math.floor(raw + 0.001);
      else if (info.velocity.x > 320) raw = Math.ceil(raw - 0.001);
      moveTo(Math.round(raw));
    },
    [count, moveTo, step, x],
  );

  const goPrev = useCallback(() => {
    moveTo(activeIndex - 1);
  }, [activeIndex, moveTo]);

  const goNext = useCallback(() => {
    moveTo(activeIndex + 1);
  }, [activeIndex, moveTo]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        goNext();
      } else if (e.key === "Home") {
        e.preventDefault();
        moveTo(0);
      } else if (e.key === "End") {
        e.preventDefault();
        moveTo(count - 1);
      }
    },
    [count, goNext, goPrev, moveTo],
  );

  const canDrag = count > 1 && !reduceMotion;
  const maxOffset = step > 0 ? Math.max(0, (count - 1) * step) : 0;

  return (
    <div
      role="region"
      aria-roledescription="carrusel"
      aria-label="Vista previa de presentaciones. Usa la rueda del ratón, arrastre o teclado."
      tabIndex={0}
      onKeyDown={onKeyDown}
      className={cn(
        "flex min-h-0 w-full min-w-0 flex-1 flex-col outline-none",
        "pl-[max(0px,env(safe-area-inset-left,0px))] pr-[max(0px,env(safe-area-inset-right,0px))]",
        "focus-visible:ring-2 focus-visible:ring-stone-400/35 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 dark:focus-visible:ring-stone-500/30 dark:focus-visible:ring-offset-stone-900",
      )}
    >
      <div
        ref={viewportRef}
        className="relative h-full min-h-0 w-full min-w-0 flex-1 overflow-hidden rounded-none"
        style={{ perspective: "min(1400px, 200vw)" }}
      >
        <motion.div
          className={cn(
            "flex h-full min-h-0 flex-row items-center py-3 sm:py-5",
            canDrag && "cursor-grab active:cursor-grabbing",
            count === 0 && "min-h-[min(280px,42vh)] justify-center",
          )}
          style={{
            x,
            paddingLeft: paddingX,
            paddingRight: paddingX,
            gap: GAP_PX,
            touchAction: canDrag ? "pan-x" : undefined,
            transformStyle: "preserve-3d",
          }}
          drag={canDrag ? "x" : false}
          dragConstraints={{ left: -maxOffset, right: 0 }}
          dragElastic={0.08}
          onDragEnd={onDragEnd}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {homePresentationCards.map((card, index) => {
              const isActive = index === activeIndex;
              const side = index < activeIndex ? "left" : index > activeIndex ? "right" : "center";
              return (
                <motion.div
                  key={homePresentationCardKey(card)}
                  className={cn(
                    "relative flex shrink-0 flex-col items-stretch justify-center",
                    isActive ? "z-20" : "z-10",
                  )}
                  style={{
                    width: cardWidth > 0 ? cardWidth : "min(100%, 20rem)",
                    transformStyle: "preserve-3d",
                    transformOrigin: "50% 50%",
                  }}
                  animate={
                    reduceMotion
                      ? {
                          scale: 1,
                          opacity: 1,
                          rotateY: 0,
                          z: 0,
                        }
                      : isActive
                        ? {
                            scale: 1.02,
                            opacity: 1,
                            rotateY: 0,
                            z: 40,
                          }
                        : {
                            scale: 0.9,
                            opacity: 0.82,
                            rotateY: side === "left" ? 5 : -5,
                            z: -12,
                          }
                  }
                  exit={
                    reduceMotion
                      ? { opacity: 0, transition: { duration: 0.14, ease: "easeIn" } }
                      : {
                          opacity: 0,
                          scale: 0.92,
                          rotateY: -10,
                          z: -28,
                          filter: "blur(5px)",
                          transition: {
                            duration: 0.3,
                            ease: [0.22, 1, 0.36, 1],
                          },
                        }
                  }
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : {
                          ...SLIDE_SPRING,
                          opacity: { type: "spring", stiffness: 280, damping: 22 },
                        }
                  }
                >
                  <HomePresentationCardTile
                    card={card}
                    index={index}
                    coverImageCache={coverImageCache}
                    homeFirstSlideReplicaBySavedId={homeFirstSlideReplicaBySavedId}
                    homeFirstSlideReplicaDeckThemeBySavedId={
                      homeFirstSlideReplicaDeckThemeBySavedId
                    }
                    generatingCoverId={generatingCoverId}
                    syncingToCloudId={syncingToCloudId}
                    onOpenSaved={onOpenSaved}
                    onDeleteSaved={onDeleteSaved}
                    onGenerateCover={onGenerateCover}
                    cloudSyncAvailable={cloudSyncAvailable}
                    onSyncToCloud={onSyncToCloud}
                    onSharePresentation={onSharePresentation}
                    onDownloadFromCloud={onDownloadFromCloud}
                    onDeleteCloudOnlyMine={onDeleteCloudOnlyMine}
                    downloadingCloudKey={downloadingCloudKey}
                    cloudOnlyCardActionMode={cloudOnlyCardActionMode}
                    listLayout="carousel"
                    frameClassName="flex w-full min-h-0 flex-col shadow-md shadow-stone-900/10 dark:shadow-black/35"
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>

        {count > 1 && (
          <>
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-y-0 left-0 z-30",
                "bg-[linear-gradient(90deg,rgb(250_250_249)_0%,rgba(250,250,249,0.45)_40%,transparent_100%)]",
                "dark:bg-[linear-gradient(90deg,rgb(28_25_23)_0%,rgba(28,25,23,0.42)_40%,transparent_100%)]",
              )}
              style={{ width: EDGE_FADE_WIDTH }}
            />
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-y-0 right-0 z-30",
                "bg-[linear-gradient(270deg,rgb(250_250_249)_0%,rgba(250,250,249,0.45)_40%,transparent_100%)]",
                "dark:bg-[linear-gradient(270deg,rgb(28_25_23)_0%,rgba(28,25,23,0.42)_40%,transparent_100%)]",
              )}
              style={{ width: EDGE_FADE_WIDTH }}
            />
          </>
        )}
      </div>

      {count > 1 && (
        <div
          className="mt-2 flex shrink-0 justify-center gap-1.5 pb-3 pt-2 sm:mt-3 sm:pb-4 sm:pt-2.5"
          role="tablist"
          aria-label="Índice de presentaciones"
        >
          {homePresentationCards.map((card, i) => {
            const active = i === activeIndex;
            return (
              <motion.button
                key={homePresentationCardKey(card)}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={`Ir a la presentación ${i + 1} de ${count}`}
                onClick={() => moveTo(i)}
                layout
                transition={reduceMotion ? { duration: 0.15 } : DOT_SPRING}
                className={cn(
                  "h-2 rounded-full",
                  active
                    ? "w-7 bg-stone-800 dark:bg-stone-200"
                    : "w-2 bg-stone-300 hover:bg-stone-400 dark:bg-stone-600 dark:hover:bg-stone-500",
                )}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
