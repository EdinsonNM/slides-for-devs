import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Pencil } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";
import { CanvaSelectionFrame } from "./CanvaSelectionFrame";

const EDIT_FIELD_ATTR = "data-slide-edit-field";

type ChapterBlock = "title" | "subtitle";

export function SlideContentChapter() {
  const {
    currentSlide,
    isEditing,
    setIsEditing,
    editTitle,
    setEditTitle,
    editSubtitle,
    setEditSubtitle,
    commitSlideEdits,
  } = usePresentation();

  const [activeBlock, setActiveBlock] = useState<ChapterBlock | null>(null);
  const titleMeasureRef = useRef<HTMLDivElement>(null);
  const titleTaRef = useRef<HTMLTextAreaElement>(null);
  const blurCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deselectInsideSlideRef = useRef(false);

  const cancelScheduledCommit = useCallback(() => {
    if (blurCommitTimerRef.current != null) {
      clearTimeout(blurCommitTimerRef.current);
      blurCommitTimerRef.current = null;
    }
  }, []);

  const scheduleCommitAfterBlur = useCallback(() => {
    if (!isEditing) return;
    cancelScheduledCommit();
    blurCommitTimerRef.current = setTimeout(() => {
      blurCommitTimerRef.current = null;
      const ae = document.activeElement;
      if (ae instanceof HTMLElement) {
        if (ae.closest(`[${EDIT_FIELD_ATTR}="true"]`)) return;
      }
      if (deselectInsideSlideRef.current) {
        deselectInsideSlideRef.current = false;
        commitSlideEdits({ keepEditing: true });
        return;
      }
      commitSlideEdits();
    }, 160);
  }, [isEditing, cancelScheduledCommit, commitSlideEdits]);

  const clearActiveBlockOnSurfacePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isEditing) return;
      const el = e.target;
      if (!(el instanceof HTMLElement)) return;
      if (
        el.closest(`[${EDIT_FIELD_ATTR}="true"]`) != null ||
        el.closest("[data-slide-selection-frame]") != null
      ) {
        return;
      }
      setActiveBlock((prev) => {
        if (prev == null) return prev;
        deselectInsideSlideRef.current = true;
        return null;
      });
    },
    [isEditing],
  );

  useEffect(() => {
    if (!isEditing) setActiveBlock(null);
  }, [isEditing]);

  useEffect(() => {
    setActiveBlock(null);
  }, [currentSlide?.id]);

  useLayoutEffect(() => {
    const el = titleTaRef.current;
    if (!el || !isEditing) return;
    el.style.height = "auto";
    const min =
      currentSlide?.editorTitleMinHeightPx != null
        ? Math.max(40, currentSlide.editorTitleMinHeightPx)
        : 56;
    el.style.height = `${Math.max(min, el.scrollHeight)}px`;
  }, [editTitle, isEditing, activeBlock, currentSlide?.editorTitleMinHeightPx]);

  useEffect(() => () => cancelScheduledCommit(), [cancelScheduledCommit]);

  useEffect(() => {
    if (!isEditing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      commitSlideEdits();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isEditing, commitSlideEdits]);

  if (!currentSlide) return null;

  const titleW = currentSlide.editorTitleWidthPercent ?? 100;

  return (
    <div
      className="text-center p-5 space-y-4 overflow-y-auto max-h-full w-full flex flex-col items-center md:p-8 md:space-y-5 lg:p-10 xl:p-12 lg:space-y-6"
      onPointerDownCapture={clearActiveBlockOnSurfacePointerDown}
    >
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: 60 }}
        className="h-1 bg-emerald-600 rounded-full shrink-0"
      />
      <div
        ref={titleMeasureRef}
        className="flex flex-col items-center gap-3 w-full max-w-3xl"
      >
        {isEditing ? (
          <>
            <CanvaSelectionFrame
              showChrome={activeBlock === "title"}
              widthPercent={titleW}
              measureElRef={titleMeasureRef}
              innerClassName="w-full"
            >
              <textarea
                ref={titleTaRef}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={scheduleCommitAfterBlur}
                onFocus={() => setActiveBlock("title")}
                {...{ [EDIT_FIELD_ATTR]: "true" }}
                placeholder="Título del capítulo"
                rows={1}
                className="font-serif italic text-stone-900 dark:text-foreground leading-tight text-center bg-transparent border-0 shadow-none focus:outline-none focus:ring-0 w-full py-2 rounded-md resize-none overflow-hidden whitespace-pre-wrap wrap-break-word"
                style={{ fontSize: "var(--slide-title-chapter)" }}
                autoFocus
              />
            </CanvaSelectionFrame>
            <CanvaSelectionFrame
              showChrome={activeBlock === "subtitle"}
              widthPercent={titleW}
              innerClassName="w-full"
            >
              <input
                type="text"
                value={editSubtitle}
                onChange={(e) => setEditSubtitle(e.target.value)}
                onBlur={scheduleCommitAfterBlur}
                onFocus={() => setActiveBlock("subtitle")}
                {...{ [EDIT_FIELD_ATTR]: "true" }}
                placeholder="Subtítulo (opcional)"
                className="text-stone-500 dark:text-stone-400 font-light tracking-wide uppercase text-center bg-transparent border-0 shadow-none focus:outline-none focus:ring-0 w-full py-2 text-sm rounded-md"
              />
            </CanvaSelectionFrame>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center gap-2 w-full">
              <h1
                className="font-serif italic text-stone-900 dark:text-stone-100 leading-tight cursor-text hover:bg-stone-50 dark:hover:bg-stone-800 rounded px-3 py-1 transition-colors whitespace-pre-wrap wrap-break-word max-w-full"
                style={{ fontSize: "var(--slide-title-chapter)" }}
                onClick={() => {
                  setActiveBlock("title");
                  setIsEditing(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setActiveBlock("title");
                    setIsEditing(true);
                  }
                }}
                role="button"
                tabIndex={0}
                title="Clic para editar el título"
              >
                {currentSlide.title || "Sin título"}
              </h1>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className={cn(
                  "p-1.5 rounded-md transition-colors shrink-0",
                  "text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700 hover:text-emerald-600 dark:hover:text-emerald-400",
                )}
                title="Editar título"
              >
                <Pencil size={18} />
              </button>
            </div>
            {currentSlide.subtitle && (
              <p
                className="text-stone-500 dark:text-stone-300 font-light tracking-wide uppercase cursor-text hover:bg-stone-50 dark:hover:bg-stone-800 rounded px-2 py-1 transition-colors"
                style={{ fontSize: "var(--slide-subtitle)" }}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setActiveBlock("subtitle");
                  setIsEditing(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setActiveBlock("subtitle");
                    setIsEditing(true);
                  }
                }}
              >
                {currentSlide.subtitle}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
