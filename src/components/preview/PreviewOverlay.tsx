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
        className="fixed inset-0 z-[100] bg-white flex flex-col"
      >
        <PreviewToolbar
          currentIndex={currentIndex}
          totalSlides={slides.length}
          onOpenPresenter={openPresenterWindow}
          onClose={() => setIsPreviewMode(false)}
        />

        <div
          className={
            currentSlide.type === "diagram"
              ? "flex-1 flex min-h-0 min-w-0 w-full"
              : "flex-1 flex items-center justify-center p-12 min-h-0"
          }
        >
          <PreviewSlideContent
            slide={currentSlide}
            formatMarkdown={formatMarkdown}
            imageWidthPercent={imageWidthPercent}
            panelHeightPercent={panelHeightPercent}
          />
        </div>

        <div
          className="absolute inset-y-0 left-0 w-32 cursor-pointer group flex items-center justify-center z-10 pointer-events-auto"
          onClick={prevSlide}
        >
          <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-stone-900 shadow-xl">
            <ChevronLeft size={32} />
          </div>
        </div>
        <div
          className="absolute inset-y-0 right-0 w-32 cursor-pointer group flex items-center justify-center z-10 pointer-events-auto"
          onClick={nextSlide}
        >
          <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-stone-900 shadow-xl">
            <ChevronRight size={32} />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
