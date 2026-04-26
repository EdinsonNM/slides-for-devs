import { useState, useRef, useEffect } from "react";
import { flushSync } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  FolderOpen,
  LayoutTemplate,
  Maximize2,
  Save,
  Loader2,
  Mic,
  StickyNote,
  BookText,
  UserPlus,
  FileDown,
  Image as ImageIcon,
  Sparkles,
  MoreHorizontal,
  Clapperboard,
} from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";
import { IconButton } from "../shared/IconButton";
import { AvatarMenu } from "../shared/AvatarMenu";
import { HeaderToolbarGroup } from "./HeaderToolbarGroup";
import { exportPresentationToPowerPoint } from "../../services/exportToPowerPoint";
import { exportCurrentSlideAsImage } from "../../services/exportSlideAsImage";

interface HeaderProps {
  onOpenConfig?: () => void;
}

const panelActiveClass =
  "bg-stone-200/90 dark:bg-stone-600/50 text-stone-900 dark:text-stone-100";

export function Header(props: HeaderProps) {
  const { onOpenConfig } = props;
  const navigate = useNavigate();
  const {
    topic,
    setTopic,
    setPresentationTitleDraft,
    goHome,
    openSavedListModal,
    slides,
    currentIndex,
    deckVisualTheme,
    handleSave,
    isSaving,
    saveMessage,
    isCurrentPresentationReadOnly,
    currentSavedId,
    setIsPreviewMode,
    flushDiagramPending,
    flushIsometricFlowPending,
    setShowSpeechModal,
    isNotesPanelOpen,
    setIsNotesPanelOpen,
    isReadmePanelOpen,
    setIsReadmePanelOpen,
    setIsPresentationSettingsPanelOpen,
    showCharactersPanel,
    setShowCharactersPanel,
    showSlideStylePanel,
    setShowSlideStylePanel,
    openGenerateFullDeckModal,
    openExportDeckVideoModal,
    captureWorkspaceSnapshot,
  } = usePresentation();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState(topic || "");
  const [isExportingPptx, setIsExportingPptx] = useState(false);
  const [pptxExportHint, setPptxExportHint] = useState<string | null>(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const [isExportingSlideImage, setIsExportingSlideImage] = useState(false);

  const handleExportSlideAsImage = async () => {
    const currentSlide = slides[currentIndex];
    if (!currentSlide) return;
    setIsExportingSlideImage(true);
    setMoreMenuOpen(false);
    try {
      const snap = flushSync(() => captureWorkspaceSnapshot());
      const slide = snap.slides[snap.currentIndex];
      if (!slide) throw new Error("No se encontró la diapositiva actual.");
      await exportCurrentSlideAsImage(
        slide,
        snap.currentIndex,
        snap.deckVisualTheme,
      );
    } catch (e) {
      console.error(e);
      alert(
        e instanceof Error
          ? e.message
          : "Error al exportar la diapositiva como imagen.",
      );
    } finally {
      setIsExportingSlideImage(false);
    }
  };

  const handleExportPowerPoint = async () => {
    if (slides.length === 0) return;
    setIsExportingPptx(true);
    setPptxExportHint("Preparando exportación…");
    setMoreMenuOpen(false);
    try {
      const snap = flushSync(() => captureWorkspaceSnapshot());
      await exportPresentationToPowerPoint(
        {
          topic: snap.topic || "Presentación",
          slides: snap.slides,
          deckVisualTheme: snap.deckVisualTheme,
        },
        undefined,
        {
          onExportProgress: (info) => {
            flushSync(() => {
              if (info.phase === "capture_start") {
                setPptxExportHint(
                  `Capturando diapositiva ${info.slideIndex + 1} de ${info.totalSlides}…`,
                );
              } else if (info.phase === "pptx_packaging") {
                setPptxExportHint(
                  "Generando archivo PowerPoint (muchas imágenes pueden tardar varios minutos)…",
                );
              }
            });
          },
        },
      );
    } catch (e) {
      console.error(e);
      alert("Error al exportar a PowerPoint. Revisa la consola.");
    } finally {
      setIsExportingPptx(false);
      setPptxExportHint(null);
    }
  };

  useEffect(() => {
    setEditTitleValue(topic || "");
  }, [topic]);

  useEffect(() => {
    if (isEditingTitle) {
      setPresentationTitleDraft(editTitleValue);
    } else {
      setPresentationTitleDraft(null);
    }
  }, [isEditingTitle, editTitleValue, setPresentationTitleDraft]);

  useEffect(() => {
    if (isEditingTitle) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditingTitle]);

  const toggleCharactersPanel = () => {
    if (showCharactersPanel) {
      setShowCharactersPanel(false);
    } else {
      setShowSlideStylePanel(false);
      setIsReadmePanelOpen(false);
      setIsPresentationSettingsPanelOpen(false);
      setShowCharactersPanel(true);
    }
  };

  const toggleSlideStylePanel = () => {
    if (showSlideStylePanel) {
      setShowSlideStylePanel(false);
    } else {
      setShowCharactersPanel(false);
      setIsReadmePanelOpen(false);
      setIsPresentationSettingsPanelOpen(false);
      setShowSlideStylePanel(true);
    }
  };

  useEffect(() => {
    if (!moreMenuOpen) return;
    const close = (e: MouseEvent) => {
      if (
        moreMenuRef.current &&
        !moreMenuRef.current.contains(e.target as Node)
      ) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [moreMenuOpen]);

  const saveTitle = () => {
    const trimmed = editTitleValue.trim();
    if (isCurrentPresentationReadOnly) {
      setIsEditingTitle(false);
      return;
    }
    setTopic(trimmed || "");
    setIsEditingTitle(false);
  };

  const workspaceButtons = (
    <>
      <IconButton
        variant="default"
        icon={<StickyNote size={18} />}
        aria-label={isNotesPanelOpen ? "Ocultar notas" : "Mostrar notas"}
        title={
          isNotesPanelOpen
            ? "Ocultar notas del presentador"
            : "Mostrar notas del presentador"
        }
        onClick={() => {
          setIsNotesPanelOpen(!isNotesPanelOpen);
          setIsReadmePanelOpen(false);
          setIsPresentationSettingsPanelOpen(false);
        }}
        className={cn(isNotesPanelOpen && panelActiveClass)}
      />
      <IconButton
        variant="default"
        icon={<BookText size={18} />}
        aria-label={isReadmePanelOpen ? "Ocultar README" : "Mostrar README"}
        title={
          isReadmePanelOpen
            ? "Ocultar README de la presentación"
            : "Mostrar README de la presentación"
        }
        onClick={() => {
          setIsReadmePanelOpen(!isReadmePanelOpen);
          setIsPresentationSettingsPanelOpen(false);
          setIsNotesPanelOpen(false);
        }}
        className={cn(isReadmePanelOpen && panelActiveClass)}
      />
      <IconButton
        variant="default"
        icon={<Mic size={18} />}
        aria-label="Prompt general (generar speech para toda la presentación)"
        title="Prompt general (generar speech para toda la presentación)"
        onClick={() => setShowSpeechModal(true)}
      />
      <div className="hidden xl:contents">
        <IconButton
          variant="default"
          icon={<UserPlus size={18} />}
          aria-label="Personajes (crear, ver, eliminar)"
          title="Personajes (crear, ver, eliminar)"
          onClick={toggleCharactersPanel}
          className={cn(showCharactersPanel && panelActiveClass)}
        />
        {slides.length > 0 && (
          <IconButton
            variant="default"
            icon={<LayoutTemplate size={18} />}
            aria-label="Plantilla de la diapositiva"
            title="Plantilla de la diapositiva"
            onClick={toggleSlideStylePanel}
            className={cn(showSlideStylePanel && panelActiveClass)}
          />
        )}
      </div>
    </>
  );

  const fileCloudInline = (
    <>
      <IconButton
        variant="default"
        icon={<FolderOpen size={18} />}
        aria-label="Mis presentaciones"
        title="Mis presentaciones"
        onClick={openSavedListModal}
      />
    </>
  );

  const exportSlideImageButton = slides.length > 0 && (
    <IconButton
      variant="default"
      icon={
        isExportingSlideImage ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <ImageIcon size={18} />
        )
      }
      aria-label="Exportar diapositiva como imagen"
      title={
        isExportingSlideImage
          ? "Exportando diapositiva…"
          : "Exportar diapositiva actual como imagen PNG"
      }
      onClick={handleExportSlideAsImage}
      disabled={isExportingSlideImage || isExportingPptx}
      className="hidden xl:inline-flex"
    />
  );

  const exportButton = slides.length > 0 && (
    <IconButton
      variant="default"
      icon={
        isExportingPptx ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <FileDown size={18} />
        )
      }
      aria-label="Exportar a PowerPoint"
      title={
        isExportingPptx
          ? pptxExportHint ?? "Exportando a PowerPoint…"
          : "Exportar a PowerPoint"
      }
      onClick={handleExportPowerPoint}
      disabled={isExportingPptx}
      className="hidden xl:inline-flex"
    />
  );

  const exportVideoButton = slides.length > 0 && (
    <IconButton
      variant="default"
      icon={<Clapperboard size={18} />}
      aria-label="Exportar presentación a vídeo (Remotion)"
      title="Exportar presentación a vídeo (MP4, Remotion)"
      onClick={() => openExportDeckVideoModal()}
      className="hidden xl:inline-flex"
    />
  );

  return (
    <header className="relative h-14 bg-white dark:bg-surface-elevated border-b border-stone-200 dark:border-border px-4 flex items-center justify-between z-10 shrink-0 gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <IconButton
          variant="default"
          icon={<ChevronLeft size={18} />}
          aria-label="Inicio"
          title="Inicio"
          onClick={() => {
            goHome();
            navigate("/");
          }}
        />
        {isEditingTitle ? (
          <input
            ref={inputRef}
            type="text"
            value={editTitleValue}
            onChange={(e) => setEditTitleValue(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                saveTitle();
              }
              if (e.key === "Escape") {
                setEditTitleValue(topic || "");
                setIsEditingTitle(false);
                inputRef.current?.blur();
              }
            }}
            className={cn(
              "font-serif italic text-lg text-stone-900 dark:text-foreground bg-stone-50 dark:bg-surface border border-stone-300 dark:border-border rounded px-2 py-0.5 min-w-0 max-w-[40vw]",
              "focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500",
            )}
            placeholder="Título de la presentación"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              if (!isCurrentPresentationReadOnly) setIsEditingTitle(true);
            }}
            className="font-serif italic text-lg text-stone-900 dark:text-foreground truncate text-left hover:bg-stone-50 dark:hover:bg-surface rounded px-1 py-0.5 -mx-1 min-w-0 max-w-[40vw]"
            title={
              isCurrentPresentationReadOnly
                ? "Solo lectura: no puedes editar el título"
                : "Clic para cambiar el título"
            }
          >
            {topic || "Nueva presentación"}
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0 min-w-0">
        <nav
          aria-label="Barra de herramientas del editor"
          className="flex items-center min-w-0 overflow-x-auto overflow-y-visible carousel-no-scrollbar"
        >
          <HeaderToolbarGroup>
            <IconButton
              variant="default"
              icon={<Sparkles size={18} />}
              aria-label="Generar toda la presentación con IA"
              title="Generar toda la presentación con IA (reemplaza diapositivas). El modelo se elige en Configuración (menú de cuenta)."
              onClick={openGenerateFullDeckModal}
            />
          </HeaderToolbarGroup>
          <HeaderToolbarGroup>{workspaceButtons}</HeaderToolbarGroup>
          <HeaderToolbarGroup className="hidden xl:flex">
            {fileCloudInline}
          </HeaderToolbarGroup>
          <HeaderToolbarGroup className="items-center">
            {exportSlideImageButton}
            {exportVideoButton}
            {exportButton}
            {slides.length > 0 && (
              <IconButton
                variant="primary"
                icon={
                  isSaving ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Save size={18} />
                  )
                }
                aria-label={currentSavedId ? "Guardar cambios" : "Guardar"}
                title={currentSavedId ? "Guardar cambios" : "Guardar"}
                onClick={handleSave}
                disabled={isSaving}
              />
            )}
            {slides.length > 0 && (
              <IconButton
                variant="primarySolid"
                icon={<Maximize2 size={18} />}
                aria-label="Vista previa"
                title="Vista previa"
                onClick={() => {
                  flushSync(() => {
                    flushDiagramPending();
                    flushIsometricFlowPending();
                  });
                  setIsPreviewMode(true);
                }}
              />
            )}
            {saveMessage && (
              <span className="text-[10px] text-stone-500 dark:text-muted-foreground font-medium px-1 max-w-20 truncate xl:max-w-none">
                {saveMessage}
              </span>
            )}
          </HeaderToolbarGroup>
          <div
            ref={moreMenuRef}
            className="relative shrink-0 xl:hidden border-l border-stone-200 dark:border-border pl-3 ml-0"
          >
            <IconButton
              variant="default"
              icon={<MoreHorizontal size={18} />}
              aria-label="Más opciones"
              title="Más opciones (archivo, exportar, paneles)"
              aria-expanded={moreMenuOpen}
              aria-haspopup="menu"
              onClick={() => setMoreMenuOpen((v) => !v)}
            />
            {moreMenuOpen && (
              <div
                role="menu"
                aria-label="Más opciones del editor"
                className="absolute right-0 top-full mt-1 z-50 w-56 rounded-xl border border-stone-200 dark:border-border bg-white dark:bg-surface-elevated py-1 shadow-xl"
              >
                <button
                  type="button"
                  role="menuitem"
                  className={cn(
                    "w-full px-3 py-2.5 text-left text-sm flex items-center gap-2 text-stone-700 dark:text-foreground hover:bg-stone-100 dark:hover:bg-surface",
                  )}
                  onClick={() => {
                    setMoreMenuOpen(false);
                    openSavedListModal();
                  }}
                >
                  <FolderOpen size={16} className="shrink-0 opacity-70" />
                  Mis presentaciones
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={cn(
                    "w-full px-3 py-2.5 text-left text-sm flex items-center gap-2 text-stone-700 dark:text-foreground hover:bg-stone-100 dark:hover:bg-surface",
                    isReadmePanelOpen && "bg-stone-100 dark:bg-surface",
                  )}
                  onClick={() => {
                    setIsReadmePanelOpen(!isReadmePanelOpen);
                    setIsPresentationSettingsPanelOpen(false);
                    setMoreMenuOpen(false);
                  }}
                >
                  <BookText size={16} className="shrink-0 opacity-70" />
                  README de la presentación
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={cn(
                    "w-full px-3 py-2.5 text-left text-sm flex items-center gap-2 text-stone-700 dark:text-foreground hover:bg-stone-100 dark:hover:bg-surface",
                    showCharactersPanel && "bg-stone-100 dark:bg-surface",
                  )}
                  onClick={() => {
                    toggleCharactersPanel();
                    setMoreMenuOpen(false);
                  }}
                >
                  <UserPlus size={16} className="shrink-0 opacity-70" />
                  Personajes
                </button>
                {slides.length > 0 && (
                  <button
                    type="button"
                    role="menuitem"
                    className={cn(
                      "w-full px-3 py-2.5 text-left text-sm flex items-center gap-2 text-stone-700 dark:text-foreground hover:bg-stone-100 dark:hover:bg-surface",
                      showSlideStylePanel && "bg-stone-100 dark:bg-surface",
                    )}
                    onClick={() => {
                      toggleSlideStylePanel();
                      setMoreMenuOpen(false);
                    }}
                  >
                    <LayoutTemplate size={16} className="shrink-0 opacity-70" />
                    Plantilla de diapositiva
                  </button>
                )}
                {slides.length > 0 && (
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full px-3 py-2.5 text-left text-sm flex items-center gap-2 text-stone-700 dark:text-foreground hover:bg-stone-100 dark:hover:bg-surface"
                    onClick={() => {
                      setMoreMenuOpen(false);
                      openExportDeckVideoModal();
                    }}
                  >
                    <Clapperboard size={16} className="shrink-0 opacity-70" />
                    Exportar vídeo (Remotion)
                  </button>
                )}
                {slides.length > 0 && (
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full px-3 py-2.5 text-left text-sm flex flex-col items-start gap-1 text-stone-700 dark:text-foreground hover:bg-stone-100 dark:hover:bg-surface disabled:opacity-50"
                    onClick={handleExportPowerPoint}
                    disabled={isExportingPptx}
                  >
                    <span className="flex items-center gap-2">
                      {isExportingPptx ? (
                        <Loader2 size={16} className="shrink-0 animate-spin" />
                      ) : (
                        <FileDown size={16} className="shrink-0 opacity-70" />
                      )}
                      Exportar PowerPoint
                    </span>
                    {isExportingPptx && pptxExportHint ? (
                      <span className="pl-[22px] text-[10px] font-normal leading-tight text-stone-500 dark:text-stone-400">
                        {pptxExportHint}
                      </span>
                    ) : null}
                  </button>
                )}
                {slides.length > 0 && (
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full px-3 py-2.5 text-left text-sm flex items-center gap-2 text-stone-700 dark:text-foreground hover:bg-stone-100 dark:hover:bg-surface disabled:opacity-50"
                    onClick={handleExportSlideAsImage}
                    disabled={isExportingSlideImage || isExportingPptx}
                  >
                    {isExportingSlideImage ? (
                      <Loader2 size={16} className="shrink-0 animate-spin" />
                    ) : (
                      <ImageIcon size={16} className="shrink-0 opacity-70" />
                    )}
                    Exportar diapositiva como imagen
                  </button>
                )}
              </div>
            )}
          </div>
        </nav>
        <AvatarMenu onOpenConfig={onOpenConfig} className="ml-0 shrink-0" />
      </div>
      {isExportingPptx && pptxExportHint ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-full z-[60] border-b border-amber-200/90 bg-amber-50/98 px-2 py-1.5 text-center text-[11px] leading-snug text-amber-950 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/95 dark:text-amber-50"
          role="status"
          aria-live="polite"
        >
          {pptxExportHint}
        </div>
      ) : null}
    </header>
  );
}
