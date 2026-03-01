import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Monitor,
  StickyNote,
} from "lucide-react";
import type { Slide } from "../../types";

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

  useEffect(() => {
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
    return () => window.removeEventListener("message", handler);
  }, []);

  const send = (type: string, payload?: Record<string, unknown>) => {
    if (window.opener) {
      window.opener.postMessage({ type, ...payload }, getOrigin());
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

  return (
    <div className="min-h-screen bg-stone-900 text-white flex flex-col">
      <header className="shrink-0 px-6 py-4 border-b border-stone-700 flex items-center justify-between">
        <h1 className="font-serif italic text-lg text-stone-200 truncate max-w-md">
          {topic}
        </h1>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-stone-700 rounded-full text-xs font-medium text-stone-300">
            {currentIndex + 1} / {slides.length}
          </span>
          <button
            onClick={() => {
              send("PRESENTER_CLOSE");
              window.close();
            }}
            className="p-2 rounded-lg hover:bg-stone-700 text-stone-400 hover:text-white transition-colors"
            title="Cerrar modo presentador"
          >
            <X size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 overflow-auto">
        {/* Vista previa de la diapositiva actual */}
        <section className="lg:col-span-1 space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-2">
            <Monitor size={14} />
            Diapositiva actual
          </h2>
          <div className="bg-stone-800 rounded-xl border border-stone-700 overflow-hidden p-4 aspect-video flex flex-col">
            <p className="font-serif italic text-stone-100 text-lg leading-tight mb-2">
              {currentSlide.title}
            </p>
            {currentSlide.type === "chapter" ? (
              currentSlide.subtitle && (
                <p className="text-stone-400 text-sm uppercase tracking-widest">
                  {currentSlide.subtitle}
                </p>
              )
            ) : (
              <div className="text-stone-400 text-sm line-clamp-4 overflow-hidden">
                {currentSlide.content
                  ?.replace(/#{1,6}\s/g, "")
                  .replace(/\*\*/g, "")
                  .slice(0, 200)}
                {(currentSlide.content?.length ?? 0) > 200 ? "…" : ""}
              </div>
            )}
            <div className="mt-auto flex gap-2">
              {currentSlide.imageUrl && (
                <span className="text-[10px] px-2 py-0.5 bg-stone-700 rounded text-stone-400">
                  Imagen
                </span>
              )}
              {currentSlide.contentType === "code" && (
                <span className="text-[10px] px-2 py-0.5 bg-stone-700 rounded text-stone-400">
                  Código
                </span>
              )}
              {currentSlide.contentType === "video" && (
                <span className="text-[10px] px-2 py-0.5 bg-stone-700 rounded text-stone-400">
                  Video
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Notas del presentador (único campo) */}
        <section className="lg:col-span-2 space-y-4">
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-2">
              <StickyNote size={14} />
              Notas del presentador
            </h2>
            <div className="bg-stone-800 rounded-xl border border-stone-700 p-4 min-h-[180px]">
              <p className="text-stone-300 text-sm whitespace-pre-wrap">
                {currentSlide.presenterNotes ||
                  (currentSlide as { speech?: string }).speech ||
                  "— Sin notas para esta diapositiva —"}
              </p>
            </div>
          </div>

          {/* Siguiente diapositiva */}
          {nextSlide && (
            <div className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Siguiente
              </h2>
              <div className="bg-stone-800/50 rounded-xl border border-stone-700 border-dashed p-3">
                <p className="font-serif italic text-stone-400 text-sm">
                  {nextSlide.title}
                </p>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Controles */}
      <footer className="shrink-0 px-6 py-4 border-t border-stone-700 flex items-center justify-between gap-4">
        <button
          onClick={() => send("PRESENTER_PREV")}
          disabled={currentIndex === 0}
          className="flex items-center gap-2 px-5 py-2.5 bg-stone-700 hover:bg-stone-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-medium transition-colors"
        >
          <ChevronLeft size={20} />
          Anterior
        </button>
        <button
          onClick={() => send("PRESENTER_NEXT")}
          disabled={currentIndex >= slides.length - 1}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-medium transition-colors"
        >
          Siguiente
          <ChevronRight size={20} />
        </button>
      </footer>
    </div>
  );
}
