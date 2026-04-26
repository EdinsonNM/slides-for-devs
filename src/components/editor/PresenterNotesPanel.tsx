import { useState } from "react";
import {
  StickyNote,
  Loader2,
  Sparkles,
  Mic,
  PenLine,
  ChevronRight,
} from "lucide-react";
import { usePresentation } from "@/presentation/contexts/PresentationContext";
import { cn } from "../../utils/cn";

const PANEL_WIDTH = 280;

interface PresenterNotesPanelProps {
  variant?: "sidebar" | "inspector";
}

export function PresenterNotesPanel({
  variant = "sidebar",
}: PresenterNotesPanelProps) {
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

  if (!isNotesPanelOpen || !currentSlide) return null;

  const busy = isProcessing || isGeneratingSpeech;

  const body = (
    <>
      <div
        className={cn(
          "shrink-0 px-3 py-2.5 border-b flex items-center justify-between gap-2",
          variant === "inspector"
            ? "border-stone-100 bg-stone-50/60 dark:border-border dark:bg-surface"
            : "border-stone-100 dark:border-border",
        )}
      >
        <span
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1",
            variant === "inspector" ? "text-muted-foreground" : "text-stone-500 dark:text-muted-foreground",
          )}
        >
          <StickyNote size={12} />
          Notas del presentador
        </span>
        {variant === "sidebar" && (
          <button
            type="button"
            onClick={() => setIsNotesPanelOpen(false)}
            className="p-1.5 rounded-md text-stone-400 dark:text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-700 hover:text-stone-600 dark:hover:text-foreground transition-colors"
            title="Cerrar panel"
          >
            <ChevronRight size={16} />
          </button>
        )}
      </div>
      <div className="flex-1 flex flex-col overflow-hidden p-2 min-h-0">
        <div className="flex gap-1 mb-1.5">
          <button
            type="button"
            onClick={handleGeneratePresenterNotes}
            disabled={busy}
            className="p-1.5 rounded-md text-stone-400 dark:text-stone-500 hover:bg-amber-50 dark:hover:bg-amber-900/40 hover:text-amber-600 dark:hover:text-amber-400 disabled:opacity-50 transition-colors"
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
            className="p-1.5 rounded-md text-stone-400 dark:text-stone-500 hover:bg-violet-50 dark:hover:bg-violet-900/40 hover:text-violet-600 dark:hover:text-violet-400 disabled:opacity-50 transition-colors"
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
            className="p-1.5 rounded-md text-stone-400 dark:text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-700 hover:text-stone-600 dark:hover:text-foreground disabled:opacity-50 transition-colors"
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
          className={cn(
            "w-full mb-2 px-2 py-1 text-[11px] border rounded focus:outline-none focus:ring-1 focus:ring-amber-500/30 focus:border-amber-500",
            variant === "inspector"
              ? "border-stone-200/90 bg-white text-foreground placeholder:text-muted-foreground dark:border-border dark:bg-background"
              : "border-stone-200 dark:border-border bg-white dark:bg-surface-elevated text-stone-900 dark:text-foreground placeholder:text-stone-400 dark:placeholder:text-stone-500",
          )}
          disabled={busy}
        />
        <textarea
          value={currentSlide.presenterNotes ?? ""}
          onChange={(e) => setPresenterNotesForCurrentSlide(e.target.value)}
          placeholder="Notas o speech para esta diapositiva…"
          className={cn(
            "flex-1 min-h-0 w-full p-2 text-[12px] border rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-amber-500/30 focus:border-amber-500",
            variant === "inspector"
              ? "border-stone-200/90 bg-white text-foreground placeholder:text-muted-foreground dark:border-border dark:bg-background"
              : "border-stone-200 bg-stone-50 text-stone-900 placeholder:text-stone-400 dark:border-border dark:bg-surface-elevated dark:text-foreground dark:placeholder:text-stone-500",
          )}
        />
      </div>
    </>
  );

  if (variant === "inspector") {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-surface-elevated">
        {body}
      </div>
    );
  }

  return (
    <aside
      className="bg-white dark:bg-surface border-l border-stone-200 dark:border-border shrink-0 flex flex-col overflow-hidden"
      style={{ width: PANEL_WIDTH }}
    >
      {body}
    </aside>
  );
}
