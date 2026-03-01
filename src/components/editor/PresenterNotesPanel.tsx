import { useState } from "react";
import {
  StickyNote,
  Loader2,
  Sparkles,
  Mic,
  PenLine,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";

export function PresenterNotesPanel() {
  const {
    currentSlide,
    setPresenterNotesForCurrentSlide,
    handleGeneratePresenterNotes,
    handleGenerateSpeechForCurrentSlide,
    handleRefinePresenterNotes,
    isProcessing,
    isGeneratingSpeech,
  } = usePresentation();
  const [expanded, setExpanded] = useState(true);
  const [prompt, setPrompt] = useState("");

  if (!currentSlide) return null;

  const busy = isProcessing || isGeneratingSpeech;

  return (
    <div className="mt-6 w-full max-w-5xl bg-white/80 backdrop-blur border border-stone-200 rounded-xl overflow-hidden shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-3 flex items-center justify-between text-left hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <StickyNote size={18} className="text-amber-600" />
          <span className="font-medium text-stone-800 text-sm">
            Notas del presentador
          </span>
        </div>
        {expanded ? (
          <ChevronUp size={18} className="text-stone-400" />
        ) : (
          <ChevronDown size={18} className="text-stone-400" />
        )}
      </button>
      {expanded && (
        <div className="px-6 pb-5 border-t border-stone-100 pt-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Contenido (notas y/o speech)
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleGeneratePresenterNotes}
                disabled={busy}
                className="p-2 rounded-lg text-stone-500 hover:bg-amber-50 hover:text-amber-600 disabled:opacity-50 transition-colors"
                title="Generar notas con IA"
              >
                {isProcessing ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Sparkles size={16} />
                )}
              </button>
              <button
                type="button"
                onClick={() =>
                  handleGenerateSpeechForCurrentSlide(
                    prompt.trim() || undefined
                  )
                }
                disabled={busy}
                className="p-2 rounded-lg text-stone-500 hover:bg-violet-50 hover:text-violet-600 disabled:opacity-50 transition-colors"
                title="Generar speech para esta diapositiva"
              >
                {isGeneratingSpeech ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Mic size={16} />
                )}
              </button>
              <button
                type="button"
                onClick={handleRefinePresenterNotes}
                disabled={busy}
                className="p-2 rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-700 disabled:opacity-50 transition-colors"
                title="Refinar contenido con IA"
              >
                <PenLine size={16} />
              </button>
            </div>
          </div>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Prompt opcional para generar (ej: tono informal)"
            className="w-full mb-3 px-3 py-1.5 text-xs border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            disabled={busy}
          />
          <textarea
            value={currentSlide.presenterNotes ?? ""}
            onChange={(e) => setPresenterNotesForCurrentSlide(e.target.value)}
            placeholder="Notas, guion o speech para esta diapositiva. Usa los botones para generar o refinar con IA."
            className="w-full h-28 p-3 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm resize-none"
          />
        </div>
      )}
    </div>
  );
}
