import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useEffect } from "react";
import { usePresentation } from "../../context/PresentationContext";
import { trackEvent, ANALYTICS_EVENTS } from "../../services/analytics";
import { PreviewToolbar } from "./PreviewToolbar";
import { PreviewSlideContent } from "./PreviewSlideContent";

function getOrigin() {
  return window.location.origin;
}

export function PreviewOverlay() {
  const {
    isPreviewMode,
    setIsPreviewMode,
    currentSlide,
    currentIndex,
    slides,
    topic,
    imageWidthPercent,
    panelHeightPercent,
    formatMarkdown,
    prevSlide,
    nextSlide,
    effectiveGeminiModel,
  } = usePresentation();
  const nextSlideRef = useRef(nextSlide);
  const prevSlideRef = useRef(prevSlide);
  const stateRef = useRef({
    slides,
    currentIndex,
    topic,
    effectiveGeminiModel,
  });
  const presenterWindowRef = useRef<Window | null>(null);
  nextSlideRef.current = nextSlide;
  prevSlideRef.current = prevSlide;
  stateRef.current = { slides, currentIndex, topic, effectiveGeminiModel };

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
        } = stateRef.current;
        (e.source as Window).postMessage(
          {
            type: "PRESENTATION_STATE",
            payload: {
              slides: s,
              currentIndex: i,
              topic: t || "Presentación",
              effectiveGeminiModel: m,
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
  }, [slides, currentIndex, topic, effectiveGeminiModel]);

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
            } = stateRef.current;
            eventApi.emitTo("presenter", "presentation-state", {
              payload: {
                slides: s,
                currentIndex: i,
                topic: t || "Presentación",
                effectiveGeminiModel: m,
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
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="group/preview fixed inset-0 z-[100] flex flex-col bg-white"
      >
        <PreviewToolbar
          currentIndex={currentIndex}
          totalSlides={slides.length}
          onOpenPresenter={openPresenterWindow}
          onClose={() => setIsPreviewMode(false)}
        />

        <div className="relative z-20 flex min-h-0 min-w-0 w-full flex-1 items-center justify-center p-8 md:p-12">
          <PreviewSlideContent
            slide={currentSlide}
            formatMarkdown={formatMarkdown}
            imageWidthPercent={imageWidthPercent}
            panelHeightPercent={panelHeightPercent}
            slideIndex={currentIndex}
          />
        </div>

        <div className="pointer-events-none absolute inset-y-0 left-0 z-30 flex w-16 items-center justify-center md:w-20">
          <button
            type="button"
            aria-label="Diapositiva anterior"
            className="pointer-events-auto flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-white/15 text-stone-900 opacity-70 shadow-xl backdrop-blur-md transition-opacity hover:opacity-100 md:opacity-0 md:group-hover/preview:opacity-100"
            onClick={prevSlide}
          >
            <ChevronLeft size={28} />
          </button>
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 z-30 flex w-16 items-center justify-center md:w-20">
          <button
            type="button"
            aria-label="Diapositiva siguiente"
            className="pointer-events-auto flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-white/15 text-stone-900 opacity-70 shadow-xl backdrop-blur-md transition-opacity hover:opacity-100 md:opacity-0 md:group-hover/preview:opacity-100"
            onClick={nextSlide}
          >
            <ChevronRight size={28} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
