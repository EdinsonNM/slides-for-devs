import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useRef, useEffect } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Monitor,
} from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";
import { LANGUAGES } from "../../constants/languages";

function getEmbedUrl(url: string): string {
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    const v = url.split("v=")[1]?.split("&")[0] || url.split("/").pop();
    return `https://www.youtube.com/embed/${v}`;
  }
  return url;
}

const getOrigin = () => window.location.origin;

export function PreviewOverlay() {
  const {
    isPreviewMode,
    setIsPreviewMode,
    currentSlide,
    currentIndex,
    slides,
    topic,
    imageWidthPercent,
    formatMarkdown,
    prevSlide,
    nextSlide,
  } = usePresentation();
  const nextSlideRef = useRef(nextSlide);
  const prevSlideRef = useRef(prevSlide);
  const stateRef = useRef({ slides, currentIndex, topic });
  const presenterWindowRef = useRef<Window | null>(null);
  nextSlideRef.current = nextSlide;
  prevSlideRef.current = prevSlide;
  stateRef.current = { slides, currentIndex, topic };

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.origin !== getOrigin()) return;
      if (e.data?.type === "PRESENTER_READY" && e.source) {
        presenterWindowRef.current = e.source as Window;
        const { slides: s, currentIndex: i, topic: t } = stateRef.current;
        (e.source as Window).postMessage(
          {
            type: "PRESENTATION_STATE",
            payload: { slides: s, currentIndex: i, topic: t || "Presentación" },
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
  }, [slides, currentIndex, topic]);

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
            const { slides: s, currentIndex: i, topic: t } = stateRef.current;
            eventApi.emitTo("presenter", "presentation-state", {
              payload: {
                slides: s,
                currentIndex: i,
                topic: t || "Presentación",
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
        {/* Barra superior: iconos solo visibles al pasar el mouse por la parte superior */}
        <div className="fixed top-0 left-0 right-0 h-20 z-[110] group/bar">
          <div className="absolute inset-0 flex items-center justify-end gap-2 pr-6 opacity-0 group-hover/bar:opacity-100 transition-opacity duration-200">
            <span className="px-2.5 py-1 bg-stone-200/90 backdrop-blur rounded-full text-xs font-medium text-stone-600">
              {currentIndex + 1} / {slides.length}
            </span>
            <button
              type="button"
              onClick={openPresenterWindow}
              className="p-2.5 bg-stone-600/90 backdrop-blur text-white rounded-full hover:bg-stone-700 transition-colors shadow-lg"
              title="Abrir ventana de modo presentador"
            >
              <Monitor size={20} />
            </button>
            <button
              type="button"
              onClick={() => setIsPreviewMode(false)}
              className="p-2.5 bg-stone-800/90 backdrop-blur text-white rounded-full hover:bg-stone-900 transition-colors shadow-lg"
              title="Salir de vista previa"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-12">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className={cn(
              "preview-slide w-full max-w-7xl 2xl:max-w-[1600px] aspect-video bg-white flex relative",
              currentSlide.type === "chapter"
                ? "justify-center items-center"
                : ""
            )}
          >
            {currentSlide.type === "chapter" ? (
              <div className="text-center space-y-8">
                <div className="h-2 w-24 bg-emerald-600 mx-auto rounded-full" />
                <h1
                  className="font-serif italic text-stone-900 leading-tight"
                  style={{ fontSize: "var(--slide-title-chapter)" }}
                >
                  {currentSlide.title}
                </h1>
                {currentSlide.subtitle && (
                  <p
                    className="text-stone-400 font-light tracking-widest uppercase"
                    style={{ fontSize: "var(--slide-subtitle)" }}
                  >
                    {currentSlide.subtitle}
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="flex-1 p-12 flex flex-col overflow-hidden">
                  <div className="mb-8 shrink-0">
                    <h2
                      className="font-serif italic text-stone-900 leading-tight mb-4"
                      style={{ fontSize: "var(--slide-title)" }}
                    >
                      {currentSlide.title}
                    </h2>
                    <div className="h-1.5 w-20 bg-emerald-600 rounded-full" />
                  </div>
                  <div className="flex-1 prose prose-stone max-w-none prose-p:text-stone-600 prose-li:text-stone-600 overflow-y-auto pr-4 custom-scrollbar">
                    <ReactMarkdown remarkPlugins={[remarkBreaks]}>
                      {formatMarkdown(currentSlide.content)}
                    </ReactMarkdown>
                  </div>
                </div>
                <div
                  className="flex flex-col relative"
                  style={{ width: `${imageWidthPercent}%` }}
                >
                  <div className="w-full h-full p-8 flex items-center justify-center">
                    {currentSlide.contentType === "code" ? (
                      <div className="w-full h-full bg-[#1e1e1e] rounded-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col">
                        <div className="h-12 bg-[#2d2d2d] px-6 flex items-center gap-2 shrink-0">
                          <div className="w-3.5 h-3.5 rounded-full bg-[#ff5f56]" />
                          <div className="w-3.5 h-3.5 rounded-full bg-[#ffbd2e]" />
                          <div className="w-3.5 h-3.5 rounded-full bg-[#27c93f]" />
                          <div className="ml-auto text-xs text-stone-400 font-mono uppercase tracking-widest flex items-center gap-4">
                            <span className="text-[10px] opacity-50">
                              {currentSlide.fontSize || 14}px
                            </span>
                            <span>
                              {LANGUAGES.find(
                                (l) => l.id === currentSlide.language
                              )?.name ||
                                currentSlide.language ||
                                "JavaScript"}
                            </span>
                          </div>
                        </div>
                        <div className="flex-1 p-0 font-mono overflow-y-auto custom-scrollbar bg-[#1e1e1e]">
                          {currentSlide.code ? (
                            <SyntaxHighlighter
                              language={currentSlide.language || "javascript"}
                              style={vscDarkPlus}
                              codeTagProps={{
                                style: {
                                  fontSize: "inherit",
                                  lineHeight: "inherit",
                                  fontFamily: "inherit",
                                },
                              }}
                              customStyle={{
                                margin: 0,
                                padding: "2rem",
                                background: "transparent",
                                fontSize: `clamp(${
                                  (currentSlide.fontSize || 14) * 1.2
                                }px, 1.4vw, ${
                                  (currentSlide.fontSize || 14) * 2.2
                                }px)`,
                                lineHeight: "1.6",
                              }}
                            >
                              {currentSlide.code}
                            </SyntaxHighlighter>
                          ) : (
                            <div className="p-8 text-stone-500 italic">
                              // Sin código
                            </div>
                          )}
                        </div>
                      </div>
                    ) : currentSlide.contentType === "video" ? (
                      <div className="w-full h-full bg-stone-900 rounded-2xl overflow-hidden border border-white/10">
                        {currentSlide.videoUrl ? (
                          <iframe
                            src={getEmbedUrl(currentSlide.videoUrl)}
                            className="w-full h-full"
                            allowFullScreen
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-stone-500 italic">
                            // Sin video
                          </div>
                        )}
                      </div>
                    ) : currentSlide.imageUrl ? (
                      <img
                        src={currentSlide.imageUrl}
                        alt={currentSlide.title}
                        className="w-full h-full object-cover rounded-2xl"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-stone-300">
                        <ImageIcon size={120} strokeWidth={1} />
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </div>

        <div
          className="absolute inset-y-0 left-0 w-32 cursor-pointer group flex items-center justify-center"
          onClick={prevSlide}
        >
          <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-stone-900 shadow-xl">
            <ChevronLeft size={32} />
          </div>
        </div>
        <div
          className="absolute inset-y-0 right-0 w-32 cursor-pointer group flex items-center justify-center"
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
