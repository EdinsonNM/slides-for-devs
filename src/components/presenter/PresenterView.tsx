import { useEffect, useState, useRef } from "react";
import { Monitor, StickyNote, MessageCircle, ChevronLeft, ChevronRight } from "lucide-react";
import type { Slide } from "../../types";
import { slideUsesFullBleedCanvas } from "../../domain/entities";
import { usePresentation } from "../../context/PresentationContext";
import { presenterChat } from "../../services/gemini";
import { PreviewSlideContent } from "../preview/PreviewSlideContent";
import { PresenterHeader } from "./PresenterHeader";
import { PresenterSlideSummary } from "./PresenterSlideSummary";
import { PresenterChat, type ChatMessage } from "./PresenterChat";

export type PresenterState = {
  slides: Slide[];
  currentIndex: number;
  topic: string;
  effectiveGeminiModel?: string;
};

function getOrigin(): string {
  return window.location.origin;
}

export function PresenterView() {
  const { formatMarkdown, imageWidthPercent, panelHeightPercent } = usePresentation();
  const [state, setState] = useState<PresenterState | null>(null);
  const [activeTab, setActiveTab] = useState<"notas" | "chat">("notas");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const sendTauriRef = useRef<((type: string) => void) | null>(null);

  useEffect(() => {
    let unlisten: Array<() => void> = [];

    (async () => {
      try {
        const eventApi = await import("@tauri-apps/api/event");
        unlisten.push(
          await eventApi.listen<{ payload: PresenterState }>(
            "presentation-state",
            (e) => {
              if (e.payload?.payload) setState(e.payload.payload);
            }
          )
        );
        unlisten.push(
          await eventApi.listen<{ currentIndex: number }>(
            "slide-changed",
            (e) => {
              if (typeof e.payload?.currentIndex !== "number") return;
              setState((s) =>
                s ? { ...s, currentIndex: e.payload!.currentIndex } : null
              );
            }
          )
        );
        sendTauriRef.current = (type: string) => {
          void eventApi.emit(type);
        };
        await eventApi.emit("presenter-ready");
      } catch {
        const handler = (e: MessageEvent) => {
          if (e.origin !== getOrigin()) return;
          if (e.data?.type === "PRESENTATION_STATE" && e.data.payload) {
            setState(e.data.payload);
          }
          if (
            e.data?.type === "SLIDE_CHANGED" &&
            typeof e.data.currentIndex === "number"
          ) {
            setState((s) =>
              s ? { ...s, currentIndex: e.data.currentIndex } : null
            );
          }
        };
        window.addEventListener("message", handler);
        if (window.opener) {
          window.opener.postMessage({ type: "PRESENTER_READY" }, getOrigin());
        }
        unlisten.push(() => window.removeEventListener("message", handler));
      }
    })();

    return () => {
      unlisten.forEach((u) => u());
      sendTauriRef.current = null;
    };
  }, []);

  const send = (type: string) => {
    if (sendTauriRef.current) {
      sendTauriRef.current(type);
    } else if (window.opener) {
      window.opener.postMessage({ type }, getOrigin());
    }
  };

  const handleClose = async () => {
    send("PRESENTER_CLOSE");
    if (sendTauriRef.current) {
      try {
        const { getCurrentWebviewWindow } = await import(
          "@tauri-apps/api/webviewWindow"
        );
        await getCurrentWebviewWindow().close();
      } catch {
        window.close();
      }
    } else {
      window.close();
    }
  };

  if (!state || state.slides.length === 0) {
    return (
      <div className="min-h-screen bg-stone-900 text-white flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <Monitor size={48} className="mx-auto text-stone-500" />
          <p className="text-stone-400">
            Abre la vista previa de la presentación y haz clic en &quot;Modo
            presentador&quot; para ver las notas y controles aquí.
          </p>
          <p className="text-sm text-stone-500">
            Esta ventana se sincronizará automáticamente.
          </p>
        </div>
      </div>
    );
  }

  const { slides, currentIndex, topic, effectiveGeminiModel } = state;
  const currentSlide = slides[currentIndex];
  const nextSlide = slides[currentIndex + 1];
  const chatModel = effectiveGeminiModel || "gemini-2.5-flash";

  const handleSendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading || !topic || !currentSlide) return;
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: text }]);
    setChatLoading(true);
    try {
      const reply = await presenterChat(
        topic,
        currentSlide.title,
        currentSlide.content,
        text,
        chatModel
      );
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply },
      ]);
    } catch (e) {
      console.error(e);
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "No pude procesar la consulta. Revisa la conexión o intenta de nuevo.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="h-screen bg-stone-900 text-white flex flex-col overflow-hidden">
      <PresenterHeader
        topic={topic}
        currentIndex={currentIndex}
        totalSlides={slides.length}
        onClose={handleClose}
      />

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:flex-row">
        <section
          className={
            slideUsesFullBleedCanvas(currentSlide.type)
              ? "relative z-10 order-2 flex min-h-0 min-w-0 flex-1 flex-col bg-stone-950 p-2 md:order-1 md:p-3"
              : "relative z-10 order-2 flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center bg-stone-950 p-2 md:order-1 md:p-4"
          }
        >
          <div className="flex min-h-0 w-full max-h-full max-w-[min(100%,1600px)] flex-1 overflow-hidden rounded-xl border border-stone-800 bg-white text-stone-900 shadow-2xl">
            <PreviewSlideContent
              slide={currentSlide}
              formatMarkdown={formatMarkdown}
              imageWidthPercent={imageWidthPercent}
              panelHeightPercent={panelHeightPercent}
            />
          </div>
        </section>

        <div className="order-1 flex min-h-0 w-full shrink-0 flex-col border-stone-700 bg-stone-900 md:order-2 md:w-[min(400px,40vw)] md:max-w-md md:min-w-[280px] md:border-l">
          <PresenterSlideSummary slide={currentSlide} layout="stacked" />

          <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-t border-stone-800 md:border-t-0">
            <div className="flex shrink-0 border-b border-stone-700">
              <button
                type="button"
                onClick={() => setActiveTab("notas")}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === "notas"
                    ? "border-b-2 border-amber-400 bg-stone-800/50 text-amber-400"
                    : "text-stone-400 hover:text-stone-200"
                }`}
              >
                <StickyNote size={16} />
                Notas
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("chat")}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === "chat"
                    ? "border-b-2 border-amber-400 bg-stone-800/50 text-amber-400"
                    : "text-stone-400 hover:text-stone-200"
                }`}
              >
                <MessageCircle size={16} />
                Chat IA
              </button>
            </div>

            {activeTab === "notas" ? (
              <>
                <div className="min-h-0 flex-1 overflow-auto p-4">
                  <div className="min-h-[80px] rounded-lg border border-stone-700 bg-stone-800 p-4">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-stone-300">
                      {currentSlide.presenterNotes ||
                        (currentSlide as { speech?: string }).speech ||
                        "— Sin notas para esta diapositiva —"}
                    </p>
                  </div>
                </div>
                {nextSlide && (
                  <div className="shrink-0 border-t border-stone-800 px-4 pt-1 pb-3">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                      Siguiente
                    </p>
                    <p className="truncate font-serif text-sm italic text-stone-400">{nextSlide.title}</p>
                  </div>
                )}
              </>
            ) : (
              <PresenterChat
                messages={chatMessages}
                input={chatInput}
                loading={chatLoading}
                onInputChange={setChatInput}
                onSend={handleSendChat}
              />
            )}
          </section>
        </div>
      </main>

      <footer className="shrink-0 px-4 py-3 border-t border-stone-700 flex items-center justify-between gap-3">
        <button
          onClick={() => send("presenter-prev")}
          disabled={currentIndex === 0}
          className="flex items-center gap-1.5 px-4 py-2 bg-stone-700 hover:bg-stone-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
        >
          <ChevronLeft size={18} />
          Anterior
        </button>
        <button
          onClick={() => send("presenter-next")}
          disabled={currentIndex >= slides.length - 1}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
        >
          Siguiente
          <ChevronRight size={18} />
        </button>
      </footer>
    </div>
  );
}
