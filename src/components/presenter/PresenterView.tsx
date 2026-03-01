import { useEffect, useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Monitor,
  StickyNote,
  MessageCircle,
  Send,
  Loader2,
} from "lucide-react";
import type { Slide } from "../../types";
import { presenterChat } from "../../services/gemini";

type ChatMessage = { role: "user" | "assistant"; content: string };

type PresenterState = {
  slides: Slide[];
  currentIndex: number;
  topic: string;
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
  const chatEndRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const send = (type: string) => {
    if (sendTauriRef.current) {
      sendTauriRef.current(type);
    } else if (window.opener) {
      window.opener.postMessage({ type }, getOrigin());
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

  const { slides, currentIndex, topic } = state;
  const currentSlide = slides[currentIndex];
  const nextSlide = slides[currentIndex + 1];

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
        text
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

  const markdownComponents = {
    code({
      className,
      children,
      ...props
    }: {
      className?: string;
      children?: React.ReactNode;
      [k: string]: unknown;
    }) {
      const match = /language-(\w+)/.exec(className || "");
      const code = String(children).replace(/\n$/, "");
      return match ? (
        <SyntaxHighlighter
          PreTag="div"
          style={vscDarkPlus}
          language={match[1]}
          customStyle={{
            margin: "0.5rem 0",
            borderRadius: "0.5rem",
            fontSize: "0.8rem",
          }}
          codeTagProps={{ style: { fontFamily: "inherit" } }}
        >
          {code}
        </SyntaxHighlighter>
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
  };

  return (
    <div className="h-screen bg-stone-900 text-white flex flex-col overflow-hidden">
      <header className="shrink-0 px-4 py-2.5 border-b border-stone-700 flex items-center justify-between">
        <h1 className="font-serif italic text-sm text-stone-200 truncate max-w-[50%]">
          {topic}
        </h1>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-stone-700 rounded-full text-xs font-medium text-stone-300">
            {currentIndex + 1} / {slides.length}
          </span>
          <button
            onClick={async () => {
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
            }}
            className="p-2 rounded-lg hover:bg-stone-700 text-stone-400 hover:text-white transition-colors"
            title="Cerrar modo presentador"
          >
            <X size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        {/* Diapositiva actual: arriba en móvil/estrecho, izquierda en ancho */}
        <aside className="shrink-0 flex flex-col gap-2 p-3 border-b md:border-b-0 md:border-r border-stone-700 md:w-[min(220px,28%)] md:min-w-[160px] md:max-w-[260px] max-h-[120px] md:max-h-[140px]">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5 shrink-0">
            <Monitor size={12} />
            Diapositiva actual
          </h2>
          <div className="bg-stone-800 rounded-lg border border-stone-700 p-2.5 min-h-0 overflow-auto flex flex-col gap-1">
            <p className="font-serif italic text-stone-100 text-sm leading-tight line-clamp-2">
              {currentSlide.title}
            </p>
            {currentSlide.type === "chapter" ? (
              currentSlide.subtitle && (
                <p className="text-stone-400 text-xs uppercase tracking-widest line-clamp-1">
                  {currentSlide.subtitle}
                </p>
              )
            ) : (
              <p className="text-stone-400 text-xs line-clamp-2 overflow-hidden">
                {currentSlide.content
                  ?.replace(/#{1,6}\s/g, "")
                  .replace(/\*\*/g, "")
                  .slice(0, 100)}
                {(currentSlide.content?.length ?? 0) > 100 ? "…" : ""}
              </p>
            )}
            <div className="flex gap-1 flex-wrap">
              {currentSlide.imageUrl && (
                <span className="text-[9px] px-1.5 py-0.5 bg-stone-700 rounded text-stone-400">
                  Imagen
                </span>
              )}
              {currentSlide.contentType === "code" && (
                <span className="text-[9px] px-1.5 py-0.5 bg-stone-700 rounded text-stone-400">
                  Código
                </span>
              )}
              {currentSlide.contentType === "video" && (
                <span className="text-[9px] px-1.5 py-0.5 bg-stone-700 rounded text-stone-400">
                  Video
                </span>
              )}
            </div>
          </div>
        </aside>

        {/* Tabs + contenido: notas o chat IA */}
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
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 min-h-0 overflow-auto p-4 space-y-4">
                {chatMessages.length === 0 && (
                  <p className="text-stone-500 text-sm">
                    Haz una pregunta sobre el tema o la diapositiva actual. La
                    IA usará el contexto de tu presentación para responder.
                  </p>
                )}
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={
                      msg.role === "user"
                        ? "flex justify-end"
                        : "flex justify-start"
                    }
                  >
                    <div
                      className={`max-w-[90%] rounded-lg p-3 text-sm ${
                        msg.role === "user"
                          ? "bg-emerald-800/50 text-stone-100"
                          : "bg-stone-700 border border-stone-600 text-white"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <div className="prose prose-invert prose-sm max-w-none prose-p:text-white prose-li:text-stone-100 prose-strong:text-white prose-headings:text-white prose-code:text-amber-200 prose-pre:bg-stone-900 prose-pre:border prose-pre:border-stone-600 [&>*]:text-white [&_ul]:text-stone-100 [&_ol]:text-stone-100">
                          <ReactMarkdown
                            remarkPlugins={[remarkBreaks]}
                            components={markdownComponents}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 flex items-center gap-2 text-stone-400 text-sm">
                      <Loader2 size={16} className="animate-spin" />
                      Pensando…
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="shrink-0 p-3 border-t border-stone-700 flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendChat();
                    }
                  }}
                  placeholder="Pregunta sobre el tema o la diapositiva…"
                  className="flex-1 min-w-0 px-3 py-2 bg-stone-800 border border-stone-600 rounded-lg text-sm text-stone-200 placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                  disabled={chatLoading}
                />
                <button
                  type="button"
                  onClick={handleSendChat}
                  disabled={!chatInput.trim() || chatLoading}
                  className="p-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
                  title="Enviar"
                >
                  {chatLoading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Send size={18} />
                  )}
                </button>
              </div>
            </div>
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
