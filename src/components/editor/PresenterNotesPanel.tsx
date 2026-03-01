import { useState } from "react";
import {
  StickyNote,
  Loader2,
  Sparkles,
  Mic,
  PenLine,
  ChevronRight,
} from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";

const PANEL_WIDTH = 280;

export function PresenterNotesPanel() {
  const {
    currentSlide,
    isNotesPanelOpen,
    setIsNotesPanelOpen,
    setPresenterNotesForCurrentSlide,
    handleGeneratePresenterNotes,
    handleGenerateSpeechForCurrentSlide,
    handleRefinePresenterNotes,
    isProcessing,
    isGeneratingSpeech,
  } = usePresentation();
  const [prompt, setPrompt] = useState("");

  if (!isNotesPanelOpen) return null;
  if (!currentSlide) return null;

  const busy = isProcessing || isGeneratingSpeech;

  return (
    <aside
      className="bg-white border-l border-stone-200 shrink-0 flex flex-col overflow-hidden"
      style={{ width: PANEL_WIDTH }}
    >
      <div className="shrink-0 px-2 py-2 border-b border-stone-100 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 flex items-center gap-1">
          <StickyNote size={12} />
          Notas
        </span>
        <button
          onClick={() => setIsNotesPanelOpen(false)}
          className="p-1.5 rounded-md text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
          title="Cerrar panel"
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="flex-1 flex flex-col overflow-hidden p-2">
        <div className="flex gap-1 mb-1.5">
          <button
            type="button"
            onClick={handleGeneratePresenterNotes}
            disabled={busy}
            className="p-1.5 rounded-md text-stone-400 hover:bg-amber-50 hover:text-amber-600 disabled:opacity-50 transition-colors"
            title="Generar notas"
          >
            {isProcessing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
          </button>
          <button
            type="button"
            onClick={() =>
              handleGenerateSpeechForCurrentSlide(prompt.trim() || undefined)
            }
            disabled={busy}
            className="p-1.5 rounded-md text-stone-400 hover:bg-violet-50 hover:text-violet-600 disabled:opacity-50 transition-colors"
            title="Generar speech"
          >
            {isGeneratingSpeech ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Mic size={14} />
            )}
          </button>
          <button
            type="button"
            onClick={handleRefinePresenterNotes}
            disabled={busy}
            className="p-1.5 rounded-md text-stone-400 hover:bg-stone-100 hover:text-stone-600 disabled:opacity-50 transition-colors"
            title="Refinar"
          >
            <PenLine size={14} />
          </button>
        </div>
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Prompt opcional"
          className="w-full mb-2 px-2 py-1 text-[11px] border border-stone-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-500/30 focus:border-amber-500"
          disabled={busy}
        />
        <textarea
          value={currentSlide.presenterNotes ?? ""}
          onChange={(e) => setPresenterNotesForCurrentSlide(e.target.value)}
          placeholder="Notas o speech para esta diapositiva…"
          className="flex-1 min-h-0 w-full p-2 text-[12px] bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500/30 focus:border-amber-500 resize-none"
        />
      </div>
    </aside>
  );
}
