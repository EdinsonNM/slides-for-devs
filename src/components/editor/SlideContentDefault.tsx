import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  Split,
  Sparkles,
  Video,
} from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { resolveMediaPanelDescriptor } from "../../domain/panelContent";
import { ensureSlideCanvasScene } from "../../domain/slideCanvas/ensureSlideCanvasScene";
import {
  compareCanvasElementsByZThenId,
  getCanvasMarkdownBodyDisplay,
} from "../../domain/slideCanvas/slideCanvasPayload";
import { isSlideCanvasTextPayload } from "../../domain/entities/SlideCanvas";
import { plainTextFromRichHtml } from "../../utils/slideRichText";
import { cn } from "../../utils/cn";
import { SlideMarkdown } from "../shared/SlideMarkdown";
import {
  SlideCanvasRichDescription,
  type SlideCanvasRichDescriptionHandle,
} from "../canvas/SlideCanvasRichDescription";
import {
  slideCanvasToolbarIconBtnClass,
  slideCanvasToolbarPillRowClass,
} from "../canvas/slideCanvasToolbarStyles";
import { SlideRightPanel } from "./SlideRightPanel";
import { CanvaSelectionFrame } from "./CanvaSelectionFrame";

const EDIT_FIELD_ATTR = "data-slide-edit-field";

type EditBlock = "title" | "subtitle" | "content";

export function SlideContentDefault() {
  const {
    currentSlide,
    currentIndex,
    isEditing,
    setIsEditing,
    editTitle,
    setEditTitle,
    editSubtitle,
    setEditSubtitle,
    editContent,
    setEditContent,
    applyEditContentRichDraft,
    commitSlideEdits,
    setSlides,
    setShowRewriteModal,
    setShowGenerateSlideContentModal,
    setGenerateSlideContentPrompt,
    setShowSplitModal,
    panelHeightPercent,
    isResizingPanelHeight,
    setIsResizingPanelHeight,
    openVideoModal,
    deckVisualTheme,
    editContentRichHtml,
    setEditContentRichHtml,
    editContentBodyFontScale,
    setEditContentBodyFontScale,
    formatMarkdown,
  } = usePresentation();

  const deckContentTone = deckVisualTheme.contentTone;

  const canvasMarkdownDescription = useMemo(() => {
    if (!currentSlide) return null;
    const s = ensureSlideCanvasScene(currentSlide);
    const sorted = [...(s.canvasScene?.elements ?? [])].sort(
      compareCanvasElementsByZThenId,
    );
    const el = sorted.find((e) => e.kind === "markdown");
    if (!el) return null;
    return { el, display: getCanvasMarkdownBodyDisplay(s, el) };
  }, [currentSlide]);

  const canvasDescriptionReadNode = useMemo(() => {
    if (!canvasMarkdownDescription) return undefined;
    const { el, display } = canvasMarkdownDescription;
    const empty =
      display.kind === "html"
        ? !plainTextFromRichHtml(display.html).trim()
        : !display.source.trim();
    if (empty) return null;
    const viewFontScale =
      display.kind === "html"
        ? display.scale
        : Math.min(
            2.5,
            Math.max(
              0.5,
              isSlideCanvasTextPayload(el.payload)
                ? (el.payload.bodyFontScale ?? 1)
                : 1,
            ),
          );
    return (
      <SlideCanvasRichDescription
        elementId={el.id}
        tone={deckContentTone}
        display={display}
        isEditing={false}
        plainBuffer={editContent}
        richHtmlBuffer={editContentRichHtml}
        fontScale={viewFontScale}
        onPlainAndRichChange={() => {}}
        onBlurCommit={() => {}}
      />
    );
  }, [
    canvasMarkdownDescription,
    deckContentTone,
    editContent,
    editContentRichHtml,
  ]);

  const [activeBlock, setActiveBlock] = useState<EditBlock | null>(null);
  const markdownPanelRichRef = useRef<SlideCanvasRichDescriptionHandle>(null);
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

  const showPanelVideoToolbarBtn = resolveMediaPanelDescriptor(
    currentSlide,
  ).showSlideContentVideoToolbar();

  const isPanelFull = currentSlide.contentLayout === "panel-full";

  const titleW = currentSlide.editorTitleWidthPercent ?? 100;
  const titleH =
    currentSlide.editorTitleMinHeightPx != null
      ? currentSlide.editorTitleMinHeightPx
      : undefined;
  const contentW = currentSlide.editorContentWidthPercent ?? 100;
  const contentH = currentSlide.editorContentMinHeightPx ?? 120;

  const iaToolbarBtnClass =
    "p-1.5 rounded-md text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors";

  if (isPanelFull) {
    const titleHeightPercent = 100 - panelHeightPercent;
    return (
      <>
        <div
          className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0 h-full relative"
          onPointerDownCapture={clearActiveBlockOnSurfacePointerDown}
        >
          <div className="flex shrink-0 items-center gap-1 self-start px-4 pt-4 md:px-7 md:pt-5 lg:px-8 lg:pt-6">
            <button
              type="button"
              onClick={() => {
                setGenerateSlideContentPrompt("");
                setShowGenerateSlideContentModal(true);
              }}
              className={cn(iaToolbarBtnClass, "hover:text-emerald-600 dark:hover:text-emerald-400")}
              title="Generar contenido de esta diapositiva con IA"
            >
              <Sparkles size={16} />
            </button>
            <button
              type="button"
              onClick={() => setShowSplitModal(true)}
              className={cn(iaToolbarBtnClass, "hover:text-amber-600 dark:hover:text-amber-400")}
              title="Dividir"
            >
              <Split size={16} />
            </button>
            {showPanelVideoToolbarBtn ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    openVideoModal({
                      initialVideoUrl: currentSlide.videoUrl || "",
                    });
                  }}
                  className={cn(iaToolbarBtnClass, "hover:text-sky-600 dark:hover:text-sky-400")}
                  title={
                    currentSlide.videoUrl?.trim()
                      ? "Cambiar vídeo"
                      : "Añadir vídeo (YouTube, Vimeo o URL directa)"
                  }
                  aria-label={
                    currentSlide.videoUrl?.trim()
                      ? "Cambiar vídeo del panel"
                      : "Añadir vídeo al panel"
                  }
                >
                  <Video size={16} />
                </button>
              </>
            ) : null}
          </div>
          <div
            className="px-4 pt-2 pb-3 border-stone-100 dark:border-border flex items-start justify-between gap-3 overflow-visible md:px-7 md:pt-3 md:pb-4 md:gap-4 lg:px-8 lg:pt-4"
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
                        resizeMaxWidthPercent={280}
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
                      <textarea
                        value={editSubtitle}
                        onChange={(e) => setEditSubtitle(e.target.value)}
                        onBlur={scheduleCommitAfterBlur}
                        onFocus={() => {
                          cancelScheduledCommit();
                          setActiveBlock("subtitle");
                        }}
                        {...{ [EDIT_FIELD_ATTR]: "true" }}
                        placeholder="Subtítulo o descripción (markdown, opcional)"
                        rows={3}
                        className="box-border min-h-18 w-full resize-y rounded-md border-0 bg-transparent px-2 py-1 text-sm text-stone-500 shadow-none focus:outline-none focus:ring-0 dark:text-stone-400 whitespace-pre-wrap wrap-break-word"
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
                      {editSubtitle.trim() ? (
                        <SlideMarkdown className="prose-sm max-w-none dark:prose-invert">
                          {editSubtitle}
                        </SlideMarkdown>
                      ) : (
                        "Clic para subtítulo (opcional)"
                      )}
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
                    <div
                      className="cursor-text text-sm text-stone-500 transition-colors hover:bg-stone-50 dark:text-stone-300 dark:hover:bg-stone-800 rounded px-1 -mx-1 py-0.5"
                      onClick={() => {
                        setActiveBlock("subtitle");
                        setIsEditing(true);
                      }}
                      role="button"
                      tabIndex={0}
                      title="Clic para editar subtítulo"
                    >
                      <SlideMarkdown className="prose-sm max-w-none dark:prose-invert">
                        {currentSlide.subtitle}
                      </SlideMarkdown>
                    </div>
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
      <div className="flex-1 p-5 flex flex-col overflow-x-visible overflow-y-hidden min-h-0 md:p-7 lg:p-9 xl:p-11 2xl:p-12">
        <div className="mb-3 flex shrink-0 items-center gap-1 self-start md:mb-4">
          <button
            type="button"
            onClick={() => {
              setGenerateSlideContentPrompt("");
              setShowGenerateSlideContentModal(true);
            }}
            className={cn(iaToolbarBtnClass, "hover:text-emerald-600 dark:hover:text-emerald-400")}
            title="Generar contenido de esta diapositiva con IA"
          >
            <Sparkles size={16} />
          </button>
          <button
            type="button"
            onClick={() => setShowSplitModal(true)}
            className={cn(iaToolbarBtnClass, "hover:text-amber-600 dark:hover:text-amber-400")}
            title="Dividir"
          >
            <Split size={16} />
          </button>
          {showPanelVideoToolbarBtn ? (
            <>
              <button
                type="button"
                onClick={() => {
                  openVideoModal({
                    initialVideoUrl: currentSlide.videoUrl || "",
                  });
                }}
                className={cn(iaToolbarBtnClass, "hover:text-sky-600 dark:hover:text-sky-400")}
                title={
                  currentSlide.videoUrl?.trim()
                    ? "Cambiar vídeo"
                    : "Añadir vídeo (YouTube, Vimeo o URL directa)"
                }
                aria-label={
                  currentSlide.videoUrl?.trim()
                    ? "Cambiar vídeo del panel"
                    : "Añadir vídeo al panel"
                }
              >
                <Video size={16} />
              </button>
            </>
          ) : null}
        </div>
        <div className="mb-4 shrink-0 flex items-start justify-between gap-3 overflow-visible md:mb-6 lg:mb-8 md:gap-4">
          <div className="min-w-0 flex-1 flex flex-col overflow-visible">
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
                  resizeMaxWidthPercent={280}
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
          <div className="flex shrink-0 items-center gap-1 self-start">
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
              {canvasMarkdownDescription ? (
                canvasDescriptionReadNode ?? (
                  <p className="text-stone-400 dark:text-stone-500 italic p-2">
                    Clic para escribir el contenido…
                  </p>
                )
              ) : currentSlide.content?.trim() ? (
                <SlideMarkdown>{currentSlide.content}</SlideMarkdown>
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
              resizeMaxWidthPercent={280}
              onResizePointerDown={onResizePointerDown}
              onResize={({ widthPercent, minHeightPx }) =>
                patchEditorFrame("content", widthPercent, minHeightPx)
              }
              floatingActionsPlacement="bottom-left"
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
                  <RefreshCw size={18} strokeWidth={2} />
                </button>
              }
            >
              <div className="flex min-h-0 flex-1 flex-col px-4 py-3">
                {canvasMarkdownDescription ? (
                  <div
                    className="flex min-h-0 flex-1 flex-col"
                    onFocusCapture={() => {
                      cancelScheduledCommit();
                      setActiveBlock("content");
                    }}
                  >
                    <div className="mb-2 flex shrink-0 justify-center">
                      <div className={slideCanvasToolbarPillRowClass}>
                        <button
                          type="button"
                          className={slideCanvasToolbarIconBtnClass}
                          title="Reducir tamaño del bloque"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setEditContentBodyFontScale((s) =>
                              Math.max(0.5, Number((s / 1.08).toFixed(3))),
                            );
                            commitSlideEdits({ keepEditing: true });
                          }}
                        >
                          <Minus size={16} strokeWidth={2} />
                        </button>
                        <span className="min-w-[2.25rem] shrink-0 text-center text-[10px] font-semibold tabular-nums text-stone-500 dark:text-stone-400">
                          {Math.round(editContentBodyFontScale * 100)}%
                        </span>
                        <button
                          type="button"
                          className={slideCanvasToolbarIconBtnClass}
                          title="Aumentar tamaño del bloque"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setEditContentBodyFontScale((s) =>
                              Math.min(2.5, Number((s * 1.08).toFixed(3))),
                            );
                            commitSlideEdits({ keepEditing: true });
                          }}
                        >
                          <Plus size={16} strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                    <SlideCanvasRichDescription
                      ref={markdownPanelRichRef}
                      elementId={canvasMarkdownDescription.el.id}
                      tone={deckContentTone}
                      display={canvasMarkdownDescription.display}
                      isEditing
                      plainBuffer={editContent}
                      richHtmlBuffer={editContentRichHtml}
                      fontScale={editContentBodyFontScale}
                      onPlainAndRichChange={(plain, rich) => {
                        applyEditContentRichDraft(plain, rich);
                      }}
                      onBlurCommit={() => {
                        scheduleCommitAfterBlur();
                      }}
                    />
                  </div>
                ) : (
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
                )}
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
              {canvasMarkdownDescription ? (
                canvasDescriptionReadNode ?? (
                  <p className="text-stone-400 dark:text-stone-500 italic p-2">
                    Clic para escribir el contenido…
                  </p>
                )
              ) : editContent.trim() ? (
                <SlideMarkdown>{editContent}</SlideMarkdown>
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
