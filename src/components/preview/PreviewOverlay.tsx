import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useEffect, useState, useCallback } from "react";
import { usePresentation } from "../../context/PresentationContext";
import type { DeckContentTone } from "../../domain/entities";
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

  nextSlideRef.current = nextSlide;
  prevSlideRef.current = prevSlide;
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

  if (!isPreviewMode || !currentSlide) return null;

  const navTone = deckVisualTheme.contentTone;

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
        className="fixed inset-0 z-[100] flex flex-col bg-black"
      >
        <PreviewToolbar
          onOpenPresenter={openPresenterWindow}
          onClose={handleClosePreview}
          nativeFullscreen={{
            supported: nativeFullscreenSupported,
            active: browserFullscreenActive,
            onToggle: handleToggleNativeFullscreen,
          }}
        />

        <div className="relative z-[50] isolate flex min-h-0 min-w-0 w-full flex-1 flex-col items-stretch justify-stretch overflow-hidden bg-black p-0 pointer-events-auto">
          <PreviewSlideContent
            layout="fullscreen"
            slide={currentSlide}
            imageWidthPercent={imageWidthPercent}
            panelHeightPercent={panelHeightPercent}
            slideIndex={currentIndex}
          />
        </div>

        <p
          className="pointer-events-none fixed bottom-3 left-3 z-[105] select-none text-xs font-medium tabular-nums text-white/40 md:bottom-4 md:left-4"
          aria-live="polite"
        >
          {currentIndex + 1}/{slides.length}
        </p>

        <button
          type="button"
          aria-label="Diapositiva anterior"
          className={cn(previewNavBtnFixed, "left-3 md:left-4", previewNavBtnClass(navTone))}
          onClick={prevSlide}
        >
          <ChevronLeft size={28} strokeWidth={2.25} aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Diapositiva siguiente"
          className={cn(previewNavBtnFixed, "right-3 md:right-4", previewNavBtnClass(navTone))}
          onClick={nextSlide}
        >
          <ChevronRight size={28} strokeWidth={2.25} aria-hidden />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
