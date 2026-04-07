import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Pencil, RefreshCw, Split, Sparkles, Wand2 } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";
import { SlideMarkdown } from "../shared/SlideMarkdown";
import { SlideRightPanel } from "./SlideRightPanel";
import { CanvaSelectionFrame } from "./CanvaSelectionFrame";

const EDIT_FIELD_ATTR = "data-slide-edit-field";

type EditBlock = "title" | "subtitle" | "content";

export function SlideContentDefault() {
  const {
    currentSlide,
    currentIndex,
    formatMarkdown,
    isEditing,
    setIsEditing,
    editTitle,
    setEditTitle,
    editSubtitle,
    setEditSubtitle,
    editContent,
    setEditContent,
    commitSlideEdits,
    setSlides,
    setShowRewriteModal,
    setShowGenerateSlideContentModal,
    setGenerateSlideContentPrompt,
    setShowSplitModal,
    panelHeightPercent,
    isResizingPanelHeight,
    setIsResizingPanelHeight,
  } = usePresentation();

  const [activeBlock, setActiveBlock] = useState<EditBlock | null>(null);
  const titleMeasureRef = useRef<HTMLDivElement>(null);
  const contentMeasureRef = useRef<HTMLDivElement>(null);
  const titleTextareaRef = useRef<HTMLTextAreaElement>(null);
  const blurCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Tras pulsar el handle de resize, el textarea hace blur; evitar confirmar hasta terminar el gesto. */
  const suppressBlurCommitUntilRef = useRef(0);
  /** Clic dentro de la diapositiva pero fuera del texto: deseleccionar sin salir del modo edición. */
  const deselectInsideSlideRef = useRef(false);

  const cancelScheduledCommit = useCallback(() => {
    if (blurCommitTimerRef.current != null) {
      clearTimeout(blurCommitTimerRef.current);
      blurCommitTimerRef.current = null;
    }
  }, []);

  const scheduleCommitAfterBlur = useCallback(() => {
    if (!isEditing) return;
    if (Date.now() < suppressBlurCommitUntilRef.current) return;
    cancelScheduledCommit();
    blurCommitTimerRef.current = setTimeout(() => {
      blurCommitTimerRef.current = null;
      if (Date.now() < suppressBlurCommitUntilRef.current) return;
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

  const onResizePointerDown = useCallback(() => {
    cancelScheduledCommit();
    suppressBlurCommitUntilRef.current = Date.now() + 750;
  }, [cancelScheduledCommit]);

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

  const patchEditorFrame = useCallback(
    (part: "title" | "content", widthPercent: number, minHeightPx: number) => {
      setSlides((prev) => {
        const s = prev[currentIndex];
        if (!s) return prev;
        const next = { ...s };
        if (part === "title") {
          next.editorTitleWidthPercent = widthPercent;
          next.editorTitleMinHeightPx = minHeightPx;
        } else {
          next.editorContentWidthPercent = widthPercent;
          next.editorContentMinHeightPx = minHeightPx;
        }
        const u = [...prev];
        u[currentIndex] = next;
        return u;
      });
    },
    [currentIndex, setSlides],
  );

  useEffect(() => {
    if (!isEditing) setActiveBlock(null);
  }, [isEditing]);

  useEffect(() => {
    setActiveBlock(null);
  }, [currentSlide?.id, currentIndex]);

  useLayoutEffect(() => {
    const el = titleTextareaRef.current;
    if (!el || !isEditing || activeBlock !== "title") return;
    el.style.height = "auto";
    const min =
      currentSlide?.editorTitleMinHeightPx != null
        ? Math.max(40, currentSlide.editorTitleMinHeightPx)
        : 48;
    el.style.height = `${Math.max(min, el.scrollHeight)}px`;
  }, [
    editTitle,
    isEditing,
    activeBlock,
    currentSlide?.editorTitleMinHeightPx,
  ]);

  useEffect(() => {
    if (!isEditing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      cancelScheduledCommit();
      commitSlideEdits();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isEditing, commitSlideEdits, cancelScheduledCommit]);

  useEffect(() => () => cancelScheduledCommit(), [cancelScheduledCommit]);

  if (!currentSlide) return null;

  const isPanelFull = currentSlide.contentLayout === "panel-full";

  const titleW = currentSlide.editorTitleWidthPercent ?? 100;
  const titleH =
    currentSlide.editorTitleMinHeightPx != null
      ? currentSlide.editorTitleMinHeightPx
      : undefined;
  const contentW = currentSlide.editorContentWidthPercent ?? 100;
  const contentH = currentSlide.editorContentMinHeightPx ?? 120;

  if (isPanelFull) {
    const titleHeightPercent = 100 - panelHeightPercent;
    return (
      <>
        <div
          className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0 h-full relative"
          onPointerDownCapture={clearActiveBlockOnSurfacePointerDown}
        >
          <div
            className="px-8 pt-6 pb-4 border-stone-100 dark:border-border flex items-start justify-between gap-4 overflow-visible"
            style={{
              flex: `0 0 ${titleHeightPercent}%`,
              minHeight: 0,
              borderBottomWidth: isResizingPanelHeight ? 0 : 1,
            }}
          >
            <div className="flex-1 min-w-0 flex flex-col gap-3 overflow-visible">
              {isEditing ? (
                <>
                  <div ref={titleMeasureRef} className="min-w-0 overflow-visible">
                    {activeBlock === "title" ? (
                      <CanvaSelectionFrame
                        showChrome
                        widthPercent={titleW}
                        minHeightPx={titleH}
                        measureElRef={titleMeasureRef}
                        onResizePointerDown={onResizePointerDown}
                        onResize={({ widthPercent, minHeightPx }) =>
                          patchEditorFrame("title", widthPercent, minHeightPx)
                        }
                        innerClassName="space-y-2"
                      >
                        <textarea
                          ref={titleTextareaRef}
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onBlur={scheduleCommitAfterBlur}
                          onFocus={() => {
                            cancelScheduledCommit();
                            setActiveBlock("title");
                          }}
                          {...{ [EDIT_FIELD_ATTR]: "true" }}
                          placeholder="Título"
                          rows={1}
                          className="font-serif italic text-stone-900 dark:text-foreground leading-tight bg-transparent border-0 shadow-none focus:outline-none focus:ring-0 w-full rounded-md px-2 py-1 resize-none overflow-hidden whitespace-pre-wrap wrap-break-word"
                          style={{ fontSize: "var(--slide-title)" }}
                        />
                      </CanvaSelectionFrame>
                    ) : (
                      <CanvaSelectionFrame
                        showChrome={false}
                        widthPercent={titleW}
                        minHeightPx={titleH}
                        measureElRef={titleMeasureRef}
                      >
                        <h2
                          className="font-serif italic text-stone-900 dark:text-stone-100 leading-tight cursor-text rounded-md px-2 py-1 hover:bg-stone-50 dark:hover:bg-stone-800 whitespace-pre-wrap wrap-break-word"
                          style={{ fontSize: "var(--slide-title)" }}
                          onPointerDown={() => cancelScheduledCommit()}
                          onClick={() => setActiveBlock("title")}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") setActiveBlock("title");
                          }}
                        >
                          {editTitle.trim() || "Sin título"}
                        </h2>
                      </CanvaSelectionFrame>
                    )}
                  </div>
                  {activeBlock === "subtitle" ? (
                    <CanvaSelectionFrame
                      showChrome
                      widthPercent={titleW}
                      innerClassName="space-y-2"
                    >
                      <input
                        type="text"
                        value={editSubtitle}
                        onChange={(e) => setEditSubtitle(e.target.value)}
                        onBlur={scheduleCommitAfterBlur}
                        onFocus={() => {
                          cancelScheduledCommit();
                          setActiveBlock("subtitle");
                        }}
                        {...{ [EDIT_FIELD_ATTR]: "true" }}
                        placeholder="Subtítulo o descripción (opcional)"
                        className="text-stone-500 dark:text-stone-400 bg-transparent border-0 shadow-none focus:outline-none focus:ring-0 w-full text-sm rounded-md px-2 py-1"
                      />
                    </CanvaSelectionFrame>
                  ) : (
                    <div
                      className="text-stone-500 dark:text-stone-300 text-sm cursor-text rounded px-2 py-1 hover:bg-stone-50 dark:hover:bg-stone-800 min-h-6"
                      onPointerDown={() => cancelScheduledCommit()}
                      onClick={() => setActiveBlock("subtitle")}
                      role="button"
                      tabIndex={0}
                    >
                      {editSubtitle.trim() ||
                        "Clic para subtítulo (opcional)"}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h2
                    className="font-serif italic text-stone-900 dark:text-stone-100 leading-tight cursor-text hover:bg-stone-50 dark:hover:bg-stone-800 rounded px-1 -mx-1 py-0.5 transition-colors whitespace-pre-wrap wrap-break-word"
                    style={{ fontSize: "var(--slide-title)" }}
                    onClick={() => {
                      setActiveBlock("title");
                      setIsEditing(true);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setActiveBlock("title");
                        setIsEditing(true);
                      }
                    }}
                    title="Clic para editar"
                  >
                    {currentSlide.title || "Sin título"}
                  </h2>
                  {currentSlide.subtitle ? (
                    <p
                      className="text-stone-500 dark:text-stone-300 text-sm cursor-text hover:bg-stone-50 dark:hover:bg-stone-800 rounded px-1 -mx-1 py-0.5 transition-colors"
                      onClick={() => {
                        setActiveBlock("subtitle");
                        setIsEditing(true);
                      }}
                      role="button"
                      tabIndex={0}
                      title="Clic para editar subtítulo"
                    >
                      {currentSlide.subtitle}
                    </p>
                  ) : (
                    <p
                      className="text-stone-400 dark:text-stone-500 text-sm italic cursor-text hover:bg-stone-50 dark:hover:bg-stone-800 rounded px-1 -mx-1 py-0.5"
                      onClick={() => {
                        setActiveBlock("subtitle");
                        setIsEditing(true);
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      Clic para añadir subtítulo (opcional)
                    </p>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0 self-start">
              {!isEditing && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="p-1.5 rounded-md transition-colors text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700 hover:text-emerald-600 dark:hover:text-emerald-400"
                  title="Editar título"
                >
                  <Pencil size={16} />
                </button>
              )}
            </div>
          </div>
          <div
            className="absolute left-0 right-0 h-1.5 cursor-row-resize flex items-center justify-center z-30 group/handle hover:bg-emerald-500/20 transition-colors"
            style={{
              top: `${titleHeightPercent}%`,
              transform: "translateY(-50%)",
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizingPanelHeight(true);
            }}
            title="Arrastra para ajustar el tamaño del panel"
          >
            <div className="w-12 h-0.5 bg-stone-300 group-hover/handle:bg-emerald-500 rounded-full" />
          </div>
          <div className="min-h-0 flex-1 flex flex-col relative overflow-hidden">
            <SlideRightPanel fullWidth />
          </div>
        </div>
      </>
    );
  }

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden"
      onPointerDownCapture={clearActiveBlockOnSurfacePointerDown}
    >
      <div className="flex-1 p-12 flex flex-col overflow-x-visible overflow-y-hidden min-h-0">
        <div className="mb-8 shrink-0 flex items-start justify-between gap-4 overflow-visible">
          <div className="flex-1 mr-4 min-w-0 flex flex-col overflow-visible">
            <span
              className="uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 font-bold mb-2 block"
              style={{ fontSize: "var(--slide-label)" }}
            >
              Sección {currentIndex + 1}
            </span>
            <div ref={titleMeasureRef} className="min-w-0 overflow-visible">
              {!isEditing ? (
                <h2
                  className="font-serif italic text-stone-900 dark:text-stone-100 leading-tight cursor-text hover:bg-stone-50 dark:hover:bg-stone-800 rounded px-1 -mx-1 py-0.5 transition-colors whitespace-pre-wrap wrap-break-word"
                  style={{ fontSize: "var(--slide-title)" }}
                  onClick={() => {
                    setActiveBlock("title");
                    setIsEditing(true);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setActiveBlock("title");
                      setIsEditing(true);
                    }
                  }}
                  title="Clic para editar el título"
                >
                  {currentSlide.title || "Sin título"}
                </h2>
              ) : activeBlock === "title" ? (
                <CanvaSelectionFrame
                  showChrome
                  widthPercent={titleW}
                  minHeightPx={titleH}
                  measureElRef={titleMeasureRef}
                  onResizePointerDown={onResizePointerDown}
                  onResize={({ widthPercent, minHeightPx }) =>
                    patchEditorFrame("title", widthPercent, minHeightPx)
                  }
                >
                  <textarea
                    ref={titleTextareaRef}
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={scheduleCommitAfterBlur}
                    onFocus={() => {
                      cancelScheduledCommit();
                      setActiveBlock("title");
                    }}
                    {...{ [EDIT_FIELD_ATTR]: "true" }}
                    rows={1}
                    className="font-serif italic text-stone-900 dark:text-foreground leading-tight bg-transparent border-0 shadow-none focus:outline-none focus:ring-0 w-full rounded-md px-2 py-1 resize-none overflow-hidden whitespace-pre-wrap wrap-break-word"
                    style={{ fontSize: "var(--slide-title)" }}
                  />
                </CanvaSelectionFrame>
              ) : (
                <CanvaSelectionFrame
                  showChrome={false}
                  widthPercent={titleW}
                  minHeightPx={titleH}
                  measureElRef={titleMeasureRef}
                >
                  <h2
                    className="font-serif italic text-stone-900 dark:text-stone-100 leading-tight cursor-text rounded-md px-2 py-1 hover:bg-stone-50 dark:hover:bg-stone-800 whitespace-pre-wrap wrap-break-word min-h-10"
                    style={{ fontSize: "var(--slide-title)" }}
                    onPointerDown={() => cancelScheduledCommit()}
                    onClick={() => setActiveBlock("title")}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") setActiveBlock("title");
                    }}
                    title="Clic para editar el título"
                  >
                    {editTitle.trim() || "Sin título"}
                  </h2>
                </CanvaSelectionFrame>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0 self-start">
            {!isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="p-1.5 rounded-md transition-colors text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700 hover:text-emerald-600 dark:hover:text-emerald-400"
                title="Editar texto de la diapositiva"
              >
                <Pencil size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setGenerateSlideContentPrompt("");
                setShowGenerateSlideContentModal(true);
              }}
              className="p-1.5 rounded-md text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
              title="Generar contenido de esta diapositiva con IA"
            >
              <Sparkles size={16} />
            </button>
            <button
              type="button"
              onClick={() => setShowRewriteModal(true)}
              className="p-1.5 rounded-md text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
              title="Replantear"
            >
              <RefreshCw size={16} />
            </button>
            <button
              type="button"
              onClick={() => setShowSplitModal(true)}
              className="p-1.5 rounded-md text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
              title="Dividir"
            >
              <Split size={16} />
            </button>
          </div>
        </div>
        <div
          ref={contentMeasureRef}
          className={cn(
            "flex-1 min-h-[120px] pr-4 flex flex-col min-w-0 overflow-visible",
            (!isEditing || activeBlock !== "content") &&
              "overflow-y-auto custom-scrollbar",
            isEditing && activeBlock === "content" && "pb-12",
          )}
        >
          {!isEditing ? (
            <div
              className="min-h-[80px] cursor-text rounded-lg hover:bg-stone-50/80 dark:hover:bg-stone-800/80 transition-colors -m-1 p-1"
              onClick={() => {
                setActiveBlock("content");
                setIsEditing(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setActiveBlock("content");
                  setIsEditing(true);
                }
              }}
              role="button"
              tabIndex={0}
              title="Clic para editar el contenido"
            >
              {currentSlide.content?.trim() ? (
                <SlideMarkdown>{formatMarkdown(currentSlide.content)}</SlideMarkdown>
              ) : (
                <p className="text-stone-400 dark:text-stone-500 italic p-2">
                  Clic para escribir el contenido…
                </p>
              )}
            </div>
          ) : activeBlock === "content" ? (
            <CanvaSelectionFrame
              className="flex min-h-0 flex-1 flex-col"
              innerClassName="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
              showChrome
              widthPercent={contentW}
              minHeightPx={contentH}
              measureElRef={contentMeasureRef}
              onResizePointerDown={onResizePointerDown}
              onResize={({ widthPercent, minHeightPx }) =>
                patchEditorFrame("content", widthPercent, minHeightPx)
              }
              floatingActions={
                <button
                  type="button"
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-lg transition-colors",
                    "bg-stone-900 text-white hover:bg-stone-800",
                    "dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white",
                    "border border-stone-700/30 dark:border-stone-300/40",
                  )}
                  title="Replantear contenido con IA"
                  aria-label="Replantear contenido con IA"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    cancelScheduledCommit();
                  }}
                  onClick={() => setShowRewriteModal(true)}
                >
                  <Wand2 size={18} strokeWidth={2} />
                </button>
              }
            >
              <div className="flex min-h-0 flex-1 flex-col px-4 py-3">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onBlur={scheduleCommitAfterBlur}
                  onFocus={() => {
                    cancelScheduledCommit();
                    setActiveBlock("content");
                  }}
                  {...{ [EDIT_FIELD_ATTR]: "true" }}
                  placeholder="Escribe el contenido de la diapositiva (markdown)..."
                  className="box-border min-h-0 w-full flex-1 resize-none overflow-y-auto rounded-lg border-0 bg-transparent font-sans text-lg leading-relaxed text-stone-900 shadow-none placeholder:text-stone-400 focus:outline-none focus:ring-0 dark:text-foreground dark:placeholder:text-stone-500"
                />
              </div>
            </CanvaSelectionFrame>
          ) : (
            <div
              className="min-h-[80px] cursor-text rounded-lg hover:bg-stone-50/80 dark:hover:bg-stone-800/80 transition-colors -m-1 p-1"
              onPointerDown={() => cancelScheduledCommit()}
              onClick={() => setActiveBlock("content")}
              onKeyDown={(e) => {
                if (e.key === "Enter") setActiveBlock("content");
              }}
              role="button"
              tabIndex={0}
              title="Clic para editar el contenido"
            >
              {editContent.trim() ? (
                <SlideMarkdown>{formatMarkdown(editContent)}</SlideMarkdown>
              ) : (
                <p className="text-stone-400 dark:text-stone-500 italic p-2">
                  Clic para escribir el contenido…
                </p>
              )}
            </div>
          )}
        </div>
      </div>
      {(currentSlide.contentLayout ?? "split") === "split" && <SlideRightPanel />}
    </div>
  );
}
