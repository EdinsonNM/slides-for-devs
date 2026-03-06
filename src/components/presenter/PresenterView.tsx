import { useEffect, useState, useRef } from "react";
import { Monitor, StickyNote, MessageCircle, ChevronLeft, ChevronRight } from "lucide-react";
import type { Slide } from "../../types";
import { presenterChat } from "../../services/gemini";
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

      <main className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        <PresenterSlideSummary slide={currentSlide} />

        <section className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="shrink-0 flex border-b border-stone-700">
            <button
              type="button"
              onClick={() => setActiveTab("notas")}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === "notas"
                  ? "text-amber-400 border-b-2 border-amber-400 bg-stone-800/50"
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
                  ? "text-amber-400 border-b-2 border-amber-400 bg-stone-800/50"
                  : "text-stone-400 hover:text-stone-200"
              }`}
            >
              <MessageCircle size={16} />
              Chat IA
            </button>
          </div>

          {activeTab === "notas" ? (
            <>
              <div className="flex-1 min-h-0 overflow-auto p-4">
                <div className="bg-stone-800 rounded-lg border border-stone-700 p-4 min-h-[80px]">
                  <p className="text-stone-300 text-sm whitespace-pre-wrap leading-relaxed">
                    {currentSlide.presenterNotes ||
                      (currentSlide as { speech?: string }).speech ||
                      "— Sin notas para esta diapositiva —"}
                  </p>
                </div>
              </div>
              {nextSlide && (
                <div className="shrink-0 px-4 pb-3 pt-1 border-t border-stone-800">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                    Siguiente
                  </p>
                  <p className="font-serif italic text-stone-400 text-sm truncate">
                    {nextSlide.title}
                  </p>
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
