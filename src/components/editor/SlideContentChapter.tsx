import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Pencil } from "lucide-react";
import { usePresentation } from "@/presentation/contexts/PresentationContext";
import { cn } from "../../utils/cn";
import { SlideMarkdown } from "../shared/SlideMarkdown";
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
  const subtitleTaRef = useRef<HTMLTextAreaElement>(null);
  const blurCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deselectInsideSlideRef = useRef(false);
  /** Enfoque inicial al entrar en edición (lápiz → título; clic en subtítulo → subtítulo). */
  const pendingFocusRef = useRef<ChapterBlock>("title");

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

  /**
   * Si el puntero cae en la zona del subtítulo pero el target es el textarea del título (solapamiento),
   * hay que actuar ANTES del check de data-slide-edit-field; si no, el handler sale siempre por el título.
   */
  const onSlideSurfacePointerDownCapture = useCallback(
    (e: React.PointerEvent) => {
      if (!isEditing) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;

      const subEl = subtitleTaRef.current;
      if (subEl && activeBlock !== "subtitle") {
        const r = subEl.getBoundingClientRect();
        const pad = 16;
        const { clientX: x, clientY: y } = e;
        if (
          x >= r.left - pad &&
          x <= r.right + pad &&
          y >= r.top - pad &&
          y <= r.bottom + pad
        ) {
          cancelScheduledCommit();
          setActiveBlock("subtitle");
          e.preventDefault();
          e.stopPropagation();
          queueMicrotask(() => {
            subEl.focus({ preventScroll: true });
          });
          return;
        }
      }

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
    [isEditing, activeBlock, cancelScheduledCommit],
  );

  useEffect(() => {
    if (!isEditing) setActiveBlock(null);
  }, [isEditing]);

  useEffect(() => {
    setActiveBlock(null);
    pendingFocusRef.current = "title";
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

  useEffect(() => {
    if (!isEditing) return;
    const which = pendingFocusRef.current;
    const id = requestAnimationFrame(() => {
      if (which === "subtitle") {
        subtitleTaRef.current?.focus({ preventScroll: true });
      } else {
        titleTaRef.current?.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(id);
  }, [isEditing, currentSlide?.id]);

  if (!currentSlide) return null;

  const titleW = currentSlide.editorTitleWidthPercent ?? 100;

  return (
    <div
      className="text-center p-5 space-y-4 overflow-y-auto max-h-full w-full flex flex-col items-center md:p-8 md:space-y-5 lg:p-10 xl:p-12 lg:space-y-6"
      onPointerDownCapture={onSlideSurfacePointerDownCapture}
    >
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: 60 }}
        className="h-1 bg-emerald-600 rounded-full shrink-0"
      />
      <div
        ref={titleMeasureRef}
        className="flex flex-col items-center w-full max-w-3xl gap-0"
      >
        {isEditing ? (
          <>
            <CanvaSelectionFrame
              className="z-1 w-full shrink-0"
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
                onFocus={() => {
                  cancelScheduledCommit();
                  setActiveBlock("title");
                }}
                {...{ [EDIT_FIELD_ATTR]: "true" }}
                aria-label="Título del capítulo"
                placeholder="Título del capítulo"
                rows={1}
                className="font-serif italic text-stone-900 dark:text-foreground leading-tight text-center bg-transparent border-0 shadow-none focus:outline-none focus:ring-0 w-full py-2 rounded-md resize-none overflow-hidden whitespace-pre-wrap wrap-break-word"
                style={{ fontSize: "var(--slide-title-chapter)" }}
              />
            </CanvaSelectionFrame>

            {/* Separación fija + input siempre montado: rect estable para hit-test por coordenadas */}
            <div className="mt-10 w-full shrink-0 flex flex-col items-center md:mt-12">
              <CanvaSelectionFrame
                className="z-10 w-full"
                showChrome={activeBlock === "subtitle"}
                widthPercent={titleW}
                innerClassName="w-full"
              >
                <textarea
                  ref={subtitleTaRef}
                  value={editSubtitle}
                  onChange={(e) => setEditSubtitle(e.target.value)}
                  onBlur={scheduleCommitAfterBlur}
                  onFocus={() => {
                    cancelScheduledCommit();
                    setActiveBlock("subtitle");
                  }}
                  {...{ [EDIT_FIELD_ATTR]: "true" }}
                  aria-label="Subtítulo (opcional, markdown)"
                  placeholder="Subtítulo (opcional, markdown)"
                  rows={3}
                  className="min-h-24 w-full resize-y rounded-md border-0 bg-stone-100/90 px-3 py-2.5 text-center text-sm font-light tracking-wide text-stone-500 shadow-none focus:outline-none focus:ring-2 focus:ring-emerald-500/40 dark:bg-stone-800/70 dark:text-stone-400 whitespace-pre-wrap wrap-break-word"
                />
              </CanvaSelectionFrame>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center gap-2 w-full">
              <h1
                className="font-serif italic text-stone-900 dark:text-stone-100 leading-tight cursor-text hover:bg-stone-50 dark:hover:bg-stone-800 rounded px-3 py-1 transition-colors whitespace-pre-wrap wrap-break-word max-w-full"
                style={{ fontSize: "var(--slide-title-chapter)" }}
                onClick={() => {
                  pendingFocusRef.current = "title";
                  setActiveBlock("title");
                  setIsEditing(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    pendingFocusRef.current = "title";
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
                onClick={() => {
                  pendingFocusRef.current = "title";
                  setActiveBlock("title");
                  setIsEditing(true);
                }}
                className={cn(
                  "p-1.5 rounded-md transition-colors shrink-0",
                  "text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700 hover:text-emerald-600 dark:hover:text-emerald-400",
                )}
                title="Editar título"
              >
                <Pencil size={18} />
              </button>
            </div>
            {currentSlide.subtitle ? (
              <div
                className="mt-6 cursor-text rounded px-2 py-1 font-light tracking-wide transition-colors hover:bg-stone-50 dark:hover:bg-stone-800 md:mt-8"
                style={{ fontSize: "var(--slide-subtitle)" }}
                role="button"
                tabIndex={0}
                title="Clic para editar subtítulo"
                onClick={() => {
                  pendingFocusRef.current = "subtitle";
                  setActiveBlock("subtitle");
                  setIsEditing(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    pendingFocusRef.current = "subtitle";
                    setActiveBlock("subtitle");
                    setIsEditing(true);
                  }
                }}
              >
                <SlideMarkdown className="prose-sm mx-auto max-w-none text-center normal-case dark:prose-invert">
                  {currentSlide.subtitle}
                </SlideMarkdown>
              </div>
            ) : (
              <p
                className="mt-6 text-stone-400 dark:text-stone-500 font-light tracking-wide uppercase cursor-text hover:bg-stone-50 dark:hover:bg-stone-800 rounded px-2 py-1 transition-colors text-sm md:mt-8"
                style={{ fontSize: "var(--slide-subtitle)" }}
                role="button"
                tabIndex={0}
                onClick={() => {
                  pendingFocusRef.current = "subtitle";
                  setActiveBlock("subtitle");
                  setIsEditing(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    pendingFocusRef.current = "subtitle";
                    setActiveBlock("subtitle");
                    setIsEditing(true);
                  }
                }}
              >
                Clic para añadir subtítulo (opcional)
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
