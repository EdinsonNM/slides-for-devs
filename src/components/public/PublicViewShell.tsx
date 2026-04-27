import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Home,
  Maximize2,
  BookText,
  X,
  PanelLeftOpen,
  ChevronLeft,
  ChevronRight,
  StickyNote,
} from "lucide-react";
import type { PulledPresentation } from "../../services/presentationCloud";
import { SLIDE_TYPE } from "../../domain/entities";
import { normalizeDeckVisualTheme, type DeckVisualTheme } from "../../domain/entities";
import { useAppApiConfig } from "@/presentation/app/ApiConfigContext";
import { usePublicPreviewDeck } from "@/presentation/contexts/PublicPreviewDeckContext";
import { useThemeOptional } from "@/presentation/contexts/ThemeContext";
import { PreviewSlideContent } from "../preview/PreviewSlideContent";
import { IconButton } from "../shared/IconButton";
import { RailTooltip } from "../shared/RailTooltip";
import { AvatarMenu } from "../shared/AvatarMenu";
import { cn } from "../../utils/cn";
import { SidebarSlideCanvasMiniPreview } from "../layout/SidebarSlideCanvasMiniPreview";
import { DEFAULT_IMAGE_WIDTH_PERCENT, DEFAULT_PANEL_HEIGHT_PERCENT } from "@/presentation/state/presentationConstants";
import { ensureSlideCanvasScene } from "../../domain/slideCanvas/ensureSlideCanvasScene";
import { SlideMarkdown } from "../shared/SlideMarkdown";

const SIDEBAR_WIDTH = 256;

const railIconBtnClass =
  "flex size-full min-h-9 min-w-9 items-center justify-center rounded-lg text-foreground/90 outline-none hover:bg-stone-100 dark:hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-40";

/** Misma cápsula que `EditorFloatingToolbar` (`barClass`). */
const floatingBarClass =
  "pointer-events-auto flex items-center gap-0.5 rounded-xl border border-stone-200/90 bg-white px-1.5 py-1.5 shadow-md shadow-stone-900/8 dark:border-border dark:bg-surface-elevated dark:shadow-lg dark:shadow-black/40";

export function PublicViewShell({ deck }: { deck: PulledPresentation }) {
  const navigate = useNavigate();
  const { openApiConfigFromSettings } = useAppApiConfig();
  const {
    registerDeck,
    isPreviewOpen,
    previewIndex,
    openPreview,
  } = usePublicPreviewDeck();
  const [index, setIndex] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isReadmePanelOpen, setIsReadmePanelOpen] = useState(false);
  const theme = useThemeOptional();
  const importedGithubScheme = useMemo((): "light" | "dark" => {
    if (theme?.isDark) return "dark";
    if (
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark")
    ) {
      return "dark";
    }
    return "light";
  }, [theme?.isDark, theme?.effectiveTheme]);
  const prevPreviewOpenRef = useRef(false);

  useEffect(() => {
    registerDeck(deck);
  }, [deck, registerDeck]);

  useEffect(() => {
    if (prevPreviewOpenRef.current && !isPreviewOpen) {
      setIndex(previewIndex);
    }
    prevPreviewOpenRef.current = isPreviewOpen;
  }, [isPreviewOpen, previewIndex]);

  const total = deck.slides.length;
  const currentSlide = deck.slides[index];
  const deckTheme = useMemo<DeckVisualTheme>(
    () => normalizeDeckVisualTheme(deck.deckVisualTheme),
    [deck.deckVisualTheme],
  );
  const topicLabel = useMemo(
    () => (deck.topic?.trim() || "Presentación pública") as string,
    [deck.topic],
  );
  const readmeMd = (deck.presentationReadme ?? "").trim();
  const hasReadme = readmeMd.length > 0;
  const thumbImageWidth = currentSlide?.imageWidthPercent ?? DEFAULT_IMAGE_WIDTH_PERCENT;
  const thumbPanelH =
    currentSlide?.type === "content" || !currentSlide?.type
      ? (currentSlide?.panelHeightPercent ?? DEFAULT_PANEL_HEIGHT_PERCENT)
      : DEFAULT_PANEL_HEIGHT_PERCENT;

  const goNextSlide = useCallback(() => {
    setIndex((i) => (total > 0 ? Math.min(total - 1, i + 1) : 0));
  }, [total]);

  const goPrevSlide = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  useEffect(() => {
    if (!isReadmePanelOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsReadmePanelOpen(false);
      }
    };
    document.addEventListener("keydown", onEsc, true);
    return () => {
      document.removeEventListener("keydown", onEsc, true);
    };
  }, [isReadmePanelOpen]);

  useEffect(() => {
    if (isPreviewOpen || isReadmePanelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        goNextSlide();
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goPrevSlide();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [goNextSlide, goPrevSlide, isPreviewOpen, isReadmePanelOpen]);

  if (total === 0) return null;
  if (!isReadmePanelOpen && !currentSlide) return null;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-white text-foreground font-sans dark:bg-background">
      <div className="flex min-h-0 min-w-0 flex-1">
        <aside
          className="z-20 flex w-16 shrink-0 flex-col items-center gap-1.5 border-r border-stone-200/90 bg-white px-2 py-2 dark:border-border dark:bg-surface-elevated"
          aria-label="Navegación pública (solo consulta)"
        >
          <RailTooltip label="Inicio" detail="Volver a la galería">
            <button
              type="button"
              className={railIconBtnClass}
              aria-label="Volver a la galería"
              onClick={() => {
                void navigate("/home");
              }}
            >
              <Home size={20} strokeWidth={1.75} />
            </button>
          </RailTooltip>
          <div
            className="flex w-full flex-col items-center gap-1 border-t border-stone-200/80 pt-1.5 dark:border-stone-600/60"
            role="toolbar"
            aria-label="Documentación de la publicación"
          >
            <RailTooltip
              label="README de la presentación"
              detail={
                hasReadme
                  ? "Documentación en Markdown (objetivo, público, enlaces…)"
                  : "No hay README publicado"
              }
            >
              <button
                type="button"
                className={cn(
                  railIconBtnClass,
                  isReadmePanelOpen && "bg-stone-200/60 dark:bg-white/10",
                )}
                aria-label="README de la presentación"
                aria-pressed={isReadmePanelOpen}
                onClick={() => {
                  setIsReadmePanelOpen(true);
                }}
              >
                <BookText size={18} strokeWidth={2} />
              </button>
            </RailTooltip>
          </div>
        </aside>

        <div className="flex flex-1 min-w-0 min-h-0 flex-col">
          <header
            className="flex h-9 shrink-0 items-stretch border-b border-stone-200/90 bg-white dark:border-border dark:bg-surface-elevated"
            role="banner"
          >
            <div className="flex min-w-0 flex-1 items-center gap-2 border-r border-stone-200/90 bg-stone-50/40 px-2 dark:border-border dark:bg-background/40 sm:gap-2.5 sm:pl-3.5 sm:pr-2">
              <p className="line-clamp-1 min-w-0 flex-1 text-left text-xs font-semibold leading-tight text-foreground/90 sm:text-[13px]">
                {topicLabel}
              </p>
            </div>
            <div className="flex min-w-0 items-stretch border-l border-stone-200/90 bg-linear-to-b from-stone-100/50 to-stone-50/40 dark:border-border/90 dark:from-stone-800/30 dark:to-stone-900/20">
              <div className="flex h-full items-center pr-1.5 pl-2.5 sm:pl-3 sm:pr-2.5">
                <AvatarMenu
                  onOpenConfig={openApiConfigFromSettings}
                  variant="editor"
                  className="h-full"
                />
              </div>
            </div>
          </header>

          <div className="flex min-h-0 min-w-0 flex-1">
            {isSidebarOpen ? (
              <aside
                className="hidden shrink-0 flex-col overflow-y-auto border-r border-stone-200/90 bg-white text-foreground md:flex dark:border-border dark:bg-surface-elevated"
                style={{ width: SIDEBAR_WIDTH }}
              >
                <div className="flex shrink-0 items-center justify-between border-b border-stone-100 p-2 dark:border-border">
                  <span className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Diapositivas
                  </span>
                  <IconButton
                    variant="default"
                    icon={<ChevronLeft size={16} />}
                    aria-label="Ocultar listado"
                    title="Ocultar listado"
                    onClick={() => setIsSidebarOpen(false)}
                    className="border-transparent p-1.5 text-muted-foreground hover:bg-stone-100 hover:text-foreground dark:hover:bg-white/10"
                  />
                </div>
                <div className="space-y-2 p-2">
                  {deck.slides.map((slide, slideIndex) => {
                    const selected = slideIndex === index;
                    const ensured = ensureSlideCanvasScene(slide);
                    const hasCanvas = (ensured.canvasScene?.elements?.length ?? 0) > 0;
                    return (
                        <button
                          key={slide.id}
                          type="button"
                          onClick={() => {
                            setIndex(slideIndex);
                          }}
                          aria-current={selected ? "true" : undefined}
                          className={cn(
                            "w-full min-w-0 max-w-full overflow-hidden rounded-r-md text-left focus-visible:ring-2 focus-visible:ring-primary/50",
                            selected
                              ? "ring-2 ring-primary ring-offset-0 shadow-md shadow-primary/20 dark:shadow-primary/30"
                              : "border border-border/80 hover:border-stone-300 dark:hover:border-stone-500",
                            "bg-white dark:bg-surface-elevated",
                          )}
                        >
                          <div className="relative aspect-video w-full min-h-0 max-w-full p-1.5">
                            <div className="text-[8px] uppercase tracking-widest text-muted-foreground/90">
                              {slideIndex + 1}
                            </div>
                            {slide.type === SLIDE_TYPE.CHAPTER ? (
                              <div className="flex h-[calc(100%-1.25rem)] w-full min-h-0 items-center justify-center text-center text-[9px] font-medium leading-tight text-foreground line-clamp-3">
                                {slide.title || "Sección"}
                              </div>
                            ) : hasCanvas ? (
                              <div className="h-[calc(100%-1.25rem)] min-h-0 w-full">
                                <SidebarSlideCanvasMiniPreview slide={slide} />
                              </div>
                            ) : (
                              <div className="flex h-[calc(100%-1.25rem)] w-full min-h-0 items-center justify-center text-[9px] text-muted-foreground line-clamp-2">
                                {slide.title || "—"}
                              </div>
                            )}
                          </div>
                        </button>
                    );
                  })}
                </div>
              </aside>
            ) : (
              <aside className="hidden w-12 shrink-0 flex-col items-center border-r border-stone-200/90 bg-white py-3 md:flex dark:border-border dark:bg-surface-elevated">
                <IconButton
                  variant="default"
                  icon={<PanelLeftOpen size={20} />}
                  aria-label="Mostrar diapositivas"
                  title="Mostrar diapositivas"
                  onClick={() => setIsSidebarOpen(true)}
                  className="border-transparent text-muted-foreground hover:bg-stone-100 dark:hover:bg-white/10"
                />
              </aside>
            )}

            <section
              className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-stone-200/50 p-3 md:p-4 lg:p-6 dark:bg-stone-900/60"
              aria-label={
                isReadmePanelOpen
                  ? "README de la publicación (solo consulta)"
                  : "Lienzo de diapositiva (solo consulta)"
              }
            >
              {isReadmePanelOpen ? (
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-stone-200/80 bg-white shadow-sm dark:border-border dark:bg-surface-elevated">
                  <header className="flex shrink-0 items-center justify-between gap-2 rounded-t-[inherit] border-b border-stone-200/80 bg-stone-50/90 px-3 py-2 dark:border-border dark:bg-surface-elevated">
                    <div className="flex min-w-0 items-center gap-2 text-stone-800 dark:text-foreground">
                      <BookText
                        size={18}
                        className="shrink-0 text-emerald-600 dark:text-emerald-400"
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <h1 className="truncate text-sm font-semibold tracking-tight">
                          README de la presentación
                        </h1>
                        <p className="truncate text-[11px] text-muted-foreground">
                          Contenido publicado con el deck (solo consulta)
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsReadmePanelOpen(false);
                      }}
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium",
                        "text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-white/10",
                      )}
                      aria-label="Cerrar README y volver al lienzo"
                    >
                      <X size={16} aria-hidden />
                      Cerrar
                    </button>
                  </header>
                  <div className="min-h-0 flex-1 overflow-y-auto bg-stone-100/50 px-1 pb-1 pt-0 sm:px-2 sm:pb-2 dark:bg-stone-800/25">
                    {hasReadme ? (
                      <SlideMarkdown
                        contentTone={deckTheme.contentTone}
                        preprocess="importedFile"
                        importedGithubScheme={importedGithubScheme}
                        className="px-2 py-2 sm:px-3"
                      >
                        {readmeMd}
                      </SlideMarkdown>
                    ) : (
                      <p className="px-2 py-3 text-sm leading-relaxed text-muted-foreground sm:px-3">
                        No hay README publicado para esta presentación.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="slide-editor-canvas-wrap flex min-h-0 w-full flex-1 flex-col">
                    <div className="slide-editor-stage flex min-h-0 flex-1 flex-col items-center justify-center pb-16">
                      <div className="flex w-[min(100cqw,calc((100cqh-2.75rem)*16/9))] min-h-0 max-w-full shrink-0 flex-col">
                        <PreviewSlideContent
                          key={currentSlide.id}
                          slide={currentSlide}
                          slideIndex={index}
                          layout="default"
                          imageWidthPercent={thumbImageWidth}
                          panelHeightPercent={thumbPanelH}
                          deckVisualTheme={deckTheme}
                          disableEntryMotion
                        />
                      </div>
                    </div>
                  </div>

                  <div
                    className="pointer-events-none absolute inset-x-0 bottom-5 z-30 flex justify-center px-4"
                    aria-label="Navegación y presentación (solo consulta)"
                  >
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <div
                        className={floatingBarClass}
                        role="toolbar"
                        aria-label="Cambiar diapositiva"
                      >
                        <button
                          type="button"
                          onClick={goPrevSlide}
                          disabled={index === 0}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-35 dark:hover:bg-white/10"
                          aria-label="Diapositiva anterior"
                        >
                          <ChevronLeft size={20} />
                        </button>
                        <div className="min-w-18 px-2 text-center text-[12px] font-medium tabular-nums text-muted-foreground">
                          {index + 1} / {total}
                        </div>
                        <button
                          type="button"
                          onClick={goNextSlide}
                          disabled={index === total - 1}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-35 dark:hover:bg-white/10"
                          aria-label="Diapositiva siguiente"
                        >
                          <ChevronRight size={20} />
                        </button>
                      </div>

                      <div className={cn(floatingBarClass, "gap-1")}>
                        <button
                          type="button"
                          onClick={() => {
                            openPreview(index);
                          }}
                          className="flex h-9 items-center gap-1.5 rounded-lg border border-stone-200/90 bg-transparent px-3 text-[13px] font-medium text-foreground outline-none hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-primary dark:border-border dark:hover:bg-white/8"
                          title="Vista previa a pantalla completa (como en el editor)"
                        >
                          <Maximize2 size={16} aria-hidden />
                          Presentar
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </section>

            <aside
              className="hidden w-[min(100%,360px)] shrink-0 border-l border-stone-200/90 bg-stone-50/40 lg:flex lg:max-w-[min(100%,400px)] dark:border-border dark:bg-surface-elevated/40"
              aria-label="Notas del presentador (solo consulta)"
            >
              <div className="flex w-full min-w-0 flex-col">
                <div className="flex items-center gap-1.5 border-b border-stone-200/90 bg-white px-3 py-2 dark:border-border dark:bg-surface-elevated">
                  <StickyNote
                    className="size-4 text-muted-foreground"
                    strokeWidth={2}
                    aria-hidden
                  />
                  <h2 className="text-xs font-semibold text-foreground/90">Notas</h2>
                </div>
                <div className="min-h-0 flex-1 overflow-auto p-3 text-sm text-stone-700 dark:text-stone-200/95">
                  {(() => {
                    const n = (
                      currentSlide.presenterNotes ||
                      (currentSlide as { speech?: string | undefined }).speech
                    )?.trim();
                    return n ? (
                      <p className="min-h-[120px] whitespace-pre-wrap leading-relaxed">{n}</p>
                    ) : (
                      <p className="min-h-[120px] text-muted-foreground">— Sin notas en esta diapositiva —</p>
                    );
                  })()}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
