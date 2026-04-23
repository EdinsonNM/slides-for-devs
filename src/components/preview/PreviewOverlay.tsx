import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  useRef,
  useEffect,
  useLayoutEffect,
  useState,
  useCallback,
} from "react";
import { usePresentation } from "../../context/PresentationContext";
import type { DeckContentTone } from "../../domain/entities";
import type { Slide } from "../../types";
import { PRESENTER_MODES } from "../../constants/presenterModes";
import { trackEvent, ANALYTICS_EVENTS } from "../../services/analytics";
import { cn } from "../../utils/cn";
import {
  elementSupportsRequestFullscreen,
  exitDocumentFullscreen,
  getFullscreenElement,
  requestElementFullscreen,
} from "../../utils/fullscreenApi";
import { PreviewToolbar } from "./PreviewToolbar";
import { PreviewSlideContent } from "./PreviewSlideContent";

function getOrigin() {
  return window.location.origin;
}

/** Flecha + halo acorde al tono del deck (sin disco negro). */
function previewNavBtnClass(tone: DeckContentTone): string {
  if (tone === "light") {
    return cn(
      "flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-white/45 bg-white/12 text-slate-50 shadow-[0_2px_14px_rgba(0,0,0,0.25)] backdrop-blur-md transition-[color,background-color,border-color,transform]",
      "hover:border-white/65 hover:bg-white/22 hover:text-white",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/55",
      "[&_svg]:drop-shadow-[0_0_2px_rgba(0,0,0,0.35)]",
    );
  }
  return cn(
    "flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-stone-800/20 bg-white/50 text-stone-900 shadow-[0_2px_12px_rgba(0,0,0,0.08)] backdrop-blur-md transition-[color,background-color,border-color,transform]",
    "hover:border-stone-800/35 hover:bg-white/75 hover:text-stone-950",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-500/50",
    "[&_svg]:drop-shadow-[0_1px_0_rgba(255,255,255,0.85)]",
  );
}

/** Botones fijos compactos: no usar franjas a altura completa (z altos) que tapen el lienzo y bloqueen Rive / 3D. */
const previewNavBtnFixed =
  "pointer-events-auto fixed top-1/2 z-[106] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full opacity-90 shadow-md transition-opacity hover:opacity-100 motion-reduce:transition-none";

type SlideDirection = 1 | -1;

const powerPointVariants = {
  enter: (direction: SlideDirection) => ({
    opacity: 0,
    x: direction * 52,
    scale: 0.992,
  }),
  center: {
    opacity: 1,
    x: 0,
    scale: 1,
  },
  exit: (direction: SlideDirection) => ({
    opacity: 0,
    x: direction * -52,
    scale: 0.992,
  }),
};

const cameraVariants = {
  enter: (direction: SlideDirection) => ({
    opacity: 0,
    x: direction * 120,
    scale: 1.06,
    filter: "blur(8px)",
  }),
  center: {
    opacity: 1,
    x: 0,
    scale: 1,
    filter: "blur(0px)",
  },
  exit: (direction: SlideDirection) => ({
    opacity: 0,
    x: direction * -90,
    scale: 0.94,
    filter: "blur(6px)",
  }),
};

function ContinuousCameraStage({
  slides,
  currentIndex,
  imageWidthPercent,
  panelHeightPercent,
}: {
  slides: Slide[];
  currentIndex: number;
  imageWidthPercent: number;
  panelHeightPercent: number;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      setStageSize({ width: rect.width, height: rect.height });
    };

    measure();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }

    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { width: stageW, height: stageH } = stageSize;
  const maxSlideW = stageW > 0 ? stageW * 0.78 : 0;
  const maxSlideH = stageH > 0 ? stageH * 0.78 : 0;
  const slideW =
    maxSlideW > 0 && maxSlideH > 0
      ? Math.min(maxSlideW, (maxSlideH * 16) / 9)
      : 0;
  const slideH = slideW > 0 ? (slideW * 9) / 16 : 0;
  const gapPx = slideW > 0 ? Math.max(18, slideW * 0.08) : 0;
  const stepPx = slideW + gapPx;

  return (
    <div
      ref={stageRef}
      className="relative h-full w-full overflow-hidden bg-[radial-gradient(circle_at_center,rgba(15,23,42,0.55),rgba(2,6,23,0.98)_72%)]"
    >
      <div className="absolute inset-0 z-10 flex items-center justify-center">
        {slideW > 0 && slideH > 0
          ? slides.map((slide, idx) => {
              const distance = Math.abs(idx - currentIndex);
              const opacity =
                distance === 0
                  ? 1
                  : distance === 1
                    ? 0.9
                    : distance === 2
                      ? 0.72
                      : 0.52;
              const blur = Math.min(distance * 1.4, 4.5);
              return (
                <motion.div
                  key={slide.id}
                  className={cn(
                    "absolute overflow-hidden rounded-2xl border border-white/15 shadow-[0_40px_120px_rgba(0,0,0,0.55)]",
                    distance === 0 ? "pointer-events-auto" : "pointer-events-none",
                  )}
                  style={{
                    width: slideW,
                    height: slideH,
                    left: "50%",
                    top: "50%",
                    marginLeft: -slideW / 2,
                    marginTop: -slideH / 2,
                    zIndex: Math.max(1, 50 - distance),
                  }}
                  animate={{
                    x: (idx - currentIndex) * stepPx,
                    opacity,
                    filter: `blur(${blur}px)`,
                  }}
                  transition={{ duration: 0.95, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="flex h-full w-full min-h-0 min-w-0 flex-col">
                    <PreviewSlideContent
                      layout="fullscreen"
                      slide={slide}
                      imageWidthPercent={imageWidthPercent}
                      panelHeightPercent={panelHeightPercent}
                      slideIndex={idx}
                      disableEntryMotion
                      hideSectionLabel
                      r3fHostMeasureKey={`camera-continuous:${currentIndex}`}
                    />
                  </div>
                </motion.div>
              );
            })
          : null}
      </div>
    </div>
  );
}

function JarvisHaloStage({
  topic,
  currentIndex,
  totalSlides,
}: {
  topic: string;
  currentIndex: number;
  totalSlides: number;
}) {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.2),rgba(2,6,23,0.92)_52%)]">
      <motion.div
        className="absolute h-96 w-96 rounded-full border border-cyan-300/40"
        animate={{ scale: [0.9, 1.06, 0.9], opacity: [0.45, 0.9, 0.45] }}
        transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute h-72 w-72 rounded-full border border-sky-400/35"
        animate={{ rotate: [0, 360], scale: [1, 1.08, 1] }}
        transition={{ duration: 6.8, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute h-40 w-40 rounded-full bg-cyan-300/20 blur-2xl"
        animate={{ opacity: [0.35, 0.8, 0.35], scale: [0.92, 1.1, 0.92] }}
        transition={{ duration: 2.9, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="relative z-10 rounded-full border border-cyan-200/60 bg-slate-950/65 px-6 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-cyan-100/90"
        animate={{ y: [-8, 8, -8] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        Jarvis
      </motion.div>
      <div className="pointer-events-none absolute bottom-7 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-black/35 px-4 py-1.5 text-xs text-white/70">
        {topic || "Presentación"} · {currentIndex + 1}/{totalSlides}
      </div>
    </div>
  );
}

export function PreviewOverlay() {
  const {
    isPreviewMode,
    setIsPreviewMode,
    currentSlide,
    currentIndex,
    slides,
    topic,
    deckVisualTheme,
    imageWidthPercent,
    panelHeightPercent,
    prevSlide,
    nextSlide,
    effectiveGeminiModel,
    presenterMode,
    setPresenterMode,
  } = usePresentation();
  const nextSlideRef = useRef(nextSlide);
  const prevSlideRef = useRef(prevSlide);
  const stateRef = useRef({
    slides,
    currentIndex,
    topic,
    effectiveGeminiModel,
    deckVisualTheme,
  });
  const presenterWindowRef = useRef<Window | null>(null);
  const overlayRootRef = useRef<HTMLDivElement | null>(null);
  const [browserFullscreenActive, setBrowserFullscreenActive] = useState(false);
  const [slideDirection, setSlideDirection] = useState<SlideDirection>(1);

  const nativeFullscreenSupported =
    typeof document !== "undefined" &&
    elementSupportsRequestFullscreen(document.documentElement);

  const syncBrowserFullscreen = useCallback(() => {
    const host = overlayRootRef.current;
    setBrowserFullscreenActive(host != null && getFullscreenElement() === host);
  }, []);

  useEffect(() => {
    if (!isPreviewMode) {
      setBrowserFullscreenActive(false);
      return;
    }
    syncBrowserFullscreen();
    const onChange = () => syncBrowserFullscreen();
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, [isPreviewMode, syncBrowserFullscreen]);

  const handleToggleNativeFullscreen = useCallback(() => {
    const el = overlayRootRef.current;
    if (!el) return;
    if (getFullscreenElement() === el) {
      void exitDocumentFullscreen();
      return;
    }
    void requestElementFullscreen(el).catch(() => {});
  }, []);

  const handleClosePreview = useCallback(() => {
    const el = overlayRootRef.current;
    if (el && getFullscreenElement() === el) {
      void exitDocumentFullscreen().finally(() => setIsPreviewMode(false));
      return;
    }
    setIsPreviewMode(false);
  }, [setIsPreviewMode]);

  const handlePrevSlide = useCallback(() => {
    setSlideDirection(-1);
    prevSlide();
  }, [prevSlide]);

  const handleNextSlide = useCallback(() => {
    setSlideDirection(1);
    nextSlide();
  }, [nextSlide]);

  nextSlideRef.current = handleNextSlide;
  prevSlideRef.current = handlePrevSlide;
  stateRef.current = {
    slides,
    currentIndex,
    topic,
    effectiveGeminiModel,
    deckVisualTheme,
  };

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.origin !== getOrigin()) return;
      if (e.data?.type === "PRESENTER_READY" && e.source) {
        presenterWindowRef.current = e.source as Window;
        const {
          slides: s,
          currentIndex: i,
          topic: t,
          effectiveGeminiModel: m,
          deckVisualTheme: dvt,
        } = stateRef.current;
        (e.source as Window).postMessage(
          {
            type: "PRESENTATION_STATE",
            payload: {
              slides: s,
              currentIndex: i,
              topic: t || "Presentación",
              effectiveGeminiModel: m,
              deckVisualTheme: dvt,
            },
          },
          getOrigin()
        );
      }
      if (
        e.data?.type === "PRESENTER_NEXT" ||
        e.data?.type === "presenter-next"
      )
        nextSlideRef.current();
      if (
        e.data?.type === "PRESENTER_PREV" ||
        e.data?.type === "presenter-prev"
      )
        prevSlideRef.current();
      if (e.data?.type === "PRESENTER_CLOSE") presenterWindowRef.current = null;
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [slides, currentIndex, topic, effectiveGeminiModel, deckVisualTheme]);

  const tauriEventRef = useRef<{
    emitTo: (target: string, event: string, payload?: unknown) => Promise<void>;
  } | null>(null);

  useEffect(() => {
    let unlisten: Array<() => void> = [];
    (async () => {
      try {
        const eventApi = await import("@tauri-apps/api/event");
        tauriEventRef.current = { emitTo: eventApi.emitTo };
        unlisten.push(
          await eventApi.listen("presenter-ready", () => {
            const {
              slides: s,
              currentIndex: i,
              topic: t,
              effectiveGeminiModel: m,
              deckVisualTheme: dvt,
            } = stateRef.current;
            eventApi.emitTo("presenter", "presentation-state", {
              payload: {
                slides: s,
                currentIndex: i,
                topic: t || "Presentación",
                effectiveGeminiModel: m,
                deckVisualTheme: dvt,
              },
            });
          })
        );
        unlisten.push(
          await eventApi.listen("presenter-next", () => {
            nextSlideRef.current();
          })
        );
        unlisten.push(
          await eventApi.listen("presenter-prev", () => {
            prevSlideRef.current();
          })
        );
      } catch {
        tauriEventRef.current = null;
      }
    })();
    return () => {
      unlisten.forEach((u) => u());
      tauriEventRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isPreviewMode) {
      presenterWindowRef.current = null;
      return;
    }
    const win = presenterWindowRef.current;
    if (win) {
      win.postMessage({ type: "SLIDE_CHANGED", currentIndex }, getOrigin());
    }
    tauriEventRef.current?.emitTo("presenter", "slide-changed", {
      currentIndex,
    });
  }, [currentIndex, isPreviewMode]);

  const navTone = deckVisualTheme.contentTone;

  if (!isPreviewMode || !currentSlide) return null;

  const openPresenterWindow = async () => {
    trackEvent(ANALYTICS_EVENTS.PRESENTER_MODE_OPENED);
    const path = window.location.pathname || "/";
    const search = window.location.search || "";
    const url = `${getOrigin()}${path}${search}#/presenter`;
    try {
      const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
      const w = new WebviewWindow("presenter", {
        url,
        title: "Modo presentador",
        width: 900,
        height: 700,
      });
      w.once("tauri://error", (e) => {
        console.error("Error abriendo ventana presentador:", e);
      });
    } catch {
      window.open(
        url,
        "presenter",
        "width=900,height=700,menubar=no,toolbar=no,noopener,noreferrer"
      );
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        ref={overlayRootRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-100 flex h-screen w-screen flex-col overflow-hidden bg-black"
      >
        <PreviewToolbar
          onOpenPresenter={openPresenterWindow}
          onClose={handleClosePreview}
          presenterMode={presenterMode}
          onPresenterModeChange={setPresenterMode}
          nativeFullscreen={{
            supported: nativeFullscreenSupported,
            active: browserFullscreenActive,
            onToggle: handleToggleNativeFullscreen,
          }}
        />

        <div className="relative z-50 isolate flex min-h-0 min-w-0 w-full flex-1 flex-col items-stretch justify-stretch overflow-hidden bg-transparent p-0 pointer-events-auto">
          {presenterMode === PRESENTER_MODES.CAMERA ? (
            <ContinuousCameraStage
              slides={slides}
              currentIndex={currentIndex}
              imageWidthPercent={imageWidthPercent}
              panelHeightPercent={panelHeightPercent}
            />
          ) : (
            <AnimatePresence mode="wait" initial={false} custom={slideDirection}>
              {presenterMode === PRESENTER_MODES.JARVIS ? (
              <motion.div
                key={`jarvis-${currentSlide.id}`}
                custom={slideDirection}
                variants={cameraVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                className="flex h-full min-h-0 w-full flex-col"
              >
                <JarvisHaloStage
                  topic={topic}
                  currentIndex={currentIndex}
                  totalSlides={slides.length}
                />
              </motion.div>
              ) : (
                <motion.div
                  key={`${presenterMode}-${currentSlide.id}`}
                  custom={slideDirection}
                  variants={powerPointVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.36, ease: "easeInOut" }}
                  className="flex h-full min-h-0 w-full flex-col"
                >
                  <PreviewSlideContent
                    layout="fullscreen"
                    slide={currentSlide}
                    imageWidthPercent={imageWidthPercent}
                    panelHeightPercent={panelHeightPercent}
                    slideIndex={currentIndex}
                    disableEntryMotion
                  />
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>

        <p
          className="pointer-events-none fixed bottom-3 left-3 z-105 select-none text-xs font-medium tabular-nums text-white/40 md:bottom-4 md:left-4"
          aria-live="polite"
        >
          {currentIndex + 1}/{slides.length}
        </p>

        <button
          type="button"
          aria-label="Diapositiva anterior"
          className={cn(previewNavBtnFixed, "left-3 md:left-4", previewNavBtnClass(navTone))}
          onClick={handlePrevSlide}
        >
          <ChevronLeft size={28} strokeWidth={2.25} aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Diapositiva siguiente"
          className={cn(previewNavBtnFixed, "right-3 md:right-4", previewNavBtnClass(navTone))}
          onClick={handleNextSlide}
        >
          <ChevronRight size={28} strokeWidth={2.25} aria-hidden />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
